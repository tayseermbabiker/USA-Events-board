const Airtable = require('airtable');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
      .base(process.env.AIRTABLE_BASE_ID);

    const params = event.queryStringParameters || {};
    const { month, industry, cost, city } = params;

    // Build filter: only future/ongoing events
    let filters = ['{start_date} >= TODAY()'];

    if (month) {
      filters.push(`IS_SAME(DATETIME_PARSE({start_date}), DATETIME_PARSE("${month}-01"), "month")`);
    }
    if (industry) {
      filters.push(`{industry} = "${industry}"`);
    }
    if (cost === 'free') {
      filters.push('{is_free} = TRUE()');
    } else if (cost === 'paid') {
      filters.push('{is_free} = FALSE()');
    }
    if (city) {
      filters.push(`{city} = "${city}"`);
    }

    const filterFormula = filters.length === 1 ? filters[0] : `AND(${filters.join(', ')})`;

    const records = await base('Events')
      .select({
        filterByFormula: filterFormula,
        sort: [
          { field: 'is_user_submitted', direction: 'desc' },
          { field: 'start_date', direction: 'asc' },
        ],
        maxRecords: 200,
      })
      .all();

    const events = records.map((r) => ({
      id: r.id,
      title: r.get('title'),
      description: r.get('description'),
      start_date: r.get('start_date'),
      end_date: r.get('end_date'),
      venue_name: r.get('venue_name'),
      venue_address: r.get('venue_address'),
      city: r.get('city'),
      organizer: r.get('organizer'),
      industry: r.get('industry'),
      is_free: r.get('is_free') || false,
      registration_url: r.get('registration_url'),
      image_url: r.get('image_url'),
      source: r.get('source'),
      is_user_submitted: r.get('is_user_submitted') || false,
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, events, count: events.length }),
    };
  } catch (error) {
    console.error('Get events error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
