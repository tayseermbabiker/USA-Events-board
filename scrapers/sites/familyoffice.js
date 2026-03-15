const BaseScraper = require('../base-scraper');
const config = require('../config');
const logger = require('../utils/logger');
const { classifyIndustry } = require('../utils/industry-map');

const LISTING_URL = 'https://www.familyoffice.com/events';

class FamilyOfficeScraper extends BaseScraper {
  constructor() {
    super('FamilyOffice');
  }

  async scrape() {
    logger.info(this.name, `Fetching listing: ${LISTING_URL}`);
    await this.page.goto(LISTING_URL, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(3000);

    const rawEvents = await this.page.evaluate(() => {
      const results = [];
      const seen = new Set();

      // Try card-based selectors first
      const cards = document.querySelectorAll('.card_grid_thumbnail_552x552, .card, .event-card, article, .views-row');
      for (const card of cards) {
        const titleEl = card.querySelector('h2, h3, h4, h5');
        const linkEl = card.querySelector('a[href*="/learning-programs/"], a[href*="/events/"], a[href]');
        if (!titleEl && !linkEl) continue;

        const title = titleEl ? titleEl.textContent.trim() : (linkEl ? linkEl.textContent.trim() : '');
        if (!title || title.length < 5) continue;
        if (/read more|learn more|view all|register/i.test(title)) continue;
        if (seen.has(title)) continue;
        seen.add(title);

        const href = linkEl ? linkEl.href : '';
        const fullText = card.textContent || '';
        const img = card.querySelector('img');
        const image = img ? (img.src || img.dataset.src) : null;

        results.push({ title, fullText, href, image });
      }

      // Fallback: find links to learning-programs or events
      if (results.length === 0) {
        const links = document.querySelectorAll('a[href*="/learning-programs/"], a[href*="/events/"]');
        for (const link of links) {
          const title = link.textContent.trim();
          if (!title || title.length < 5) continue;
          if (/read more|learn more|view all|register/i.test(title)) continue;
          if (seen.has(title)) continue;
          seen.add(title);

          let container = link.parentElement;
          for (let i = 0; i < 4 && container; i++) {
            if (container.textContent.length > title.length + 20) break;
            container = container.parentElement;
          }

          const fullText = container ? container.textContent : '';
          results.push({ title, fullText, href: link.href, image: null });
        }
      }

      return results;
    });

    logger.info(this.name, `Found ${rawEvents.length} raw events`);

    const events = [];

    for (const raw of rawEvents) {
      // Skip webinars without a location — keep summits and forums
      const isWebinar = /webinar/i.test(raw.title) || /webinar/i.test(raw.fullText);

      let city = this.detectCity(raw.fullText);

      // For summits/forums with no detected city, try the detail page
      if (!city && !isWebinar) {
        logger.info(this.name, `Skipping non-US-city event: ${raw.title}`);
        continue;
      }

      if (!city && isWebinar) {
        // Skip webinars — no city means online, not relevant for in-person
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
        organizer: 'Family Office Exchange',
        industry: classifyIndustry(raw.title, 'Finance'),
        is_free: false,
        registration_url: raw.href || LISTING_URL,
        image_url: raw.image,
        source: 'Family Office Exchange',
        source_event_id: `fox-${slug}`,
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

module.exports = FamilyOfficeScraper;
