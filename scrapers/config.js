module.exports = {
  airtable: {
    baseId: 'appKiSt45AcFjSNw4',
    tableName: 'Events',
  },

  webhookUrl: process.env.WEBHOOK_URL || 'https://YOUR-USA-SITE.netlify.app/.netlify/functions/receive-events',

  browser: {
    headless: true,
    timeout: 30000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  },

  batch: {
    size: 50,
    delayMs: 2000,
  },

  scrapers: {
    eventbrite:    { enabled: true },
    meetup:        { enabled: true },
    luma:          { enabled: true },
    emedevents:    { enabled: true },
    primed:        { enabled: true },
    ams:           { enabled: true },
    clio:          { enabled: true },
    startupgrind:  { enabled: true },
    uschamber:     { enabled: true },
  },

  // Target cities
  cities: [
    'Austin',
    'San Francisco',
    'New York',
  ],

  validCities: [
    'Austin',
    'San Francisco',
    'San Jose',
    'Oakland',
    'New York',
    'Brooklyn',
    'Manhattan',
    'Los Angeles',
    'Miami',
    'Chicago',
    'Seattle',
    'Denver',
    'Boston',
    'Washington DC',
  ],

  validIndustries: [
    'Technology',
    'AI',
    'Startup',
    'Finance',
    'Marketing',
    'Healthcare',
    'Legal',
    'General',
  ],
};
