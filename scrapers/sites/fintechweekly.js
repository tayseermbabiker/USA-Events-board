const BaseScraper = require('../base-scraper');
const config = require('../config');
const logger = require('../utils/logger');
const { classifyIndustry } = require('../utils/industry-map');

const LISTING_URL = 'https://www.fintechweekly.com/fintech-conferences/';

class FintechWeeklyScraper extends BaseScraper {
  constructor() {
    super('FintechWeekly');
  }

  async scrape() {
    logger.info(this.name, `Fetching listing: ${LISTING_URL}`);
    await this.page.goto(LISTING_URL, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(3000);

    const rawEvents = await this.page.evaluate(() => {
      const results = [];
      const seen = new Set();

      const cards = document.querySelectorAll('li.c-list__item.conf-card');
      for (const card of cards) {
        const titleEl = card.querySelector('div.conf-card__name a, .conf-card__name a');
        if (!titleEl) continue;

        const title = titleEl.textContent.trim();
        if (!title || title.length < 5 || seen.has(title)) continue;
        seen.add(title);

        const href = titleEl.href;
        const desc = card.querySelector('p.conf-card__desc, .conf-card__desc');
        const description = desc ? desc.textContent.trim() : '';

        // Schema.org dates
        const startMeta = card.querySelector('meta[itemprop="startDate"]');
        const endMeta = card.querySelector('meta[itemprop="endDate"]');
        const startDate = startMeta ? startMeta.content : null;
        const endDate = endMeta ? endMeta.content : null;

        // Display date, city, country
        const dateTag = card.querySelector('span.conf-tag--date, .conf-tag--date');
        const cityTag = card.querySelector('span.conf-tag--city, .conf-tag--city');
        const countryTag = card.querySelector('span.conf-tag--country, .conf-tag--country');

        const dateText = dateTag ? dateTag.textContent.trim() : '';
        const city = cityTag ? cityTag.textContent.trim() : '';
        const country = countryTag ? countryTag.textContent.trim() : '';

        // Region data for filtering
        const selectData = card.getAttribute('data-select') || '';

        results.push({
          title, href, description,
          startDate, endDate,
          dateText, city, country,
          selectData,
        });
      }

      return results;
    });

    logger.info(this.name, `Found ${rawEvents.length} total events on page`);

    const events = [];

    for (const raw of rawEvents) {
      // Skip non-US events
      if (!raw.selectData.includes('north-america') && !raw.country.toLowerCase().includes('usa') && !raw.country.toLowerCase().includes('united states')) {
        continue;
      }

      // Skip placeholder dates (2099)
      if (raw.startDate && raw.startDate.includes('2099')) continue;

      const city = this.detectCity(raw.city);
      if (!city) continue;

      const slug = raw.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .substring(0, 80);

      events.push({
        title: raw.title,
        description: raw.description.substring(0, 5000),
        start_date: raw.startDate,
        end_date: raw.endDate || null,
        venue_name: null,
        venue_address: null,
        city,
        organizer: null,
        industry: classifyIndustry(raw.title + ' ' + raw.description, 'Finance'),
        is_free: false,
        registration_url: raw.href || LISTING_URL,
        image_url: null,
        source: 'Fintech Weekly',
        source_event_id: `ftw-${slug}`,
      });

      logger.info(this.name, `Added: ${raw.title} (${city})`);
    }

    return events;
  }

  detectCity(text) {
    const lower = (text || '').toLowerCase();
    if (lower.includes('austin')) return 'Austin';
    if (lower.includes('san francisco') || lower.includes(' sf')) return 'San Francisco';
    if (lower.includes('new york') || lower.includes('nyc') || lower.includes('manhattan')) return 'New York';
    if (lower.includes('brooklyn')) return 'Brooklyn';
    if (lower.includes('los angeles') || lower.includes(' la,') || lower.includes(' la ')) return 'Los Angeles';
    if (lower.includes('miami')) return 'Miami';
    if (lower.includes('chicago')) return 'Chicago';
    if (lower.includes('seattle')) return 'Seattle';
    if (lower.includes('denver')) return 'Denver';
    if (lower.includes('boston')) return 'Boston';
    if (lower.includes('washington') || lower.includes(' dc') || lower.includes('national harbor') || lower.includes('oxon hill')) return 'Washington DC';
    if (lower.includes('jersey city') || lower.includes('newark')) return 'New York';
    return null;
  }
}

module.exports = FintechWeeklyScraper;
