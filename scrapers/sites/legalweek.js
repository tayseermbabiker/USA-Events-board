const BaseScraper = require('../base-scraper');
const logger = require('../utils/logger');

class LegalWeekScraper extends BaseScraper {
  constructor() {
    super('LegalWeek');
  }

  async scrape() {
    const url = 'https://www.event.law.com/legalweek/2026-agenda';
    logger.info(this.name, `Fetching: ${url}`);

    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(3000);

      // LegalWeek is a single major conference — extract it as one event
      // The agenda page has session details but we want the conference as a whole
      const pageText = await this.page.evaluate(() => document.body.textContent);

      // Extract date range from page content
      const dateMatch = pageText.match(/March\s+(\d+)\s*[-–]\s*(\d+),?\s*2026/i);
      const startDate = dateMatch ? `2026-03-${dateMatch[1].padStart(2, '0')}` : '2026-03-09';
      const endDate = dateMatch ? `2026-03-${dateMatch[2].padStart(2, '0')}` : '2026-03-12';

      const venueName = 'New York Hilton Midtown';

      // Count sessions/tracks for description
      const trackCount = await this.page.$$eval(
        '[class*="track"], [class*="session"], .agenda-item',
        els => els.length
      ).catch(() => 0);

      const description = `Legalweek is the largest legal technology conference in the US, featuring ${trackCount > 0 ? trackCount + '+ sessions' : 'sessions'} covering AI, legal operations, cybersecurity, and more. Bringing together legal professionals, technologists, and business leaders.`;

      const events = [{
        title: 'Legalweek 2026',
        description,
        start_date: startDate,
        end_date: endDate,
        venue_name: venueName,
        venue_address: 'New York, NY',
        city: 'New York',
        organizer: 'ALM',
        industry: 'Legal',
        is_free: false,
        registration_url: 'https://www.event.law.com/legalweek/',
        image_url: null,
        source: 'LegalWeek',
        source_event_id: 'legalweek-2026',
      }];

      logger.info(this.name, `Found: ${events[0].title} — ${startDate} to ${endDate}`);
      return events;
    } catch (err) {
      logger.warn(this.name, `Failed: ${err.message}`);
      return [];
    }
  }
}

module.exports = LegalWeekScraper;
