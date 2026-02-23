const BaseScraper = require('../base-scraper');
const logger = require('../utils/logger');
const { classifyIndustry } = require('../utils/industry-map');

const LISTING_URL = 'https://javitscenter.com/events/';

// Consumer/non-professional events to skip
const SKIP_PATTERNS = [
  /\bdog show\b/i, /\bwestminster\b/i, /\bcat show\b/i, /\bpet expo\b/i,
  /\bcomic con\b/i, /\banime\b/i, /\bcosplay\b/i,
  /\bboat show\b/i, /\bauto show\b/i, /\bcar show\b/i, /\bmotorcycle\b/i,
  /\bwedding\b/i, /\bbridal\b/i,
  /\btoy fair\b/i, /\bgame con\b/i,
  /\bfood fest\b/i, /\bwine\s*(and|&)\s*food\b/i, /\bchocolate\b/i,
  /\bflower show\b/i, /\bgarden\b/i,
  /\bcraft fair\b/i, /\bflea market\b/i, /\bantique\b/i,
  /\btatoo\b/i, /\btattoo\b/i,
  /\bfitness\b/i, /\bmarathon\b/i, /\bsport\b/i,
  /\bconcert\b/i, /\bmusic fest\b/i,
  /\bchristmas\b/i, /\bholiday market\b/i,
];

class JavitsScraper extends BaseScraper {
  constructor() {
    super('Javits');
  }

  async scrape() {
    logger.info(this.name, `Fetching listing: ${LISTING_URL}`);
    await this.page.goto(LISTING_URL, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(3000);

    // Extract events from the page
    const rawEvents = await this.page.evaluate(() => {
      const results = [];
      const seen = new Set();

      // Strategy: find "Find Out More" links and walk up to parent containers
      const links = document.querySelectorAll('a');
      for (const link of links) {
        const linkText = link.textContent.trim().toLowerCase();
        if (!linkText.includes('find out more') && !linkText.includes('learn more') &&
            !linkText.includes('event details') && !linkText.includes('more info')) continue;

        const href = link.href;
        if (!href || seen.has(href)) continue;
        seen.add(href);

        // Walk up to find the event container (typically a card/row/article)
        let container = link.parentElement;
        for (let i = 0; i < 5 && container; i++) {
          const hasTitle = container.querySelector('h2, h3, h4, h5, .event-title, .title');
          if (hasTitle) break;
          container = container.parentElement;
        }

        if (!container) continue;

        const titleEl = container.querySelector('h2, h3, h4, h5, .event-title, .title');
        const title = titleEl ? titleEl.textContent.trim() : null;
        if (!title) continue;

        // Look for date text in the container
        const allText = container.textContent;
        const dateText = allText || '';

        // Try to find image
        const imgEl = container.querySelector('img');
        const image = imgEl ? (imgEl.src || imgEl.dataset.src) : null;

        results.push({ title, dateText, href, image });
      }

      // Fallback: try generic card/event selectors if "Find Out More" didn't work
      if (results.length === 0) {
        const cards = document.querySelectorAll('.event-card, .event-item, .event-listing, article, .card');
        for (const card of cards) {
          const titleEl = card.querySelector('h2, h3, h4, h5, .event-title, .title');
          const linkEl = card.querySelector('a[href]');
          if (!titleEl || !linkEl) continue;

          const title = titleEl.textContent.trim();
          const href = linkEl.href;
          if (!title || seen.has(href)) continue;
          seen.add(href);

          const dateText = card.textContent || '';
          const imgEl = card.querySelector('img');
          const image = imgEl ? (imgEl.src || imgEl.dataset.src) : null;

          results.push({ title, dateText, href, image });
        }
      }

      return results;
    });

    logger.info(this.name, `Found ${rawEvents.length} raw events on page`);

    const events = [];

    for (const raw of rawEvents) {
      // Skip consumer events
      if (SKIP_PATTERNS.some(p => p.test(raw.title))) {
        logger.info(this.name, `Skipping consumer event: ${raw.title}`);
        continue;
      }

      const { startDate, endDate } = this.parseDateRange(raw.dateText);
      const industry = classifyIndustry(raw.title);

      // classifyIndustry is the KEY quality filter — skip unclassified
      if (!industry) {
        logger.info(this.name, `Skipping unclassified event: ${raw.title}`);
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
        start_date: startDate,
        end_date: endDate,
        venue_name: 'Jacob K. Javits Convention Center',
        venue_address: '429 11th Ave, New York, NY 10001',
        city: 'New York',
        organizer: null,
        industry,
        is_free: false,
        registration_url: raw.href,
        image_url: raw.image,
        source: 'Javits Center',
        source_event_id: `javits-${slug}`,
      });

      logger.info(this.name, `Added: ${raw.title} (${industry})`);
    }

    return events;
  }

  /**
   * Parse date ranges like:
   *   "Feb 24 - Feb 26, 2026"
   *   "March 3 - 5, 2026"
   *   "April 15, 2026"
   *   "Jan 28 - Feb 1, 2026"
   */
  parseDateRange(text) {
    if (!text) return { startDate: null, endDate: null };

    const months = {
      jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
      apr: '04', april: '04', may: '05', jun: '06', june: '06',
      jul: '07', july: '07', aug: '08', august: '08', sep: '09', september: '09',
      oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12',
    };

    // Pattern: "Mon DD - Mon DD, YYYY" or "Mon DD - DD, YYYY" or "Mon DD, YYYY"
    const rangeMatch = text.match(
      /(\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b)\s+(\d{1,2})\s*[-–]\s*(?:(\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b)\s+)?(\d{1,2})\s*,?\s*(\d{4})/i
    );

    if (rangeMatch) {
      const startMonth = months[rangeMatch[1].toLowerCase().substring(0, 3)];
      const startDay = rangeMatch[2].padStart(2, '0');
      const endMonthRaw = rangeMatch[3];
      const endDay = rangeMatch[4].padStart(2, '0');
      const year = rangeMatch[5];
      const endMonth = endMonthRaw ? months[endMonthRaw.toLowerCase().substring(0, 3)] : startMonth;

      return {
        startDate: `${year}-${startMonth}-${startDay}`,
        endDate: `${year}-${endMonth}-${endDay}`,
      };
    }

    // Single date: "Mon DD, YYYY"
    const singleMatch = text.match(
      /(\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b)\s+(\d{1,2})\s*,?\s*(\d{4})/i
    );

    if (singleMatch) {
      const month = months[singleMatch[1].toLowerCase().substring(0, 3)];
      const day = singleMatch[2].padStart(2, '0');
      const year = singleMatch[3];

      return {
        startDate: `${year}-${month}-${day}`,
        endDate: null,
      };
    }

    return { startDate: null, endDate: null };
  }
}

module.exports = JavitsScraper;
