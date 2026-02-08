const Airtable = require('airtable');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  try {
    const data = JSON.parse(event.body);

    // Validate required fields
    const required = ['title', 'description', 'start_date', 'start_time', 'industry', 'city', 'venue_name', 'registration_url', 'organizer', 'contact_email'];
    const missing = required.filter((f) => !data[f]);
    if (missing.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: `Missing required fields: ${missing.join(', ')}` }),
      };
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
      .base(process.env.AIRTABLE_BASE_ID);

    const record = await base('Events').create({
      title: data.title,
      description: data.description,
      start_date: data.start_date,
      end_date: data.end_date || undefined,
      venue_name: data.venue_name,
      venue_address: data.venue_address || undefined,
      city: data.city,
      organizer: data.organizer,
      industry: data.industry,
      is_free: data.is_free || false,
      registration_url: data.registration_url,
      image_url: data.image_url || undefined,
      source: 'User Submitted',
      source_event_id: `user-${Date.now()}`,
      is_user_submitted: true,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, id: record.id }),
    };
  } catch (error) {
    console.error('Submit event error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
