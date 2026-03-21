const BaseScraper = require('../base-scraper');
const config = require('../config');
const logger = require('../utils/logger');
const { classifyIndustry } = require('../utils/industry-map');

const LISTING_URL = 'https://www.ana.net/calendar/index';

class ANAScraper extends BaseScraper {
  constructor() {
    super('ANA');
  }

  async scrape() {
    logger.info(this.name, `Fetching listing: ${LISTING_URL}`);
    await this.page.goto(LISTING_URL, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(5000);

    const rawEvents = await this.page.evaluate(() => {
      const results = [];
      const seen = new Set();

      // Only select conference cards — skip committee, training, webinar
      const cards = document.querySelectorAll('div.card.conference');
      for (const card of cards) {
        const titleEl = card.querySelector('h2.card-title a, .card-title a');
        if (!titleEl) continue;

        const title = titleEl.textContent.trim();
        if (!title || title.length < 5 || seen.has(title)) continue;
        seen.add(title);

        const href = titleEl.href;

        // Date spans
        const dateEl = card.querySelector('span.event-date.event-day, span.event-day');
        const dateText = dateEl ? dateEl.textContent.trim() : '';

        // Location
        const infoSpans = card.querySelectorAll('span.event-info');
        let locationText = '';
        for (const span of infoSpans) {
          const text = span.textContent.trim();
          // Skip the date span and time span
          if (text.includes('202') && !text.includes(',')) continue;
          if (/^\d{1,2}:\d{2}/.test(text)) continue;
          if (text.length > 3 && !text.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/)) {
            locationText = text;
          }
        }

        // Get all text for location fallback
        const fullText = card.textContent || '';

        results.push({ title, href, dateText, locationText, fullText });
      }

      return results;
    });

    logger.info(this.name, `Found ${rawEvents.length} conference events`);

    const events = [];

    for (const raw of rawEvents) {
      // Skip virtual events
      if (/virtual|webinar|online/i.test(raw.locationText)) {
        logger.info(this.name, `Skipping virtual event: ${raw.title}`);
        continue;
      }

      const city = this.detectCity(raw.locationText + ' ' + raw.fullText);
      if (!city) {
        logger.info(this.name, `Skipping non-target city: ${raw.title} (${raw.locationText})`);
        continue;
      }

      const { startDate, endDate } = this.parseDateRange(raw.dateText + ' ' + raw.fullText);

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
        organizer: 'ANA',
        industry: classifyIndustry(raw.title, 'Marketing'),
        is_free: false,
        registration_url: raw.href || LISTING_URL,
        image_url: null,
        source: 'ANA',
        source_event_id: `ana-${slug}`,
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
    if (lower.includes('san diego')) return 'Los Angeles';
    if (lower.includes('new york') || lower.includes('nyc') || lower.includes('manhattan')) return 'New York';
    if (lower.includes('brooklyn')) return 'Brooklyn';
    if (lower.includes('los angeles') || lower.includes(' la,') || lower.includes(' la ')) return 'Los Angeles';
    if (lower.includes('miami')) return 'Miami';
    if (lower.includes('chicago')) return 'Chicago';
    if (lower.includes('seattle')) return 'Seattle';
    if (lower.includes('denver')) return 'Denver';
    if (lower.includes('boston')) return 'Boston';
    if (lower.includes('washington') || lower.includes(' dc') || lower.includes('oxon hill') || lower.includes('national harbor')) return 'Washington DC';
    if (lower.includes('nashville')) return 'Austin'; // closest major city mapping
    return null;
  }
}

module.exports = ANAScraper;
