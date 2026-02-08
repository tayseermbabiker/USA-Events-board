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
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const incomingEvents = JSON.parse(event.body);

    if (!Array.isArray(incomingEvents) || incomingEvents.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid events data' }) };
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
      .base(process.env.AIRTABLE_BASE_ID);

    const eventsTable = base('Events');
    const results = { created: 0, updated: 0, errors: [] };

    // Strip time from dates — Airtable date fields reject ISO timestamps
    const toDate = (val) => (val ? val.split('T')[0] : null);

    for (const evt of incomingEvents) {
      try {
        // Check for duplicate by source + source_event_id
        const existing = await eventsTable
          .select({
            filterByFormula: `{source_event_id} = "${evt.source_event_id}"`,
            maxRecords: 1,
          })
          .firstPage();

        const record = {
          title: evt.title,
          description: evt.description,
          start_date: toDate(evt.start_date),
          end_date: toDate(evt.end_date),
          venue_name: evt.venue_name,
          venue_address: evt.venue_address,
          city: evt.city || null,
          organizer: evt.organizer,
          industry: evt.industry || 'General',
          is_free: evt.is_free || false,
          registration_url: evt.registration_url,
          image_url: evt.image_url,
          source: evt.source,
          source_event_id: evt.source_event_id,
        };

        if (existing.length > 0) {
          await eventsTable.update(existing[0].id, record);
          results.updated++;
        } else {
          await eventsTable.create(record);
          results.created++;
        }
      } catch (err) {
        results.errors.push({ event: evt.title, error: err.message });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        results,
        message: `Processed ${incomingEvents.length} events: ${results.created} created, ${results.updated} updated`,
      }),
    };
  } catch (error) {
    console.error('Receive events error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
