const Airtable = require('airtable');
const { Resend } = require('resend');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.SITE_URL || 'https://conferix.com/usa';
const SUBSCRIBERS = base('Subscribers');
const EVENTS = base('Events');

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDateRange(start, end) {
  const s = formatDate(start);
  if (!end || end === start) return s;
  return `${s} — ${formatDate(end)}`;
}

function buildDigestEmail(subscriber, events, dateFrom, dateTo) {
  const name = subscriber.first_name || 'there';
  const unsubUrl = `${SITE_URL}/unsubscribe.html?token=${subscriber.unsubscribe_token}`;
  const count = events.length;

  const fromLabel = formatDate(dateFrom);
  const toLabel = formatDate(dateTo);

  const eventList = events.slice(0, 15).map((ev, i) => {
    const num = i + 1;
    const shortDate = formatDate(ev.start_date);
    const city = ev.city ? `, ${ev.city}` : '';
    const title = ev.registration_url
      ? `<a href="${ev.registration_url}" style="color:#1E3A5F;text-decoration:none;font-weight:600;">${ev.title}</a>`
      : `<strong>${ev.title}</strong>`;

    return `<tr><td style="padding:6px 0;font-size:14px;color:#0B1426;line-height:1.5;">${num}. ${title} — <span style="color:#64748b;">${shortDate}${city}</span></td></tr>`;
  }).join('');

  const moreNote = count > 15
    ? `<p style="margin:16px 0 0;font-size:13px;color:#64748b;text-align:center;">+ ${count - 15} more events on <a href="${SITE_URL}" style="color:#1E3A5F;font-weight:600;">conferix.com</a></p>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0B1426,#1C2333);padding:32px 24px;border-radius:12px 12px 0 0;text-align:center;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">Conferix <span style="color:#D4A853;">USA</span></p>
          <p style="margin:8px 0 0;font-size:14px;color:#94a3b8;">Weekly Events Digest</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="background:#ffffff;padding:32px 24px;">
          <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#0B1426;">Hey ${name}, your events are here!</p>
          <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">We found <strong style="color:#0B1426;">${count} event${count !== 1 ? 's' : ''}</strong> that match your preferences for ${fromLabel} — ${toLabel}.</p>

          <table width="100%" cellpadding="0" cellspacing="0">
            ${eventList}
          </table>
          ${moreNote}

          <table cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;">
            <tr><td align="center">
              <a href="${SITE_URL}" style="display:inline-block;padding:12px 32px;background:#1E3A5F;color:#ffffff;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;">Browse All Events</a>
            </td></tr>
          </table>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:24px;border-radius:0 0 12px 12px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">You're receiving this because you subscribed to Conferix USA alerts.</p>
          <p style="margin:0;font-size:13px;"><a href="${unsubUrl}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  // Auth check
  const params = event.queryStringParameters || {};
  if (params.key !== process.env.ALERTS_SECRET) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  try {
    // 1. Fetch active subscribers
    const subscribers = await SUBSCRIBERS.select({
      filterByFormula: '{is_active} = TRUE()',
    }).all();

    if (subscribers.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ sent: 0, skipped: 0, errors: 0, message: 'No active subscribers' }) };
    }

    // 2. Fetch upcoming events (next 14 days)
    const today = new Date();
    const twoWeeks = new Date(today);
    twoWeeks.setDate(twoWeeks.getDate() + 14);
    const todayStr = today.toISOString().split('T')[0];
    const twoWeeksStr = twoWeeks.toISOString().split('T')[0];

    const allEvents = await EVENTS.select({
      filterByFormula: `AND({start_date} >= "${todayStr}", {start_date} <= "${twoWeeksStr}")`,
      sort: [{ field: 'start_date', direction: 'asc' }],
    }).all();

    const events = allEvents.map(r => ({
      title: r.get('title'),
      start_date: r.get('start_date'),
      end_date: r.get('end_date'),
      venue_name: r.get('venue_name'),
      city: r.get('city'),
      industry: r.get('industry'),
      is_free: r.get('is_free') || false,
      registration_url: r.get('registration_url'),
    }));

    // 3. Send personalized digest to each subscriber
    let sent = 0, skipped = 0, errors = 0;

    for (const sub of subscribers) {
      try {
        const email = sub.get('email');
        const firstName = sub.get('first_name') || '';
        const citiesPref = sub.get('cities') || 'All Cities';
        const industriesPref = sub.get('industries') || 'All Industries';
        const unsubToken = sub.get('unsubscribe_token') || '';

        // Parse preferences
        const cityList = citiesPref.split(',').map(s => s.trim()).filter(Boolean);
        const industryList = industriesPref.split(',').map(s => s.trim()).filter(Boolean);
        const allCities = cityList.some(c => c === 'All Cities');
        const allIndustries = industryList.some(i => i === 'All Industries');

        // Filter events for this subscriber
        const matched = events.filter(ev => {
          const cityMatch = allCities || cityList.includes(ev.city);
          const industryMatch = allIndustries || industryList.includes(ev.industry);
          return cityMatch && industryMatch;
        });

        if (matched.length === 0) {
          skipped++;
          continue;
        }

        const html = buildDigestEmail(
          { first_name: firstName, unsubscribe_token: unsubToken },
          matched,
          todayStr,
          twoWeeksStr,
        );

        const subject = `Your Weekly Events — ${formatDate(todayStr)} to ${formatDate(twoWeeksStr)}`;

        await resend.emails.send({
          from: 'Conferix USA <alerts@conferix.com>',
          to: email,
          subject,
          html,
        });

        // Update last_alerted_at
        await SUBSCRIBERS.update(sub.id, {
          last_alerted_at: todayStr,
        });

        sent++;
      } catch (err) {
        console.error(`Failed to send to ${sub.get('email')}:`, err.message);
        errors++;
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ sent, skipped, errors, totalEvents: events.length, totalSubscribers: subscribers.length }),
    };

  } catch (err) {
    console.error('Weekly alerts error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
