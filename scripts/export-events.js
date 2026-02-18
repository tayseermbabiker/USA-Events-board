// Export active events from Airtable to static JSON (1 API call per day)
const Airtable = require('airtable');
const fs = require('fs');
const path = require('path');

async function exportEvents() {
  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
    .base(process.env.AIRTABLE_BASE_ID);

  const records = await base('Events')
    .select({
      filterByFormula: '{start_date} >= TODAY()',
      sort: [
        { field: 'is_user_submitted', direction: 'desc' },
        { field: 'start_date', direction: 'asc' },
      ],
      maxRecords: 200
    })
    .all();

  const events = records.map(r => ({
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

  const output = { success: true, events, count: events.length };

  fs.writeFileSync(
    path.join(__dirname, '..', 'public', 'events.json'),
    JSON.stringify(output)
  );

  console.log(`Exported ${events.length} events to public/events.json`);
}

exportEvents().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
