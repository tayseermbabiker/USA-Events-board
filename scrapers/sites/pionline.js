const BaseScraper = require('../base-scraper');
const config = require('../config');
const logger = require('../utils/logger');
const { classifyIndustry } = require('../utils/industry-map');

const LISTING_URL = 'https://www.pionline.com/conferences';

class PionlineScraper extends BaseScraper {
  constructor() {
    super('Pionline');
  }

  async scrape() {
    logger.info(this.name, `Fetching listing: ${LISTING_URL}`);
    await this.page.goto(LISTING_URL, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(5000);

    const rawEvents = await this.page.evaluate(() => {
      const results = [];
      const seen = new Set();

      // P&I uses h3 > a for titles, text nodes for dates, cvent.me links for registration
      const titleLinks = document.querySelectorAll('h3 > a');
      for (const link of titleLinks) {
        const title = link.textContent.trim();
        if (!title || title.length < 5 || seen.has(title)) continue;
        seen.add(title);

        const href = link.href;
        const h3 = link.parentElement;
        const container = h3.parentElement;
        if (!container) continue;

        // Get all text content from the container for date/location parsing
        const fullText = container.textContent || '';

        // Look for registration link (cvent.me)
        const regLink = container.querySelector('a[href*="cvent"]');
        const regUrl = regLink ? regLink.href : href;

        // Look for image
        const img = container.querySelector('img');
        const image = img ? (img.src || img.dataset.src) : null;

        results.push({ title, fullText, href, regUrl, image });
      }

      return results;
    });

    logger.info(this.name, `Found ${rawEvents.length} raw events`);

    const events = [];

    for (const raw of rawEvents) {
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
        organizer: 'Pensions & Investments',
        industry: classifyIndustry(raw.title, 'Finance'),
        is_free: false,
        registration_url: raw.regUrl || raw.href,
        image_url: raw.image,
        source: 'Pensions & Investments',
        source_event_id: `pi-${slug}`,
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

    // "March 15-17, 2026" or "October 6-8, 2026"
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

    // Single date: "March 15, 2026"
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

module.exports = PionlineScraper;
