const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const SUBSCRIBERS = base('Subscribers');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  const token = event.queryStringParameters?.token;

  if (!token) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing token' }) };
  }

  try {
    const records = await SUBSCRIBERS.select({
      filterByFormula: `{unsubscribe_token} = '${token.replace(/'/g, "\\'")}'`,
      maxRecords: 1,
    }).firstPage();

    if (records.length === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Subscriber not found' }) };
    }

    await SUBSCRIBERS.update(records[0].id, { is_active: false });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'You have been unsubscribed.' }),
    };

  } catch (err) {
    console.error('Unsubscribe error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Something went wrong.' }),
    };
  }
};
