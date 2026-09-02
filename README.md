# Hedgie

A personal "what should I do today in Seattle" planner. Fast, low-effort,
opinionated — you open it, tap a few filters, and get a short plan, not a
catalog to browse. Static site on GitHub Pages, data refreshed by GitHub
Actions, no backend, no billing accounts.

## Status: early build

Built so far:
- `scripts/scrape-events.js` — scrapes **facts only** (never the site's
  written descriptions) about upcoming Seattle events from
  events12.com/seattle/, via `cheerio`.
- `.github/workflows/refresh-events.yml` — runs the scraper monthly (and on
  manual trigger via the Actions tab), commits `data/events.json`, and fails
  the run loudly if it scrapes 0 events.

Not built yet:
- Gemini-generated event descriptions (holding off on wiring `GEMINI_API_KEY`
  until it's added as a repo secret)
- `data/places.json` + `scripts/update-places.js` (evergreen parks/libraries
  with seasonal/weather conditions)
- The actual daily-planner UI (`src/index.html`, `src/app.js`), custom SVG
  neighborhood map (`src/map.html`), and hidden pipeline-status page
  (`src/status.html` + `data/status.json`)
- `deploy.yml` to publish the site

## Data schema

`data/events.json` (and every other data file) uses a shared envelope:

```json
{
  "generated_at": "ISO timestamp",
  "source": "string describing where the data came from",
  "status": "ok | error",
  "items": [ ... ]
}
```

Each event in `items`:

```json
{
  "name": "string",
  "is_free": true,
  "date_text": "raw date string as shown on the source, e.g. \"September 2 - 7, 2026\"",
  "neighborhood": "string or null",
  "distance_from_downtown": "string or null, e.g. \"3.6 miles N\"",
  "address": "string or null, decoded from the source's map link",
  "source_url": "the event's own official site",
  "category": "one of the site's own filter categories, e.g. \"music\""
}
```

## Events scraper notes

- The scraper always fetches `https://www.events12.com/seattle/`, which the
  site itself keeps pointed at the current calendar month — no month name is
  ever hardcoded, and there's no need to chase the page's "next month" link.
- Only `<article>` elements containing an `<h3>` are treated as events; a few
  page widgets (e.g. a concert listing table) use `<h2>` instead and are
  skipped.
- Category comes from the site's own filter-checkbox taxonomy baked into each
  article's `class` attribute (e.g. `q7` → "music"), not from guessing which
  visual section of the page an event sits in.
- A content link (the event's own site) never carries a class attribute;
  the map/tickets/photos/video buttons always do (`b1`–`b5`), which is how
  the scraper tells them apart.
