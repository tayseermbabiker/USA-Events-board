const { chromium } = require('playwright');
const config = require('./config');
const logger = require('./utils/logger');
const { parseDate } = require('./utils/date-parser');

// Global blocklist — casual/social events that dilute the professional brand
const SKIP_PATTERNS = [
  /\bhappy hour\b/i, /\bnetworking mixer\b/i, /\bcocktail\b/i, /\bwine down\b/i,
  /\bopen mic\b/i, /\bkaraoke\b/i, /\bpub quiz\b/i, /\bbar crawl\b/i,
  /\bspeed dating\b/i, /\bdating\b/i, /\bsingles\b/i,
  /\byoga\b/i, /\bpilates\b/i, /\bzumba\b/i, /\bmeditation retreat\b/i,
  /\bbrunch\b/i, /\bfood tour\b/i, /\bcooking class\b/i,
  /\bbook club\b/i, /\bpaint\s*(and|&|n)\s*sip\b/i,
  /\bboat\s*(party|cruise)\b/i, /\bparty\b/i, /\bnight\s*out\b/i,
  /\bkids\b/i, /\bchildren\b/i, /\bfamily fun\b/i,
  /\bdog show\b/i, /\bcat show\b/i, /\bpet expo\b/i,
  /\bcomic con\b/i, /\banime\b/i, /\bcosplay\b/i,
  /\bwedding\b/i, /\bbridal\b/i,
  /\bflea market\b/i, /\bantique\b/i, /\bcraft fair\b/i,
  /\bconcert\b/i, /\bmusic fest\b/i,
  /\btattoo\b/i, /\bfitness\b/i,
];

class BaseScraper {
  constructor(name) {
    this.name = name;
    this.browser = null;
    this.page = null;
  }

  async launch() {
    logger.info(this.name, 'Launching browser...');
    this.browser = await chromium.launch({
      headless: config.browser.headless,
    });
    const context = await this.browser.newContext({
      userAgent: config.browser.userAgent,
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
    });
    this.page = await context.newPage();
    this.page.setDefaultTimeout(config.browser.timeout);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      logger.info(this.name, 'Browser closed');
    }
  }

  /**
   * Override in subclass. Must return an array of raw event objects.
   */
  async scrape() {
    throw new Error(`${this.name}: scrape() not implemented`);
  }

  /**
   * Validate and normalize a single event object.
   * Returns null if required fields are missing.
   */
  validate(evt) {
    if (!evt.title || !evt.source || !evt.source_event_id) {
      logger.warn(this.name, `Skipping event missing required fields: ${evt.title || '(no title)'}`);
      return null;
    }

    // Global casual/social event filter
    if (SKIP_PATTERNS.some(p => p.test(evt.title))) {
      logger.info(this.name, `Skipping casual event: ${evt.title}`);
      return null;
    }

    const startDate = parseDate(evt.start_date);
    if (!startDate) {
      logger.warn(this.name, `Skipping event with bad date: ${evt.title}`);
      return null;
    }

    // Skip past events
    if (new Date(startDate) < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
      return null;
    }

    const normalizedCity = config.cityAliases?.[evt.city] || evt.city;
    const city = config.validCities.includes(normalizedCity) ? normalizedCity : null;
    const industry = config.validIndustries.includes(evt.industry) ? evt.industry : null;
    if (!industry) {
      logger.warn(this.name, `Skipping unclassified event: ${evt.title}`);
      return null;
    }

    return {
      title: evt.title.trim().substring(0, 500),
      description: (evt.description || '').trim().substring(0, 5000),
      start_date: startDate,
      end_date: parseDate(evt.end_date) || null,
      venue_name: evt.venue_name || null,
      venue_address: evt.venue_address || null,
      city: city,
      organizer: evt.organizer || null,
      industry: industry,
      is_free: Boolean(evt.is_free),
      registration_url: evt.registration_url || null,
      image_url: evt.image_url || null,
      source: evt.source,
      source_event_id: String(evt.source_event_id),
    };
  }

  /**
   * Main entry point. Never throws — returns [] on failure.
   */
  async run() {
    try {
      await this.launch();
      const raw = await this.scrape();
      logger.info(this.name, `Raw events scraped: ${raw.length}`);

      const events = raw.map(e => this.validate(e)).filter(Boolean);
      logger.info(this.name, `Valid events after filtering: ${events.length}`);
      return events;
    } catch (err) {
      logger.error(this.name, `Fatal error: ${err.message}`);
      return [];
    } finally {
      await this.close();
    }
  }
}

module.exports = BaseScraper;
