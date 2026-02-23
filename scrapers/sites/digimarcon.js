const BaseScraper = require('../base-scraper');
const config = require('../config');
const logger = require('../utils/logger');
const { classifyIndustry } = require('../utils/industry-map');

const LISTING_URL = 'https://digimarcon.com/events/';

class DigiMarConScraper extends BaseScraper {
  constructor() {
    super('DigiMarCon');
  }

  async scrape() {
    logger.info(this.name, `Fetching listing: ${LISTING_URL}`);
    await this.page.goto(LISTING_URL, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(3000);

    // DigiMarCon uses JSON-LD EventSeries with subEvent entries
    const subEvents = await this.page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      const events = [];

      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);
          // Could be EventSeries with subEvent array
          if (data.subEvent && Array.isArray(data.subEvent)) {
            events.push(...data.subEvent);
          }
          // Could be array at top level
          if (Array.isArray(data)) {
            for (const item of data) {
              if (item.subEvent && Array.isArray(item.subEvent)) {
                events.push(...item.subEvent);
              }
              if (item['@type'] === 'BusinessEvent' || item['@type'] === 'Event') {
                events.push(item);
              }
            }
          }
          // Could be @graph
          if (data['@graph']) {
            for (const item of data['@graph']) {
              if (item.subEvent && Array.isArray(item.subEvent)) {
                events.push(...item.subEvent);
              }
              if (item['@type'] === 'BusinessEvent' || item['@type'] === 'Event') {
                events.push(item);
              }
            }
          }
          // Direct Event/BusinessEvent
          if (data['@type'] === 'BusinessEvent' || data['@type'] === 'Event') {
            events.push(data);
          }
        } catch {}
      }

      return events;
    });

    logger.info(this.name, `Found ${subEvents.length} subEvent entries in JSON-LD`);

    const events = [];

    for (const ev of subEvents) {
      const location = ev.location || {};
      const address = location.address || {};

      // Only US events
      const country = address.addressCountry || '';
      if (country && !['US', 'USA', 'United States'].includes(country)) continue;

      const cityRaw = address.addressLocality || '';
      const city = this.detectCity(cityRaw + ' ' + (address.addressRegion || ''));
      if (!city) {
        logger.info(this.name, `Skipping non-target city: ${ev.name} (${cityRaw})`);
        continue;
      }

      const slug = (ev.url || ev.name || '')
        .split('/').filter(Boolean).pop()
        .replace(/[^a-z0-9]+/gi, '-').toLowerCase()
        .substring(0, 80);

      const text = `${ev.name || ''} ${ev.description || ''}`;

      events.push({
        title: ev.name,
        description: ev.description || '',
        start_date: ev.startDate,
        end_date: ev.endDate || null,
        venue_name: location.name || null,
        venue_address: address.streetAddress || null,
        city,
        organizer: ev.organizer?.name || 'DigiMarCon',
        industry: classifyIndustry(text, 'Marketing'),
        is_free: false,
        registration_url: ev.url || LISTING_URL,
        image_url: typeof ev.image === 'string' ? ev.image : ev.image?.url || null,
        source: 'DigiMarCon',
        source_event_id: `dmc-${slug}`,
      });

      logger.info(this.name, `Added: ${ev.name} (${city})`);
    }

    return events;
  }

  detectCity(text) {
    const lower = (text || '').toLowerCase();
    if (lower.includes('austin')) return 'Austin';
    if (lower.includes('san francisco') || lower.includes(' sf')) return 'San Francisco';
    if (lower.includes('san jose')) return 'San Jose';
    if (lower.includes('oakland')) return 'Oakland';
    if (lower.includes('new york') || lower.includes('nyc') || lower.includes('manhattan')) return 'New York';
    if (lower.includes('brooklyn')) return 'Brooklyn';
    if (lower.includes('los angeles') || lower.includes(' la,') || lower.includes(' la ')) return 'Los Angeles';
    if (lower.includes('miami')) return 'Miami';
    if (lower.includes('chicago')) return 'Chicago';
    if (lower.includes('seattle')) return 'Seattle';
    if (lower.includes('denver')) return 'Denver';
    if (lower.includes('boston')) return 'Boston';
    if (lower.includes('washington') || lower.includes(' dc')) return 'Washington DC';
    return null;
  }
}

module.exports = DigiMarConScraper;
