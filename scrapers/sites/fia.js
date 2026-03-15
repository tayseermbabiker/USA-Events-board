const BaseScraper = require('../base-scraper');
const config = require('../config');
const logger = require('../utils/logger');
const { classifyIndustry } = require('../utils/industry-map');

const LISTING_URL = 'https://www.fia.org/upcoming-events';

class FIAScraper extends BaseScraper {
  constructor() {
    super('FIA');
  }

  async scrape() {
    logger.info(this.name, `Fetching listing: ${LISTING_URL}`);
    await this.page.goto(LISTING_URL, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(3000);

    const rawEvents = await this.page.evaluate(() => {
      const results = [];
      const seen = new Set();

      // FIA uses h4 for titles, followed by p tags for date/location
      const headings = document.querySelectorAll('h4');
      for (const h4 of headings) {
        const link = h4.querySelector('a') || h4.closest('a');
        const titleText = h4.textContent.trim();
        if (!titleText || titleText.length < 5) continue;

        let href = '';
        if (link) {
          href = link.href;
        } else {
          // Look for nearby link
          const parent = h4.parentElement;
          const nearbyLink = parent ? parent.querySelector('a[href*="/events/"], a[href*="/fia/"]') : null;
          if (nearbyLink) href = nearbyLink.href;
        }

        if (seen.has(titleText)) continue;
        seen.add(titleText);

        // Get date/location from following sibling text
        let dateText = '';
        let locationText = '';
        let sibling = h4.nextElementSibling;
        for (let i = 0; i < 3 && sibling; i++) {
          const text = sibling.textContent.trim();
          if (text && !dateText) {
            dateText = text;
          } else if (text && !locationText) {
            locationText = text;
          }
          sibling = sibling.nextElementSibling;
        }

        results.push({ title: titleText, dateText, locationText, href });
      }

      return results;
    });

    logger.info(this.name, `Found ${rawEvents.length} raw events`);

    const events = [];

    for (const raw of rawEvents) {
      // Skip webinars — we want in-person conferences
      if (/webinar/i.test(raw.title) || /webinar/i.test(raw.dateText)) continue;

      const city = this.detectCity(raw.locationText + ' ' + raw.dateText);
      if (!city) {
        logger.info(this.name, `Skipping non-US-city event: ${raw.title}`);
        continue;
      }

      const slug = raw.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .substring(0, 80);

      events.push({
        title: raw.title,
        description: '',
        start_date: raw.dateText,
        end_date: null,
        venue_name: null,
        venue_address: null,
        city,
        organizer: 'FIA',
        industry: classifyIndustry(raw.title, 'Finance'),
        is_free: false,
        registration_url: raw.href || LISTING_URL,
        image_url: null,
        source: 'FIA',
        source_event_id: `fia-${slug}`,
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
    if (lower.includes('washington') || lower.includes(' dc') || lower.includes('national harbor') || lower.includes('gaylord national')) return 'Washington DC';
    return null;
  }
}

module.exports = FIAScraper;
