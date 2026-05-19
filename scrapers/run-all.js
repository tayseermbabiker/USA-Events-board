const config = require('./config');
const logger = require('./utils/logger');
const pLimit = require('p-limit');

// Import all scrapers
const EventbriteScraper = require('./sites/eventbrite');
const MeetupScraper = require('./sites/meetup');
const LumaScraper = require('./sites/luma');
const EMedEventsScraper = require('./sites/emedevents');
const PriMedScraper = require('./sites/primed');
const AMSScraper = require('./sites/ams');
const ClioScraper = require('./sites/clio');
const StartupGrindScraper = require('./sites/startupgrind');
const USChamberScraper = require('./sites/uschamber');
const AllConferenceAlertScraper = require('./sites/allconferencealert');
const LegalWeekScraper = require('./sites/legalweek');
const DigiMarConScraper = require('./sites/digimarcon');
const TerrapinnNAScraper = require('./sites/terrapinn-na');
const JavitsScraper = require('./sites/javits');
const FIAScraper = require('./sites/fia');
const PionlineScraper = require('./sites/pionline');
const MilkenScraper = require('./sites/milken');
const ACGScraper = require('./sites/acg');
const FamilyOfficeScraper = require('./sites/familyoffice');
const FintechWeeklyScraper = require('./sites/fintechweekly');
const ANAScraper = require('./sites/ana');

const ALL_SCRAPERS = [
  { key: 'eventbrite',         Cls: EventbriteScraper },
  { key: 'meetup',             Cls: MeetupScraper },
  { key: 'luma',               Cls: LumaScraper },
  { key: 'emedevents',         Cls: EMedEventsScraper },
  { key: 'primed',             Cls: PriMedScraper },
  { key: 'ams',                Cls: AMSScraper },
  { key: 'clio',               Cls: ClioScraper },
  { key: 'startupgrind',       Cls: StartupGrindScraper },
  { key: 'uschamber',          Cls: USChamberScraper },
  { key: 'allconferencealert', Cls: AllConferenceAlertScraper },
  { key: 'legalweek',          Cls: LegalWeekScraper },
  { key: 'digimarcon',         Cls: DigiMarConScraper },
  { key: 'terrapinnna',        Cls: TerrapinnNAScraper },
  { key: 'javits',             Cls: JavitsScraper },
  { key: 'fia',                Cls: FIAScraper },
  { key: 'pionline',           Cls: PionlineScraper },
  { key: 'milken',             Cls: MilkenScraper },
  { key: 'acg',                Cls: ACGScraper },
  { key: 'familyoffice',       Cls: FamilyOfficeScraper },
  { key: 'fintechweekly',      Cls: FintechWeeklyScraper },
  { key: 'ana',                Cls: ANAScraper },
];

const CONCURRENCY = 4;

async function postBatch(events) {
  const url = config.webhookUrl;
  logger.info('Runner', `POSTing batch of ${events.length} events to webhook`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(events),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  logger.info('Runner', `Response: ${json.message || JSON.stringify(json.results)}`);
  return json;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Scrape a single source, isolated so a failure can't take down the run
async function runSource({ key, Cls }) {
  if (!config.scrapers[key]?.enabled) {
    logger.info('Runner', `Skipping ${key} (disabled)`);
    return { key, status: 'skipped', count: 0, events: [] };
  }

  logger.info('Runner', `--- ${key} START ---`);
  try {
    const scraper = new Cls();
    const events = await scraper.run();
    logger.info('Runner', `--- ${key} DONE (${events.length} events) ---`);
    return { key, status: events.length > 0 ? 'ok' : 'empty', count: events.length, events };
  } catch (err) {
    logger.error('Runner', `${key} failed: ${err.message}`);
    return { key, status: 'error', count: 0, events: [], error: err.message };
  }
}

async function main() {
  const startTime = Date.now();
  logger.info('Runner', `=== USA Scrape run started (concurrency=${CONCURRENCY}) ===`);

  const limit = pLimit(CONCURRENCY);
  const summary = {};
  const allEvents = [];

  // Run scrapers in parallel (4 at a time). One source failing doesn't kill the rest.
  const settled = await Promise.allSettled(
    ALL_SCRAPERS.map(s => limit(() => runSource(s)))
  );

  for (const r of settled) {
    if (r.status !== 'fulfilled') {
      logger.error('Runner', `Unexpected rejection: ${r.reason}`);
      continue;
    }
    const { key, status, count, events, error } = r.value;
    summary[key] = { status, count, ...(error && { error }) };
    if (events && events.length) allEvents.push(...events);
  }

  logger.info('Runner', `Total events collected: ${allEvents.length}`);

  if (allEvents.length === 0) {
    logger.warn('Runner', 'No events scraped — nothing to POST');
    printSummary(summary, startTime);
    return;
  }

  // POST in batches sequentially (the webhook batches its own writes,
  // and parallel POSTs would just hammer Netlify without speeding anything up)
  const batchSize = config.batch.size;
  let posted = 0;
  let errors = 0;

  for (let i = 0; i < allEvents.length; i += batchSize) {
    const batch = allEvents.slice(i, i + batchSize);
    try {
      await postBatch(batch);
      posted += batch.length;
    } catch (err) {
      logger.error('Runner', `Batch POST failed: ${err.message}`);
      errors += batch.length;
    }
    if (i + batchSize < allEvents.length) {
      await sleep(config.batch.delayMs);
    }
  }

  logger.info('Runner', `Posted: ${posted}, Errors: ${errors}`);
  printSummary(summary, startTime);
}

function printSummary(summary, startTime) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info('Runner', '=== Summary ===');
  for (const [key, val] of Object.entries(summary)) {
    const suffix = val.error ? ` — ${val.error}` : '';
    logger.info('Runner', `  ${key}: ${val.status} (${val.count} events)${suffix}`);
  }
  logger.info('Runner', `Total time: ${elapsed}s`);
  logger.info('Runner', '=== USA Scrape run complete ===');
  logger.close();
}

main().catch(err => {
  logger.error('Runner', `Fatal: ${err.message}`);
  logger.close();
  process.exit(1);
});
