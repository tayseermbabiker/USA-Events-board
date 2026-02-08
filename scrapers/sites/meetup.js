const BaseScraper = require('../base-scraper');
const config = require('../config');
const logger = require('../utils/logger');
const { classifyIndustry } = require('../utils/industry-map');

const MAX_SCROLLS = 10;

// Meetup search URLs per city (categoryId 546 = Science & Tech)
const CITY_SEARCHES = [
  { city: 'Austin',        url: 'https://www.meetup.com/find/?location=us--tx--austin&source=EVENTS&categoryId=546' },
  { city: 'San Francisco', url: 'https://www.meetup.com/find/?location=us--ca--san-francisco&source=EVENTS&categoryId=546' },
  { city: 'New York',      url: 'https://www.meetup.com/find/?location=us--ny--new-york&source=EVENTS&categoryId=546' },
  { city: 'Miami',         url: 'https://www.meetup.com/find/?location=us--fl--miami&source=EVENTS&categoryId=546' },
];

class MeetupScraper extends BaseScraper {
  constructor() {
    super('Meetup');
  }

  async scrape() {
    const allEvents = [];

    for (const { city, url } of CITY_SEARCHES) {
      logger.info(this.name, `--- Scraping ${city} ---`);
      logger.info(this.name, `Fetching: ${url}`);

      try {
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(3000);

        // Try Apollo state first
        let events = await this.extractFromApollo(city);
        if (events.length > 0) {
          logger.info(this.name, `Got ${events.length} events from Apollo state`);
        }

        // Scroll to load more events
        let prevCount = events.length;
        for (let i = 0; i < MAX_SCROLLS; i++) {
          await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await this.page.waitForTimeout(2000);

          const moreEvents = await this.extractFromApollo(city);
          if (moreEvents.length > prevCount) {
            events = moreEvents;
            prevCount = events.length;
            logger.info(this.name, `Scroll ${i + 1}: total ${events.length} events`);
          } else {
            const showMore = await this.page.$('button:has-text("Show more"), button:has-text("Load more")');
            if (showMore) {
              try {
                await showMore.click();
                await this.page.waitForTimeout(2000);
                const afterClick = await this.extractFromApollo(city);
                if (afterClick.length > prevCount) {
                  events = afterClick;
                  prevCount = events.length;
                  continue;
                }
              } catch { /* button click failed */ }
            }
            break;
          }
        }

        // If Apollo didn't work, fall back to DOM
        if (events.length === 0) {
          events = await this.extractFromDom(city);
          logger.info(this.name, `Got ${events.length} events from DOM`);
        }

        allEvents.push(...events);
      } catch (err) {
        logger.warn(this.name, `${city} failed: ${err.message}`);
      }
    }

    return allEvents;
  }

  async extractFromApollo(defaultCity) {
    try {
      const apolloState = await this.page.evaluate(() => {
        return window.__APOLLO_STATE__ || null;
      });

      if (!apolloState) return [];

      const events = [];
      for (const [key, value] of Object.entries(apolloState)) {
        if (key.startsWith('Event:') && value.title) {
          events.push(this.mapApolloEvent(value, defaultCity));
        }
      }

      return events.filter(Boolean);
    } catch {
      return [];
    }
  }

  mapApolloEvent(ev, defaultCity) {
    const title = ev.title;
    if (!title) return null;

    const id = ev.id || ev.eventUrl?.split('/').filter(Boolean).pop() || '';
    const group = typeof ev.group === 'object' ? ev.group : {};
    const venue = typeof ev.venue === 'object' ? ev.venue : {};

    const city = this.detectCity(venue.city || group.city || '') || defaultCity;

    return {
      title,
      description: ev.description || ev.shortDescription || '',
      start_date: ev.dateTime || ev.startDate,
      end_date: ev.endTime || ev.endDate || null,
      venue_name: venue.name || null,
      venue_address: venue.address || null,
      city,
      organizer: group.name || null,
      industry: classifyIndustry(`${title} ${ev.description || ''}`),
      is_free: !ev.feeSettings || ev.feeSettings?.amount === 0,
      registration_url: ev.eventUrl || (id ? `https://www.meetup.com/events/${id}/` : null),
      image_url: ev.imageUrl || ev.featuredEventPhoto?.highRes || ev.featuredEventPhoto?.photo || null,
      source: 'Meetup',
      source_event_id: `meetup-${id}`,
    };
  }

  async extractFromDom(defaultCity) {
    const cards = await this.page.$$('[data-testid="categoryResults-eventCard"]');
    const events = [];
    const seen = new Set();

    for (const card of cards) {
      try {
        const title = await card.$eval('h2, h3', el => el.textContent.trim()).catch(() => null);
        const link = await card.$eval('a[href*="/events/"]', el => el.href).catch(() => null);
        const dateText = await card.$eval('time[datetime]', el => el.getAttribute('datetime')).catch(() => null);
        const groupSlug = link ? link.match(/meetup\.com\/([^/]+)\/events/)?.[1] : null;
        const groupName = groupSlug ? groupSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null;
        const img = await card.$eval('img[alt]', el => el.src).catch(() => null);
        const locationText = await card.$$eval('p', els => {
          const loc = els.find(el => /austin|san francisco|new york|brooklyn|manhattan|online/i.test(el.textContent));
          return loc ? loc.textContent.trim() : '';
        }).catch(() => '');

        if (title && !seen.has(title)) {
          seen.add(title);
          const id = link ? link.match(/events\/(\d+)/)?.[1] || link.split('/').filter(Boolean).pop() : title.toLowerCase().replace(/\s+/g, '-');
          events.push({
            title,
            description: '',
            start_date: dateText,
            end_date: null,
            venue_name: null,
            venue_address: null,
            city: this.detectCity(locationText) || defaultCity,
            organizer: groupName,
            industry: classifyIndustry(title),
            is_free: true,
            registration_url: link,
            image_url: img,
            source: 'Meetup',
            source_event_id: `meetup-${id}`,
          });
        }
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

module.exports = MeetupScraper;
