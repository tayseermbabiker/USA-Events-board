const BaseScraper = require('../base-scraper');
const logger = require('../utils/logger');
const { classifyIndustry } = require('../utils/industry-map');

// Luma discover pages per city (luma.com/{slug}?k=p)
const CITY_PAGES = [
  { city: 'Austin',        url: 'https://luma.com/austin?k=p' },
  { city: 'San Francisco', url: 'https://luma.com/sf?k=p' },
  { city: 'New York',      url: 'https://luma.com/nyc?k=p' },
  { city: 'Miami',         url: 'https://luma.com/miami?k=p' },
];

class LumaScraper extends BaseScraper {
  constructor() {
    super('Luma');
  }

  async scrape() {
    const allEvents = [];

    for (const { city, url } of CITY_PAGES) {
      logger.info(this.name, `--- Scraping ${city} ---`);
      logger.info(this.name, `Fetching: ${url}`);

      try {
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(3000);

        // Extract __NEXT_DATA__ JSON
        const events = await this.extractFromNextData(city);
        if (events.length > 0) {
          logger.info(this.name, `${city}: ${events.length} events from __NEXT_DATA__`);
          allEvents.push(...events);
          continue;
        }

        // Fallback: try DOM extraction
        const domEvents = await this.extractFromDom(city);
        logger.info(this.name, `${city}: ${domEvents.length} events from DOM`);
        allEvents.push(...domEvents);
      } catch (err) {
        logger.warn(this.name, `${city} failed: ${err.message}`);
      }
    }

    return allEvents;
  }

  async extractFromNextData(defaultCity) {
    try {
      const nextData = await this.page.evaluate(() => {
        const el = document.getElementById('__NEXT_DATA__');
        if (!el) return null;
        try { return JSON.parse(el.textContent); } catch { return null; }
      });

      if (!nextData) return [];

      const initialData = nextData.props?.pageProps?.initialData;
      if (!initialData) return [];

      // Events at initialData.data.events[] or initialData.data.featured_events[]
      const eventEntries = initialData.data?.events || initialData.data?.featured_events || initialData.events || [];
      const events = [];

      for (const entry of eventEntries) {
        const ev = entry.event || entry;
        if (!ev.name || !ev.start_at) continue;

        const hosts = entry.hosts || [];
        const ticketInfo = entry.ticket_info || {};
        const ticketTypes = ev.ticket_types || [];

        const geoInfo = ev.geo_address_info || {};
        const city = this.detectCity(geoInfo.city || geoInfo.region || '') || defaultCity;

        const isFree = ticketInfo.is_free === true
          || ticketInfo.price?.cents === 0
          || ticketTypes.some(t => t.type === 'free')
          || /free/i.test(ev.name);

        events.push({
          title: ev.name,
          description: this.extractDescription(ev.description_mirror) || ev.description || '',
          start_date: ev.start_at,
          end_date: ev.end_at || null,
          venue_name: geoInfo.address || null,
          venue_address: geoInfo.full_address || geoInfo.short_address || null,
          city,
          organizer: hosts.map(h => h.name).filter(Boolean).join(', ') || null,
          industry: classifyIndustry(`${ev.name} ${this.extractDescription(ev.description_mirror) || ''}`),
          is_free: Boolean(isFree),
          registration_url: ev.url ? `https://lu.ma/${ev.url}` : null,
          image_url: ev.cover_url || null,
          source: 'Luma',
          source_event_id: `luma-${ev.api_id || ev.url || Math.random().toString(36).substring(2, 10)}`,
        });
      }

      return events;
    } catch (err) {
      logger.warn(this.name, `__NEXT_DATA__ extraction failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Extract plain text from Luma's description_mirror (rich text format).
   */
  extractDescription(mirror) {
    if (!mirror) return '';
    if (typeof mirror === 'string') return mirror;

    try {
      const texts = [];
      const walk = (node) => {
        if (node.text) texts.push(node.text);
        if (node.content) node.content.forEach(walk);
      };
      walk(mirror);
      return texts.join(' ').trim();
    } catch {
      return '';
    }
  }

  async extractFromDom(defaultCity) {
    const events = [];

    // Luma uses .content-card class for event cards with h3 for titles
    const cards = await this.page.$$('.content-card');
    const seen = new Set();

    for (const card of cards) {
      try {
        const title = await card.$eval('h3', el => el.textContent.trim()).catch(() => null);
        if (!title || seen.has(title)) continue;
        seen.add(title);

        const link = await card.$eval('a[href]', el => el.href).catch(() => null);
        const img = await card.$eval('img', el => el.src).catch(() => null);
        const text = await card.evaluate(el => el.textContent).catch(() => '');

        // Skip calendar/category links (contain ?k=c or ?k=t)
        if (!link || link.includes('?k=')) continue;
        const slug = link.split('/').filter(Boolean).pop();

        events.push({
          title,
          description: '',
          start_date: null, // DOM doesn't expose parseable dates
          end_date: null,
          venue_name: null,
          venue_address: null,
          city: this.detectCity(text) || defaultCity,
          organizer: null,
          industry: classifyIndustry(title),
          is_free: /free/i.test(text),
          registration_url: link,
          image_url: img,
          source: 'Luma',
          source_event_id: `luma-${slug}`,
        });
      } catch { /* skip */ }
    }

    return events;
  }

  detectCity(text) {
    const lower = (text || '').toLowerCase();
    if (lower.includes('austin')) return 'Austin';
    if (lower.includes('san francisco')) return 'San Francisco';
    if (lower.includes('san jose')) return 'San Jose';
    if (lower.includes('oakland')) return 'Oakland';
    if (lower.includes('new york') || lower.includes('nyc') || lower.includes('manhattan')) return 'New York';
    if (lower.includes('brooklyn')) return 'Brooklyn';
    if (lower.includes('los angeles')) return 'Los Angeles';
    if (lower.includes('miami')) return 'Miami';
    if (lower.includes('chicago')) return 'Chicago';
    if (lower.includes('seattle')) return 'Seattle';
    if (lower.includes('denver')) return 'Denver';
    if (lower.includes('boston')) return 'Boston';
    if (lower.includes('washington')) return 'Washington DC';
    return null;
  }
}

module.exports = LumaScraper;
