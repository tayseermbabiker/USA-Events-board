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

function buildEarlyBirdSection(earlyBirdEvents) {
  if (!earlyBirdEvents || earlyBirdEvents.length === 0) return '';
  const rows = earlyBirdEvents.slice(0, 5).map(ev => {
    const goUrl = `${SITE_URL}/.netlify/functions/go?id=${ev.id}`;
    const title = ev.registration_url
      ? `<a href="${goUrl}" style="color:#1E3A5F;text-decoration:none;font-weight:600;">${ev.title}</a>`
      : `<strong>${ev.title}</strong>`;
    const shortDate = formatDate(ev.start_date);
    const city = ev.city ? `, ${ev.city}` : '';
    const deadline = formatDate(ev.early_bird_deadline);
    return `<tr><td style="padding:6px 0;font-size:14px;color:#0B1426;line-height:1.5;">${title} — <span style="color:#64748b;">${shortDate}${city}</span><br><span style="color:#D4A853;font-size:12px;font-weight:600;">Early bird ends ${deadline}</span></td></tr>`;
  }).join('');
  return `
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:2px solid #D4A853;padding-top:20px;">
            <tr><td style="padding:0 0 12px;font-size:18px;font-weight:700;color:#D4A853;">Early Bird Ending Soon</td></tr>
            ${rows}
          </table>`;
}

function buildDigestEmail(subscriber, events, dateFrom, dateTo, earlyBirdEvents) {
  const name = subscriber.first_name || 'there';
  const unsubUrl = `${SITE_URL}/unsubscribe.html?token=${subscriber.unsubscribe_token}`;
  const count = events.length;
  const earlyBirdHtml = buildEarlyBirdSection(earlyBirdEvents);

  const fromLabel = formatDate(dateFrom);
  const toLabel = formatDate(dateTo);

  const eventList = events.slice(0, 15).map((ev, i) => {
    const num = i + 1;
    const shortDate = formatDate(ev.start_date);
    const city = ev.city ? `, ${ev.city}` : '';
    const goUrl = `${SITE_URL}/.netlify/functions/go?id=${ev.id}`;
    const title = ev.registration_url
      ? `<a href="${goUrl}" style="color:#1E3A5F;text-decoration:none;font-weight:600;">${ev.title}</a>`
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
          <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#0B1426;">Hey ${name}, plan your week!</p>
          <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">We found <strong style="color:#0B1426;">${count} event${count !== 1 ? 's' : ''}</strong> matching your preferences for ${fromLabel} — ${toLabel}.</p>

          <table width="100%" cellpadding="0" cellspacing="0">
            ${eventList}
          </table>
          ${moreNote}
          ${earlyBirdHtml}

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

    // 2. Fetch events for the coming week (Mon–Sun)
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(monday.getDate() + 1);
    const sunday = new Date(today);
    sunday.setDate(sunday.getDate() + 7);
    const mondayStr = monday.toISOString().split('T')[0];
    const sundayStr = sunday.toISOString().split('T')[0];

    const allEvents = await EVENTS.select({
      filterByFormula: `AND({start_date} >= "${mondayStr}", {start_date} <= "${sundayStr}")`,
      sort: [{ field: 'start_date', direction: 'asc' }],
    }).all();

    // Prioritize professional sources over general aggregators
    const SOURCE_PRIORITY = { 'eMedEvents': 1, 'Pri-Med': 1, 'AMS': 1, 'Clio': 1, 'USChamber': 1, 'StartupGrind': 1, 'Luma': 2, 'Eventbrite': 2, 'Meetup': 3 };

    const events = allEvents.map(r => ({
      id: r.id,
      title: r.get('title'),
      start_date: r.get('start_date'),
      end_date: r.get('end_date'),
      venue_name: r.get('venue_name'),
      city: r.get('city'),
      industry: r.get('industry'),
      source: r.get('source'),
      is_free: r.get('is_free') || false,
      registration_url: r.get('registration_url'),
    })).sort((a, b) => {
      const pa = SOURCE_PRIORITY[a.source] || 2;
      const pb = SOURCE_PRIORITY[b.source] || 2;
      if (pa !== pb) return pa - pb;
      return (a.start_date || '').localeCompare(b.start_date || '');
    });

    // 2b. Fetch early bird events (deadline within 14 days, event beyond weekly window)
    const todayStr = today.toISOString().split('T')[0];
    const plus14 = new Date(today);
    plus14.setDate(plus14.getDate() + 14);
    const plus14Str = plus14.toISOString().split('T')[0];

    const allEarlyBird = await EVENTS.select({
      filterByFormula: `AND({early_bird_deadline} >= "${todayStr}", {early_bird_deadline} <= "${plus14Str}", {start_date} > "${sundayStr}")`,
      sort: [{ field: 'early_bird_deadline', direction: 'asc' }],
    }).all();

    const earlyBirdEvents = allEarlyBird.map(r => ({
      id: r.id,
      title: r.get('title'),
      start_date: r.get('start_date'),
      end_date: r.get('end_date'),
      city: r.get('city'),
      industry: r.get('industry'),
      registration_url: r.get('registration_url'),
      early_bird_deadline: r.get('early_bird_deadline'),
    }));

    // 3. Send personalized digest to each subscriber
    let sent = 0, skipped = 0, errors = 0;
    const subject = `This Week's USA Events — ${formatDate(mondayStr)} to ${formatDate(sundayStr)}`;

    // Build send tasks for all matching subscribers
    const sendTasks = [];
    for (const sub of subscribers) {
      const email = sub.get('email');
      const firstName = sub.get('first_name') || '';
      const citiesPref = sub.get('cities') || 'All Cities';
      const industriesPref = sub.get('industries') || 'All Industries';
      const unsubToken = sub.get('unsubscribe_token') || '';

      const cityList = citiesPref.split(',').map(s => s.trim()).filter(Boolean);
      const industryList = industriesPref.split(',').map(s => s.trim()).filter(Boolean);
      const allCities = cityList.some(c => c === 'All Cities');
      const allIndustries = industryList.some(i => i === 'All Industries');

      const matched = events.filter(ev => {
        const cityMatch = allCities || cityList.includes(ev.city);
        const industryMatch = allIndustries || industryList.includes(ev.industry);
        return cityMatch && industryMatch;
      });

      const earlyBirdMatched = earlyBirdEvents.filter(ev => {
        const cityMatch = allCities || cityList.includes(ev.city);
        const industryMatch = allIndustries || industryList.includes(ev.industry);
        return cityMatch && industryMatch;
      });

      if (matched.length === 0 && earlyBirdMatched.length === 0) {
        skipped++;
        continue;
      }

      const html = buildDigestEmail(
        { first_name: firstName, unsubscribe_token: unsubToken },
        matched,
        mondayStr,
        sundayStr,
        earlyBirdMatched,
      );

      sendTasks.push({ sub, email, html });
    }

    // Send emails in batches of 100 via Resend batch API
    for (let i = 0; i < sendTasks.length; i += 100) {
      const batch = sendTasks.slice(i, i + 100);
      const results = await Promise.allSettled(
        batch.map(({ email, html }) =>
          resend.emails.send({
            from: 'Conferix USA <alerts@conferix.com>',
            to: email,
            subject,
            html,
          })
        )
      );

      const batchSuccessIds = [];
      results.forEach((result, j) => {
        if (result.status === 'fulfilled') {
          sent++;
          batchSuccessIds.push(batch[j].sub.id);
        } else {
          console.error(`Failed to send to ${batch[j].email}:`, result.reason?.message);
          errors++;
        }
      });

      // Batch-update last_alerted_at only for confirmed sends (max 10 per Airtable call)
      for (let k = 0; k < batchSuccessIds.length; k += 10) {
        const updateBatch = batchSuccessIds.slice(k, k + 10);
        await SUBSCRIBERS.update(updateBatch.map(id => ({ id, fields: { last_alerted_at: mondayStr } })));
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ sent, skipped, errors, totalEvents: events.length, earlyBirdEvents: earlyBirdEvents.length, totalSubscribers: subscribers.length }),
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
