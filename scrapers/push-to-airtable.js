// Push scraped events directly to Airtable (bypasses webhook)
const Airtable = require('airtable');
const config = require('./config');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = config.airtable.baseId;

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(BASE_ID);
const eventsTable = base('Events');

const toDate = (val) => (val ? val.split('T')[0] : null);

async function pushEvents(events) {
  let created = 0, updated = 0, errors = 0;

  for (const evt of events) {
    try {
      // Check for existing by source_event_id
      const existing = await eventsTable
        .select({
          filterByFormula: `{source_event_id} = "${evt.source_event_id}"`,
          maxRecords: 1,
        })
        .firstPage();

      const record = {
        title: (evt.title || '').substring(0, 500),
        description: (evt.description || '').substring(0, 5000),
        start_date: toDate(evt.start_date),
        end_date: toDate(evt.end_date),
        venue_name: evt.venue_name || null,
        venue_address: evt.venue_address || null,
        city: evt.city || null,
        organizer: evt.organizer || null,
        industry: evt.industry || 'General',
        is_free: evt.is_free || false,
        registration_url: evt.registration_url || null,
        image_url: evt.image_url || null,
        source: evt.source,
        source_event_id: evt.source_event_id,
      };

      // Remove null values
      Object.keys(record).forEach(k => { if (record[k] === null) delete record[k]; });

      if (existing.length > 0) {
        await eventsTable.update(existing[0].id, record);
        updated++;
      } else {
        await eventsTable.create(record);
        created++;
      }

      if ((created + updated) % 10 === 0) {
        console.log(`  Progress: ${created} created, ${updated} updated...`);
      }
    } catch (err) {
      errors++;
      console.error(`  Error: ${evt.title} - ${err.message}`);
    }
  }

  return { created, updated, errors };
}

// Import all scrapers
const scraperFiles = [
  'eventbrite', 'meetup', 'luma',
  'emedevents', 'primed', 'ams',
  'clio', 'startupgrind', 'uschamber',
  'allconferencealert', 'legalweek',
];

async function main() {
  console.log('=== Scrape & Push to Airtable ===\n');
  let allEvents = [];

  for (const name of scraperFiles) {
    if (!config.scrapers[name]?.enabled) {
      console.log(`[${name}] Disabled, skipping`);
      continue;
    }

    try {
      console.log(`[${name}] Running scraper...`);
      const Scraper = require(`./sites/${name}`);
      const scraper = new Scraper();
      const events = await scraper.run();
      console.log(`[${name}] Got ${events.length} events`);
      allEvents.push(...events);
    } catch (err) {
      console.error(`[${name}] FAILED: ${err.message}`);
    }

    // 1s pause between scrapers
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\nTotal scraped: ${allEvents.length} events`);
  console.log('Pushing to Airtable...\n');

  const results = await pushEvents(allEvents);

  console.log('\n=== Done ===');
  console.log(`Created: ${results.created}`);
  console.log(`Updated: ${results.updated}`);
  console.log(`Errors: ${results.errors}`);
}

main().catch(console.error);
