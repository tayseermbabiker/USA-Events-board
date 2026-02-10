const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const SITE_URL = process.env.SITE_URL || 'https://conferix.com/usa';

exports.handler = async (event) => {
  const id = (event.queryStringParameters || {}).id;

  if (!id) {
    return { statusCode: 302, headers: { Location: SITE_URL } };
  }

  try {
    const record = await base('Events').find(id);
    const url = record.get('registration_url');

    // Track the click
    const clicks = (record.get('click_count') || 0) + 1;
    const today = new Date().toISOString().split('T')[0];
    await base('Events').update(id, {
      click_count: clicks,
      last_clicked_at: today,
    });

    return {
      statusCode: 302,
      headers: { Location: url || SITE_URL },
    };
  } catch (err) {
    console.error('Redirect error:', err.message);
    return { statusCode: 302, headers: { Location: SITE_URL } };
  }
};
