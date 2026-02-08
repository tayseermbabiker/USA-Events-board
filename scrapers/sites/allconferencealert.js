const BaseScraper = require('../base-scraper');
const logger = require('../utils/logger');
const { classifyIndustry } = require('../utils/industry-map');
const config = require('../config');

// City pages to scrape
const CITY_PAGES = config.cities.map(city => ({
  city,
  url: `https://www.allconferencealert.com/${city.toLowerCase().replace(/\s+/g, '-')}.html`,
}));

class AllConferenceAlertScraper extends BaseScraper {
  constructor() {
    super('AllConferenceAlert');
  }

  async scrape() {
    const allEvents = [];
    const seen = new Set();

    for (const { city, url } of CITY_PAGES) {
      logger.info(this.name, `--- Scraping ${city} ---`);
      logger.info(this.name, `Fetching: ${url}`);

      try {
        // Navigate to the city page — this triggers the JS API call
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(4000);

        // Extract events from rendered DOM
        const events = await this.page.evaluate(() => {
          const cards = document.querySelectorAll('.bg-white.mb-4, .dark\\:bg-darkCard.mb-4');
          const results = [];

          for (const card of cards) {
            const titleEl = card.querySelector('h3 a, .event-name a');
            const timeEl = card.querySelector('time[itemprop="startDate"]');
            const spans = card.querySelectorAll('span.inline-flex');

            let location = '';
            let dateText = '';
            let topic = '';

            for (const span of spans) {
              const text = span.textContent.trim();
              if (span.querySelector('.fa-map-marker-alt')) location = text;
              if (span.querySelector('.fa-calendar-alt')) dateText = text;
              if (span.querySelector('.fa-book-bookmark')) topic = text;
            }

            if (titleEl) {
              results.push({
                title: titleEl.textContent.trim(),
                link: titleEl.href || '',
                date: timeEl ? timeEl.getAttribute('datetime') : dateText,
                location,
                topic,
              });
            }
          }

          return results;
        });

        for (const ev of events) {
          if (seen.has(ev.title)) continue;
          seen.add(ev.title);

          allEvents.push({
            title: ev.title,
            description: ev.topic ? `Topic: ${ev.topic}` : '',
            start_date: ev.date || null,
            end_date: null,
            venue_name: null,
            venue_address: ev.location || null,
            city,
            organizer: null,
            industry: classifyIndustry(`${ev.title} ${ev.topic || ''}`),
            is_free: false,
            registration_url: ev.link || null,
            image_url: null,
            source: 'AllConferenceAlert',
            source_event_id: `aca-${ev.link ? ev.link.split('/').filter(Boolean).pop().replace('.html', '') : ev.title.toLowerCase().replace(/\s+/g, '-').substring(0, 50)}`,
          });
        }

        logger.info(this.name, `${city}: ${events.length} events`);
      } catch (err) {
        logger.warn(this.name, `${city} failed: ${err.message}`);
      }
    }

    return allEvents;
  }
}

module.exports = AllConferenceAlertScraper;
