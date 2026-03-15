const BaseScraper = require('../base-scraper');
const config = require('../config');
const logger = require('../utils/logger');
const { classifyIndustry } = require('../utils/industry-map');

const LISTING_URL = 'https://www.acg.org/events';
const MAX_PAGES = 5;

// ACG has tons of local chapter casual events — only keep professional conferences
const PROFESSIONAL_TYPES = [
  /\bconference\b/i, /\bsummit\b/i, /\bforum\b/i, /\bsymposium\b/i,
  /\bcapital\s*connection\b/i, /\bdeal\s*source\b/i, /\bdealsource\b/i,
  /\bgrowth\s*conference\b/i, /\bm&a\b/i, /\bmerger/i, /\bacquisition/i,
  /\bprivate\s*equity\b/i, /\binvestor\b/i, /\bcapital\s*markets\b/i,
  /\bintergrouth\b/i,
];

class ACGScraper extends BaseScraper {
  constructor() {
    super('ACG');
  }

  async scrape() {
    const allRawEvents = [];

    for (let page = 0; page < MAX_PAGES; page++) {
      const url = page === 0 ? LISTING_URL : `${LISTING_URL}?page=${page}`;
      logger.info(this.name, `Fetching page ${page}: ${url}`);

      try {
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(3000);

        const rawEvents = await this.page.evaluate(() => {
          const results = [];
          const seen = new Set();

          const links = document.querySelectorAll('a[href*="/events/"]');
          for (const link of links) {
            const title = link.textContent.trim();
            if (!title || title.length < 5) continue;
            if (/read more|learn more|view all|register/i.test(title)) continue;
            if (seen.has(title)) continue;
            seen.add(title);

            const href = link.href;

            // Walk up to find container with date/location
            let container = link.parentElement;
            for (let i = 0; i < 5 && container; i++) {
              if (container.textContent.length > title.length + 20) break;
              container = container.parentElement;
            }

            const fullText = container ? container.textContent : '';

            results.push({ title, fullText, href });
          }

          return results;
        });

        allRawEvents.push(...rawEvents);

        // Check for next page
        const hasNext = await this.page.$('a[title="Go to next page"], li.pager__item--next a');
        if (!hasNext) {
          logger.info(this.name, `No more pages after page ${page}`);
          break;
        }
      } catch (err) {
        logger.warn(this.name, `Page ${page} failed: ${err.message}`);
        break;
      }
    }

    logger.info(this.name, `Found ${allRawEvents.length} total raw events`);

    // Deduplicate
    const seen = new Set();
    const deduped = allRawEvents.filter(e => {
      if (seen.has(e.title)) return false;
      seen.add(e.title);
      return true;
    });

    const events = [];

    for (const raw of deduped) {
      // Only keep professional conferences, skip chapter socials
      const isProfessional = PROFESSIONAL_TYPES.some(p => p.test(raw.title));
      if (!isProfessional) {
        continue;
      }

      const city = this.detectCity(raw.fullText);
      if (!city) {
        logger.info(this.name, `Skipping non-US-city event: ${raw.title}`);
        continue;
      }

      const { startDate, endDate } = this.parseDateRange(raw.fullText);

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
        venue_name: null,
        venue_address: null,
        city,
        organizer: 'ACG',
        industry: classifyIndustry(raw.title, 'Finance'),
        is_free: false,
        registration_url: raw.href,
        image_url: null,
        source: 'ACG',
        source_event_id: `acg-${slug}`,
      });

      logger.info(this.name, `Added: ${raw.title} (${city})`);
    }

    return events;
  }

  parseDateRange(text) {
    if (!text) return { startDate: null, endDate: null };

    const months = {
      jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
      apr: '04', april: '04', may: '05', jun: '06', june: '06',
      jul: '07', july: '07', aug: '08', august: '08', sep: '09', september: '09',
      oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12',
    };

    const rangeMatch = text.match(
      /(\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b)\s+(\d{1,2})\s*[-–,]\s*(?:(\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b)\s+)?(\d{1,2})\s*,?\s*(\d{4})/i
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

    const singleMatch = text.match(
      /(\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b)\s+(\d{1,2})\s*,?\s*(\d{4})/i
    );

    if (singleMatch) {
      const month = months[singleMatch[1].toLowerCase().substring(0, 3)];
      const day = singleMatch[2].padStart(2, '0');
      const year = singleMatch[3];
      return { startDate: `${year}-${month}-${day}`, endDate: null };
    }

    return { startDate: null, endDate: null };
  }

  detectCity(text) {
    const lower = (text || '').toLowerCase();
    if (lower.includes('austin')) return 'Austin';
    if (lower.includes('san francisco') || lower.includes(' sf')) return 'San Francisco';
    if (lower.includes('new york') || lower.includes('nyc') || lower.includes('manhattan')) return 'New York';
    if (lower.includes('brooklyn')) return 'Brooklyn';
    if (lower.includes('los angeles') || lower.includes(' la,') || lower.includes(' la ')) return 'Los Angeles';
    if (lower.includes('miami') || lower.includes('ft. lauderdale') || lower.includes('fort lauderdale')) return 'Miami';
    if (lower.includes('chicago')) return 'Chicago';
    if (lower.includes('seattle')) return 'Seattle';
    if (lower.includes('denver')) return 'Denver';
    if (lower.includes('boston')) return 'Boston';
    if (lower.includes('washington') || lower.includes(' dc')) return 'Washington DC';
    return null;
  }
}

module.exports = ACGScraper;
