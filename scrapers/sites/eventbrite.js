const BaseScraper = require('../base-scraper');
const config = require('../config');
const logger = require('../utils/logger');
const { classifyIndustry } = require('../utils/industry-map');

const MAX_PAGES = 5;

// Skip casual/amateur events that dilute the professional brand
const SKIP_PATTERNS = [
  /\bopen mic\b/i, /\bkaraoke\b/i, /\bpub quiz\b/i, /\bbar crawl\b/i,
  /\bspeed dating\b/i, /\bdating\b/i, /\bsingles\b/i,
  /\byoga\b/i, /\bpilates\b/i, /\bzumba\b/i, /\bmeditation\b/i,
  /\bbrunch\b/i, /\bfood tour\b/i, /\bcooking class\b/i,
  /\bbook club\b/i, /\bpaint\s*(and|&|n)\s*sip\b/i,
  /\bdesert safari\b/i, /\bcity tour\b/i, /\bboat\s*(party|cruise)\b/i,
  /\bparty\b/i, /\bnight\s*out\b/i, /\bhappy hour\b/i,
  /\bkids\b/i, /\bchildren\b/i, /\bfamily fun\b/i,
];

// Eventbrite search URLs per city
const CITY_URLS = config.cities.map(city => ({
  city,
  url: `https://www.eventbrite.com/d/${city.toLowerCase().replace(/\s+/g, '-')}/business--events/`,
}));

class EventbriteScraper extends BaseScraper {
  constructor() {
    super('Eventbrite');
  }

  async scrape() {
    const events = [];

    for (const { city, url } of CITY_URLS) {
      logger.info(this.name, `--- Scraping ${city} ---`);

      for (let page = 1; page <= MAX_PAGES; page++) {
        const pageUrl = page === 1 ? url : `${url}?page=${page}`;
        logger.info(this.name, `Fetching page ${page}: ${pageUrl}`);

        try {
          await this.page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
          await this.page.waitForTimeout(2000);

          // Try JSON-LD first
          const jsonLd = await this.page.$$eval(
            'script[type="application/ld+json"]',
            scripts => scripts.map(s => {
              try { return JSON.parse(s.textContent); } catch { return null; }
            }).filter(Boolean)
          );

          const ldEvents = [];
          for (const item of jsonLd.flat()) {
            if (item['@type'] === 'Event') {
              ldEvents.push(item);
            } else if (item['@graph']) {
              ldEvents.push(...item['@graph'].filter(g => g['@type'] === 'Event'));
            } else if (Array.isArray(item.itemListElement)) {
              for (const entry of item.itemListElement) {
                const nested = entry.item || entry;
                if (nested['@type'] === 'Event') ldEvents.push(nested);
              }
            }
          }

          if (ldEvents.length > 0) {
            for (const ev of ldEvents) {
              events.push(this.parseJsonLd(ev));
            }
            logger.info(this.name, `Page ${page}: ${ldEvents.length} events from JSON-LD`);
          } else {
            const domEvents = await this.extractFromDom();
            events.push(...domEvents);
            logger.info(this.name, `Page ${page}: ${domEvents.length} events from DOM`);
          }

          // Check if there's a next page
          const hasNext = await this.page.$('button[data-testid="pagination-next"]:not([disabled]), a[data-testid="pagination-next"]');
          if (!hasNext && page < MAX_PAGES) {
            logger.info(this.name, `No more pages after page ${page}`);
            break;
          }
        } catch (err) {
          logger.warn(this.name, `Page ${page} failed: ${err.message}`);
          break;
        }
      }
    }

    // Filter: paid events only + skip casual patterns
    const filtered = events.filter(ev => {
      if (ev.is_free) {
        logger.info(this.name, `Skipping free event: ${ev.title}`);
        return false;
      }
      if (SKIP_PATTERNS.some(p => p.test(ev.title))) {
        logger.info(this.name, `Skipping casual event: ${ev.title}`);
        return false;
      }
      return true;
    });

    logger.info(this.name, `${filtered.length} events after filtering (${events.length - filtered.length} removed)`);
    return filtered;
  }

  parseJsonLd(ev) {
    const location = ev.location || {};
    const address = location.address || {};
    const city = this.detectCity(
      `${address.addressLocality || ''} ${address.addressRegion || ''}`
    );

    return {
      title: ev.name,
      description: ev.description || '',
      start_date: ev.startDate,
      end_date: ev.endDate || null,
      venue_name: location.name || null,
      venue_address: address.streetAddress || null,
      city,
      organizer: ev.organizer?.name || location.name || null,
      industry: classifyIndustry(`${ev.name} ${ev.description || ''}`),
      is_free: ev.isAccessibleForFree === true || (ev.offers && ev.offers.price === 0) || /free/i.test(`${ev.name} ${ev.description || ''}`),
      registration_url: ev.url,
      image_url: typeof ev.image === 'string' ? ev.image : ev.image?.url || null,
      source: 'Eventbrite',
      source_event_id: `eb-${this.extractId(ev.url)}`,
    };
  }

  async extractFromDom() {
    const cards = await this.page.$$('[data-testid="event-card"], .search-event-card-wrapper, .eds-event-card-content');
    const events = [];

    for (const card of cards) {
      try {
        const title = await card.$eval('h2, h3, [data-testid="event-card-title"]', el => el.textContent.trim()).catch(() => null);
        const link = await card.$eval('a[href*="/e/"]', el => el.href).catch(() => null);
        const dateText = await card.$eval('p, [data-testid="event-card-date"]', el => el.textContent.trim()).catch(() => null);
        const img = await card.$eval('img', el => el.src).catch(() => null);

        if (title && link) {
          events.push({
            title,
            description: '',
            start_date: dateText,
            end_date: null,
            venue_name: null,
            venue_address: null,
            city: null,
            organizer: null,
            industry: classifyIndustry(title),
            is_free: /free/i.test(title),
            registration_url: link,
            image_url: img,
            source: 'Eventbrite',
            source_event_id: `eb-${this.extractId(link)}`,
          });
        }
      } catch { /* skip card */ }
    }

    return events;
  }

  extractId(url) {
    if (!url) return Math.random().toString(36).substring(2, 10);
    const match = url.match(/(\d{10,})/);
    return match ? match[1] : url.split('/').filter(Boolean).pop();
  }

  detectCity(text) {
    const lower = (text || '').toLowerCase();
    if (lower.includes('austin')) return 'Austin';
    if (lower.includes('san francisco') || lower.includes('sf')) return 'San Francisco';
    if (lower.includes('san jose')) return 'San Jose';
    if (lower.includes('oakland')) return 'Oakland';
    if (lower.includes('new york') || lower.includes('nyc') || lower.includes('manhattan')) return 'New York';
    if (lower.includes('brooklyn')) return 'Brooklyn';
    if (lower.includes('los angeles') || lower.includes(' la ')) return 'Los Angeles';
    if (lower.includes('miami')) return 'Miami';
    if (lower.includes('chicago')) return 'Chicago';
    if (lower.includes('seattle')) return 'Seattle';
    if (lower.includes('denver')) return 'Denver';
    if (lower.includes('boston')) return 'Boston';
    if (lower.includes('washington') || lower.includes(' dc')) return 'Washington DC';
    return null;
  }
}

module.exports = EventbriteScraper;
