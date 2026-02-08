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
    uschamber:          { enabled: true },
    allconferencealert: { enabled: true },
    legalweek:          { enabled: true },
  },

  // Target cities
  cities: [
    'Austin',
    'San Francisco',
    'New York',
    'Miami',
  ],

  // Normalize borough/suburb names to their metro area
  cityAliases: {
    'Brooklyn': 'New York',
    'Manhattan': 'New York',
    'Oakland': 'San Francisco',
    'San Jose': 'San Francisco',
  },

  validCities: [
    'Austin',
    'San Francisco',
    'New York',
    'Miami',
    'Los Angeles',
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
