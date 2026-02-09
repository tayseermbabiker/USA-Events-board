import { schedule } from '@netlify/functions';
import Airtable from 'airtable';
import { Resend } from 'resend';

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.URL || 'https://conferix.com';

const SUBSCRIBERS = base('Subscribers');
const EVENTS = base('Events');

async function getAllRecords(table, opts) {
  const records = [];
  await table.select(opts).eachPage((page, next) => {
    records.push(...page);
    next();
  });
  return records;
}

function matchesPrefs(event, subscriber) {
  const subCities = subscriber.get('cities')?.trim();
  const subIndustries = subscriber.get('industries')?.trim();

  // Empty = all
  const cityMatch = !subCities ||
    subCities.split(',').map(c => c.trim().toLowerCase())
      .includes((event.get('city') || '').toLowerCase());

  const industryMatch = !subIndustries ||
    subIndustries.split(',').map(i => i.trim().toLowerCase())
      .includes((event.get('industry') || '').toLowerCase());

  return cityMatch && industryMatch;
}

function isNewForSubscriber(event, lastAlerted) {
  if (!lastAlerted) return true; // never alerted = everything is new
  const eventCreated = event._rawJson.createdTime.split('T')[0];
  return eventCreated > lastAlerted;
}

function buildEmailHtml(subscriber, events) {
  const name = subscriber.get('first_name') || 'there';
  const token = subscriber.get('unsubscribe_token');
  const unsubUrl = `${SITE_URL}/unsubscribe.html?token=${token}`;

  const eventCards = events.map(ev => {
    const title = ev.get('title') || 'Untitled Event';
    const date = ev.get('start_date') || '';
    const city = ev.get('city') || '';
    const industry = ev.get('industry') || '';
    const isFree = ev.get('is_free');
    const url = ev.get('registration_url') || '#';

    return `
      <tr><td style="padding:12px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
          <tr><td style="padding:16px 20px;">
            <p style="margin:0 0 4px;font-size:17px;font-weight:600;color:#0B1426;">${title}</p>
            <p style="margin:0 0 8px;font-size:14px;color:#64748b;">
              ${date ? `📅 ${date}` : ''}${city ? ` &middot; 🏙️ ${city}` : ''}
            </p>
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="padding:2px 8px;background:${isFree ? '#d1fae5' : '#fef3c7'};border-radius:4px;font-size:12px;font-weight:600;color:${isFree ? '#065f46' : '#92400e'};">
                ${isFree ? 'FREE' : 'PAID'}
              </td>
              ${industry ? `<td style="padding:2px 8px;background:#ede9fe;border-radius:4px;font-size:12px;font-weight:600;color:#5b21b6;margin-left:6px;">${industry}</td>` : ''}
            </tr></table>
            <p style="margin:12px 0 0;">
              <a href="${url}" style="display:inline-block;padding:8px 20px;background:#1E3A5F;color:#ffffff;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">View Event</a>
            </p>
          </td></tr>
        </table>
      </td></tr>`;
  }).join('');

  return `
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
            <!-- Header -->
            <tr><td style="background:linear-gradient(135deg,#0B1426,#1C2333);padding:32px 24px;border-radius:12px 12px 0 0;text-align:center;">
              <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">Conferix <span style="color:#D4A853;">USA</span></p>
              <p style="margin:4px 0 0;font-size:14px;color:rgba(255,255,255,0.7);">Your Weekly Event Alerts</p>
            </td></tr>
            <!-- Body -->
            <tr><td style="background:#ffffff;padding:32px 24px;">
              <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#0B1426;">Hey ${name},</p>
              <p style="margin:0 0 24px;font-size:15px;color:#64748b;">Here are ${events.length} new event${events.length > 1 ? 's' : ''} matching your preferences:</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${eventCards}
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

const handler = async () => {
  try {
    // Get all active subscribers
    const subscribers = await getAllRecords(SUBSCRIBERS, {
      filterByFormula: '{is_active} = TRUE()',
    });

    if (subscribers.length === 0) {
      return { statusCode: 200, body: 'No active subscribers' };
    }

    // Get all future events
    const events = await getAllRecords(EVENTS, {
      filterByFormula: '{start_date} >= TODAY()',
      sort: [{ field: 'start_date', direction: 'asc' }],
    });

    const today = new Date().toISOString().split('T')[0];
    let emailsSent = 0;

    for (const sub of subscribers) {
      const lastAlerted = sub.get('last_alerted_at') || '';

      // Filter events matching this subscriber's prefs AND new since last alert
      const matching = events.filter(ev =>
        matchesPrefs(ev, sub) && isNewForSubscriber(ev, lastAlerted)
      );

      if (matching.length === 0) continue; // skip, no empty emails

      const email = sub.get('email');
      if (!email) continue;

      await resend.emails.send({
        from: 'Conferix USA <alerts@conferix.com>',
        to: email,
        subject: `${matching.length} New Event${matching.length > 1 ? 's' : ''} This Week — Conferix USA`,
        html: buildEmailHtml(sub, matching),
      });

      await SUBSCRIBERS.update(sub.id, { last_alerted_at: today });
      emailsSent++;
    }

    return { statusCode: 200, body: `Sent ${emailsSent} alert emails` };

  } catch (err) {
    console.error('Send alerts error:', err);
    return { statusCode: 500, body: 'Alert sending failed' };
  }
};

// Every Monday at 1pm UTC = 8am EST
export default schedule('0 13 * * 1', handler);
