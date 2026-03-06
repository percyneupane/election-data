# Nepal Federal Parliament Election 2082 TV Dashboard

Full-screen, slideshow-style Next.js dashboard that scrapes district and constituency results from Ekantipur Election English pages.

## Features

- Live scraper for district + constituency pages (`province`, `district`, `constituency`, candidates, parties, votes, lead/win status)
- Full-screen TV slide mode (10-second district display)
- Random rotation with no immediate repeat + sequential mode toggle
- Manual district jump selector
- Smooth fade transitions and countdown bar
- Live badge and `Last updated at ...` timestamp
- Vote count animation on updates
- Bottom ticker of major leads
- Background refresh scheduler (1-5 minutes configurable)
- Disk cache fallback if scrape fails
- Development fallback mock dataset
- Debug endpoint/page for raw JSON

## Tech Stack

- Next.js (App Router)
- Node.js API routes
- Cheerio for parsing HTML

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env.local
```

3. Start dev server:

```bash
npm run dev
```

4. Open:

- Main slideshow: `http://localhost:3000`
- Raw debug JSON: `http://localhost:3000/debug`
- API endpoint: `http://localhost:3000/api/results`

## Project Structure

- `app/page.tsx`: full-screen slideshow UI and rotation logic
- `app/api/results/route.ts`: public API endpoint for normalized results
- `app/api/debug/raw/route.ts`: debug API for raw cached JSON
- `components/`: reusable dashboard components
- `lib/scraper/ekantipurScraper.ts`: resilient scraper and normalization logic
- `lib/scraper/seedDistricts.ts`: district seed list and province hints
- `lib/dataStore.ts`: cache + background refresh scheduler
- `data/fallback-results.ts`: fallback mock data

## Scraper Notes

The scraper is intentionally multi-layered to resist HTML changes:

1. Parse homepage links and embedded script patterns for district/constituency URLs.
2. Crawl district pages to discover constituency pages.
3. Parse constituency pages for candidate rows using multiple selectors.
4. Normalize to strongly typed JSON grouped by district.
5. Cache latest successful dataset to `data/cache/results-cache.json`.
6. If scraping fails, return cache; if no cache, return fallback mock data.

## Production Notes

- Keep `runtime = "nodejs"` for scraping routes.
- Tune `SCRAPE_INTERVAL_MS` between `60000` and `300000` for load/speed balance.
- Add external monitoring for scrape errors from `scrapeErrors` in API response.
