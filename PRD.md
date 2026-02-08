# PRD: Conferix USA — Professional Events Platform

## 1. Overview

Conferix USA is a web platform that aggregates professional events across major US tech/business hubs. It helps professionals discover networking events, conferences, meetups, and workshops in Technology, AI, Startup, Finance, Marketing, Healthcare, and Legal industries. A key feature is email notifications by profession — busy professionals (especially doctors and lawyers) receive curated event digests rather than having to search manually.

This is a sister project to Conferix UAE, sharing the same architecture but targeting the US market.

## 2. Problem Statement

Professionals in the US tech/business ecosystem waste time checking multiple event platforms (Eventbrite, Meetup, Luma, etc.) to find relevant industry events. There is no single aggregator focused specifically on professional/business events across key US cities.

## 3. Target Users

- **Tech professionals** looking for conferences, hackathons, and developer meetups
- **AI/ML practitioners** seeking AI-focused events and workshops
- **Startup founders & VCs** looking for pitch events, demo days, and networking
- **Finance/Fintech professionals** seeking industry conferences and meetups
- **Marketing professionals** looking for growth, SEO, and brand events
- **Healthcare professionals** (physicians, nurses, pharmacists) seeking CME/CE conferences and medical seminars
- **Legal professionals** (attorneys, paralegals) seeking CLE events, legal tech conferences, and bar events

## 4. Target Cities

| City | Metro Area | Why |
|------|-----------|-----|
| **Austin** | Austin, TX | SXSW hub, fast-growing tech scene, startup capital |
| **San Francisco** | SF Bay Area (SF, San Jose, Oakland) | Global tech capital, VC epicenter |
| **New York** | NYC (Manhattan, Brooklyn) | Finance + tech intersection, media/marketing hub |

### Extended Metro Recognition

Events in these cities are also captured under their metro area:
- **San Francisco**: San Jose, Oakland
- **New York**: Brooklyn, Manhattan
- Also recognized: Los Angeles, Miami, Chicago, Seattle, Denver, Boston, Washington DC

## 5. Industries (5 Categories)

| Industry | Covers |
|----------|--------|
| **Technology** | Software, DevOps, Cloud, Cybersecurity, Web3, Engineering |
| **AI** | Machine Learning, LLMs, Data Science, Computer Vision, NLP |
| **Startup** | Entrepreneurship, VC, Accelerators, Pitch Events, Y Combinator |
| **Finance** | Fintech, Banking, Investment, Crypto, DeFi, Wall Street |
| **Marketing** | Growth, SEO, Content, Social Media, B2B Marketing, Analytics |

Events that don't match any industry are classified as **General**.

## 6. Data Sources

| Source | URL Pattern | Priority | Notes |
|--------|-------------|----------|-------|
| **Eventbrite** | eventbrite.com/d/{city}/events/ | High | Largest US event platform, JSON-LD extraction |
| **Meetup** | meetup.com/find/?location={city}&source=EVENTS | High | Strong for recurring tech meetups |
| **Luma** | lu.ma/discover?near={city} | Medium | Popular for AI/tech events, growing fast |

## 7. Architecture

```
Static Netlify Site (HTML/CSS/JS)
        |
        v
  Netlify Functions
    - receive-events.js  (POST: scrapers push events here)
    - get-events.js      (GET: frontend fetches events)
        |
        v
    Airtable (USA Base)
    - Events table with approval workflow
        |
   [Scrapers run separately]
        |
  scrapers/run-all.js (Node.js + Playwright)
    +-> sites/eventbrite.js
    +-> sites/meetup.js
    +-> sites/luma.js
```

### Key Architecture Decisions

- **Static site on Netlify** — Free hosting, global CDN, serverless functions
- **Airtable as database** — Visual approval workflow, no server to maintain
- **Playwright scrapers** — Handles JavaScript-rendered pages, reliable extraction
- **Separate from UAE project** — Own repo, own Airtable base, own Netlify site
- **GitHub Actions for scheduling** — Free tier (2000 min/month), runs without user's PC

## 8. Event Data Schema

Each scraped event must include:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | String (max 500) | Yes | Event name |
| `description` | String (max 5000) | No | Event description |
| `start_date` | ISO 8601 date | Yes | YYYY-MM-DD format for Airtable |
| `end_date` | ISO 8601 date | No | |
| `venue_name` | String | No | Physical venue or "Online" |
| `venue_address` | String | No | Full street address |
| `city` | String | No | Must match a valid city from config |
| `organizer` | String | No | Event host or group name |
| `industry` | Enum | Yes | One of: Technology, AI, Startup, Finance, Marketing, General |
| `is_free` | Boolean | Yes | Default false |
| `registration_url` | URL | No | Link to sign up |
| `image_url` | URL | No | Event banner/thumbnail |
| `source` | String | Yes | "Eventbrite", "Meetup", "Luma" |
| `source_event_id` | String | Yes | Unique ID for deduplication |

## 9. Scraping Strategy

### 9.1 General Principles

- **JSON-first**: Extract from structured data (JSON-LD, `__NEXT_DATA__`, API responses) before DOM selectors
- **Sequential execution**: One scraper at a time to manage memory (~200MB per browser)
- **Batch POSTing**: 50 events per batch, 2s delay between batches
- **Fail-safe**: Each scraper is isolated — if one fails, others still run
- **No past events**: Skip events with start_date before today

### 9.2 Per-Source Strategy

**Eventbrite**
- Search URL: `eventbrite.com/d/{city}/business--events/` per city
- Extract JSON-LD `itemListElement[].item` from each page
- Paginate via `?page=N` (up to 5 pages per city)
- City detection from venue location
- Industry classification via keyword matching on title + description

**Meetup**
- Search URL: `meetup.com/find/?location=us--{state}--{city}&source=EVENTS&categoryId=546`
- Extract event cards from DOM
- Extract datetime from `<time>` elements
- Derive organizer from URL slug
- Scroll to load more results

**Luma**
- Discover URL: `lu.ma/discover?near={city}`
- Extract event data from page (JSON or DOM)
- Luma is popular for AI/tech events — good coverage
- May need response interception for API data

### 9.3 Industry Classification

Keyword-based matching (no AI/API costs):

| Keywords (sample) | Industry |
|-------------------|----------|
| software, developer, cloud, devops, hackathon | Technology |
| machine learning, LLM, data science, generative AI | AI |
| startup, venture, founder, pitch, accelerator | Startup |
| fintech, banking, investment, crypto, wall street | Finance |
| marketing, SEO, growth, content, social media | Marketing |

## 10. Scheduling

- **Frequency**: Monday + Thursday at 1:00 AM UTC (8:00 PM ET / 5:00 PM PT previous day)
- **Platform**: GitHub Actions (free tier)
- **Manual trigger**: Available from GitHub Actions UI
- **Logs**: Uploaded as GitHub artifacts (90-day retention)

## 11. Deduplication

Events are deduplicated by `source` + `source_event_id` in Airtable:
- First scrape: creates new record
- Subsequent scrapes: updates existing record (no duplicates)

This is handled by the existing `receive-events.js` Netlify function.

## 12. Approval Workflow

1. Scrapers push events to Airtable with no status (status is computed)
2. Airtable `status` formula field auto-computes: Active / Ongoing / Expired based on dates
3. Admin reviews events in Airtable grid view
4. Approved events appear on the frontend via `get-events.js`

## 13. Tech Stack

| Layer | Technology | Cost |
|-------|-----------|------|
| Frontend | Static HTML/CSS/JS | Free |
| Hosting | Netlify (free tier) | Free |
| Backend | Netlify Functions (serverless) | Free |
| Database | Airtable (free tier: 1000 records) | Free |
| Scraping | Playwright + Node.js | Free |
| Scheduling | GitHub Actions | Free |
| Domain | TBD (conferix.com subdomain or separate) | ~$12/yr |

**Total cost: $0-12/year**

## 14. Project Structure

```
professional events webapp - USA/
├── PRD.md                          # This file
├── package.json                    # Dependencies & scripts
├── .gitignore
├── netlify.toml                    # Netlify configuration
├── netlify/
│   └── functions/
│       ├── receive-events.js       # POST endpoint for scrapers
│       └── get-events.js           # GET endpoint for frontend
├── public/                         # Static frontend files
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── scrapers/
│   ├── config.js                   # Central configuration
│   ├── base-scraper.js             # Reusable scraper base class
│   ├── run-all.js                  # Orchestrator script
│   ├── utils/
│   │   ├── logger.js               # Console + file logging
│   │   ├── date-parser.js          # Date normalization
│   │   └── industry-map.js         # Keyword-based classification
│   ├── sites/
│   │   ├── eventbrite.js           # Eventbrite scraper
│   │   ├── meetup.js               # Meetup scraper
│   │   └── luma.js                 # Luma scraper
│   └── logs/                       # Runtime logs (gitignored)
└── .github/
    └── workflows/
        └── scrape-events.yml       # Scheduled scraping
```

## 15. Milestones

### Phase 1: Scrapers (Current)
- [x] Foundation files (config, base-scraper, utils)
- [ ] Eventbrite US scraper
- [ ] Meetup US scraper
- [ ] Luma scraper
- [ ] Run-all orchestrator
- [ ] Local testing

### Phase 2: Backend
- [ ] Create Airtable base (duplicate from UAE, clear data)
- [ ] receive-events.js Netlify function
- [ ] get-events.js Netlify function
- [ ] Connect scrapers to Airtable via webhook

### Phase 3: Frontend
- [ ] Landing page (event grid with filters)
- [ ] City filter (Austin, SF, NYC)
- [ ] Industry filter (5 categories)
- [ ] Event detail cards
- [ ] Mobile responsive design

### Phase 4: Deploy & Schedule
- [ ] Deploy to Netlify
- [ ] GitHub Actions workflow
- [ ] Domain setup (conferix-usa or subdomain)
- [ ] End-to-end testing

## 16. Success Metrics

- **Event coverage**: 50+ unique events per scrape cycle
- **Source diversity**: Events from all 3 sources
- **City coverage**: Events from all 3 target cities
- **Freshness**: No events older than 7 days past their end date
- **Uptime**: Scraping succeeds on 90%+ of scheduled runs
- **Zero cost**: Operating within free tiers of all services

## 17. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Site structure changes | Medium | Scraper breaks | JSON-first extraction, DOM fallbacks |
| Anti-bot detection | Low-Medium | 403/CAPTCHA | Realistic user agent, delays between requests |
| Airtable free tier limit (1000 records) | Medium | Events stop saving | Auto-expire old events, or upgrade plan |
| Luma changes API/structure | Medium | Luma scraper breaks | Luma is newest source — build with fallbacks |
| GitHub Actions minutes exceed free tier | Low | Scraping stops | Each run ~5-10 min, 8 runs/month = ~80 min (well under 2000) |
