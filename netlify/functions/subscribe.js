const Airtable = require('airtable');
const crypto = require('crypto');
const { Resend } = require('resend');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.SITE_URL || 'https://conferix.com/usa';
const SUBSCRIBERS = base('Subscribers');

function buildWelcomeEmail(name, cities, industries, unsubToken) {
  const displayName = name || 'there';
  const cityText = cities || 'All Cities';
  const industryText = industries || 'All Industries';
  const unsubUrl = `${SITE_URL}/unsubscribe.html?token=${unsubToken}`;

  const prefChips = (text, color) =>
    text.split(',').map(s => s.trim()).filter(Boolean)
      .map(v => `<td style="padding:4px 12px;background:${color};border-radius:6px;font-size:13px;font-weight:600;color:#0B1426;white-space:nowrap;">${v}</td>`)
      .join('<td style="width:6px;"></td>');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0B1426,#1C2333);padding:32px 24px;border-radius:12px 12px 0 0;text-align:center;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">Conferix <span style="color:#D4A853;">USA</span></p>
        </td></tr>
        <!-- Body -->
        <tr><td style="background:#ffffff;padding:32px 24px;">
          <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#0B1426;">Welcome to Conferix!</p>
          <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">Hey ${displayName}, you're all set! Every Monday, we'll send you new events matching:</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
            <tr><td style="padding:20px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Cities</p>
              <table cellpadding="0" cellspacing="0"><tr>${prefChips(cityText, '#d1fae5')}</tr></table>
              <p style="margin:16px 0 8px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Industries</p>
              <table cellpadding="0" cellspacing="0"><tr>${prefChips(industryText, '#ede9fe')}</tr></table>
            </td></tr>
          </table>

          <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">Your first alert arrives next Monday. Stay tuned!</p>

          <table cellpadding="0" cellspacing="0" width="100%">
            <tr><td align="center">
              <a href="${SITE_URL}" style="display:inline-block;padding:12px 32px;background:#1E3A5F;color:#ffffff;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;">Browse Events Now</a>
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

async function sendWelcomeEmail(email, name, cities, industries, unsubToken) {
  try {
    await resend.emails.send({
      from: 'Conferix USA <alerts@conferix.com>',
      to: email,
      subject: 'Welcome to Conferix USA — You\'re In!',
      html: buildWelcomeEmail(name, cities, industries, unsubToken),
    });
  } catch (err) {
    console.error('Welcome email failed:', err);
    // Don't block subscription if email fails
  }
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const email = body.email;

    if (!email) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email is required' }) };
    }

    // Login-only: look up subscriber without updating
    if (body.login_only) {
      const found = await SUBSCRIBERS.select({
        filterByFormula: `{email} = '${email.replace(/'/g, "\\'")}'`,
        maxRecords: 1,
      }).firstPage();

      if (found.length > 0) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            user: { first_name: found[0].get('first_name') || '', email },
            message: 'Welcome back!',
          }),
        };
      }
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'No account found. Please sign up first.' }),
      };
    }

    const first_name = body.first_name;
    const cities = body.cities || 'All Cities';
    const industries = body.industries || 'All Industries';

    // Check if subscriber already exists
    const existing = await SUBSCRIBERS.select({
      filterByFormula: `{email} = '${email.replace(/'/g, "\\'")}'`,
      maxRecords: 1,
    }).firstPage();

    const today = new Date().toISOString().split('T')[0];

    if (existing.length > 0) {
      // Update existing subscriber: refresh prefs and reactivate
      await SUBSCRIBERS.update(existing[0].id, {
        first_name: first_name || existing[0].get('first_name') || '',
        cities: cities,
        industries: industries,
        is_active: true,
      });

      const token = existing[0].get('unsubscribe_token');
      await sendWelcomeEmail(email, first_name || existing[0].get('first_name'), cities, industries, token);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Preferences updated!' }),
      };
    }

    // Create new subscriber
    const unsubToken = crypto.randomUUID();
    const record = await SUBSCRIBERS.create({
      email,
      first_name: first_name || '',
      cities: cities,
      industries: industries,
      is_active: true,
      created_at: today,
      unsubscribe_token: unsubToken,
    });

    await sendWelcomeEmail(email, first_name, cities, industries, unsubToken);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'You\'re subscribed!' }),
    };

  } catch (err) {
    console.error('Subscribe error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Something went wrong. Please try again.' }),
    };
  }
};
