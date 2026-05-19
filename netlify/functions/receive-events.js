// Netlify Function: Receive Events from USA scraper
// Optimized to minimize Airtable API calls:
//   - Bulk dedup by chunked OR formula (~1 list per 50 events)
//   - Batched creates and updates (10 records per call)
const Airtable = require('airtable');

const toDate = (val) => (val ? val.split('T')[0] : null);
const safeQuote = (s) => String(s).replace(/"/g, '\\"');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
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

    // === Bulk dedup ===
    // Fetch existing records matching this batch's source_event_ids in chunks
    // of 50 to keep formula length under Airtable's URL limit.
    const ids = incomingEvents.map(e => e.source_event_id).filter(Boolean);
    const existingMap = new Map();

    const CHUNK = 50;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const orExpr = chunk.map(id => `{source_event_id} = "${safeQuote(id)}"`).join(', ');
      const formula = `OR(${orExpr})`;
      try {
        const records = await eventsTable
          .select({ filterByFormula: formula, fields: ['source_event_id'] })
          .all();
        for (const rec of records) {
          const seid = rec.get('source_event_id');
          if (seid) existingMap.set(seid, rec.id);
        }
      } catch (err) {
        console.error('Bulk dedup chunk failed:', err.message);
        // If dedup fails, fall through — events in this chunk may end up
        // duplicated, but the scrape still completes.
      }
    }

    // === Build create/update lists ===
    const toCreate = [];
    const toUpdate = [];

    for (const evt of incomingEvents) {
      const record = {
        title: evt.title,
        description: evt.description,
        start_date: toDate(evt.start_date),
        end_date: toDate(evt.end_date),
        venue_name: evt.venue_name,
        venue_address: evt.venue_address,
        city: evt.city || null,
        organizer: evt.organizer,
        industry: evt.industry || null,
        is_free: evt.is_free || false,
        registration_url: evt.registration_url,
        image_url: evt.image_url,
        source: evt.source,
        source_event_id: evt.source_event_id,
      };

      const existingId = existingMap.get(evt.source_event_id);
      if (existingId) {
        toUpdate.push({ id: existingId, fields: record });
      } else {
        toCreate.push({ fields: record });
      }
    }

    // === Batched writes ===
    for (let i = 0; i < toCreate.length; i += 10) {
      try {
        const created = await eventsTable.create(toCreate.slice(i, i + 10));
        results.created += created.length;
      } catch (err) {
        console.error('Batched create failed:', err.message);
        results.errors.push({ batch: 'create', error: err.message });
      }
    }
    for (let i = 0; i < toUpdate.length; i += 10) {
      try {
        const updated = await eventsTable.update(toUpdate.slice(i, i + 10));
        results.updated += updated.length;
      } catch (err) {
        console.error('Batched update failed:', err.message);
        results.errors.push({ batch: 'update', error: err.message });
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
