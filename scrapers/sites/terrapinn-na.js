const BaseScraper = require('../base-scraper');
const logger = require('../utils/logger');
const { classifyIndustry } = require('../utils/industry-map');

const LISTING_URL = 'https://www.terrapinn.com/events/north-america';

class TerrapinnNAScraper extends BaseScraper {
  constructor() {
    super('TerrapinnNA');
  }

  async scrape() {
    logger.info(this.name, `Fetching listing: ${LISTING_URL}`);
    await this.page.goto(LISTING_URL, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(5000);

    // Extract event stubs from the listing page
    const stubs = await this.page.evaluate(() => {
      const items = document.querySelectorAll('li, .event-item, .event-card, article');
      const results = [];
      const seen = new Set();

      for (const item of items) {
        const link = item.querySelector('a[href*="/exhibition/"], a[href*="/conference/"], a[href*="/event/"]');
        if (!link) continue;

        const href = link.href;
        // Strip query params to avoid duplicates (e.g. ?trc=trpn-ft1)
        const slug = href.split('?')[0].split('/').filter(Boolean).pop();
        if (seen.has(slug)) continue;
        seen.add(slug);

        const title = (item.querySelector('h3, h4, h5, .event-title') || link).textContent.trim();
        if (!title || title.length < 3) continue;

        const dateEl = item.querySelector('h6, .event-date, .date, time');
        const venueEl = item.querySelector('p, .event-venue, .venue, .location');

        results.push({
          title,
          href: href.split('?')[0], // clean URL
          slug,
          dateText: dateEl ? dateEl.textContent.trim() : null,
          venueText: venueEl ? venueEl.textContent.trim() : null,
        });
      }

      return results;
    });

    logger.info(this.name, `Found ${stubs.length} event stubs on listing page`);

    const events = [];

    for (const stub of stubs) {
      try {
        await this.page.waitForTimeout(1500);
        logger.info(this.name, `Fetching detail: ${stub.href}`);
        await this.page.goto(stub.href, { waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(3000);

        // Try to extract JSON-LD structured data
        const jsonLd = await this.page.evaluate(() => {
          const scripts = document.querySelectorAll('script[type="application/ld+json"]');
          for (const script of scripts) {
            try {
              const data = JSON.parse(script.textContent);
              if (data['@type'] === 'Event') return data;
              if (Array.isArray(data)) {
                const ev = data.find(d => d['@type'] === 'Event');
                if (ev) return ev;
              }
              if (data['@graph']) {
                const ev = data['@graph'].find(d => d['@type'] === 'Event');
                if (ev) return ev;
              }
            } catch {}
          }
          return null;
        });

        // Grab page description and hero image as fallbacks
        const pageMeta = await this.page.evaluate(() => {
          const desc = document.querySelector('meta[name="description"]');
          const img = document.querySelector('.hero img, .banner img, .event-hero img');
          const ogImage = document.querySelector('meta[property="og:image"]');
          const bodyText = document.querySelector('.event-description, .about, .overview, main p')?.textContent || '';
          return {
            description: desc?.content || bodyText.substring(0, 2000),
            image: img?.src || ogImage?.content || null,
          };
        });

        let title = stub.title;
        let startDate = stub.dateText;
        let endDate = null;
        let venueName = stub.venueText;
        let venueAddress = null;
        let description = pageMeta.description || '';
        let image = pageMeta.image;
        let city = null;

        if (jsonLd) {
          title = jsonLd.name || title;
          startDate = jsonLd.startDate || startDate;
          endDate = jsonLd.endDate || null;
          description = jsonLd.description || description;
          image = jsonLd.image?.url || jsonLd.image || image;

          const loc = jsonLd.location;
          if (loc) {
            if (loc.name) venueName = loc.name;
            const addr = loc.address;
            if (typeof addr === 'string') {
              venueAddress = addr;
            } else if (addr) {
              venueAddress = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.addressCountry]
                .filter(Boolean).join(', ');
            }
          }
        }

        // Determine city from venue/address text
        const locationText = [venueName, venueAddress, stub.venueText].join(' ');
        city = this.detectCity(locationText);

        if (!city) {
          logger.info(this.name, `Skipping non-US event: ${title}`);
          continue;
        }

        events.push({
          title,
          description: description.substring(0, 5000),
          start_date: startDate,
          end_date: endDate,
          venue_name: venueName,
          venue_address: venueAddress,
          city,
          organizer: 'Terrapinn',
          industry: classifyIndustry(title + ' ' + description),
          is_free: false,
          registration_url: stub.href,
          image_url: image,
          source: 'Terrapinn',
          source_event_id: `tpna-${stub.slug}`,
        });

        logger.info(this.name, `Added: ${title} (${city})`);
      } catch (err) {
        logger.warn(this.name, `Failed to scrape detail for ${stub.title}: ${err.message}`);
      }
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

module.exports = TerrapinnNAScraper;
