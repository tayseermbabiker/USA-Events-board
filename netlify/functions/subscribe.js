const Airtable = require('airtable');
const crypto = require('crypto');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const SUBSCRIBERS = base('Subscribers');

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
    const { email, first_name, cities, industries } = JSON.parse(event.body);

    if (!email) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email is required' }) };
    }

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
        cities: cities || '',
        industries: industries || '',
        is_active: true,
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Preferences updated!' }),
      };
    }

    // Create new subscriber
    const record = await SUBSCRIBERS.create({
      email,
      first_name: first_name || '',
      cities: cities || '',
      industries: industries || '',
      is_active: true,
      created_at: today,
      unsubscribe_token: crypto.randomUUID(),
    });

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
