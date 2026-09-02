# Seattle Things To Do

A personal, static "things to do" site for Seattle. A GitHub Actions workflow
scrapes upcoming events once a month, extracts **facts only** (never the
source site's written descriptions, which are copyrighted) and asks Gemini to
write short, original descriptions from those facts. Everything is committed
to `data/events.json`, which `index.html` reads and renders — no server, no
build step.

## How it works

1. `scripts/scrape.js` fetches https://www.events12.com/seattle/ and parses
   each event's facts (name, dates, neighborhood, distance from downtown,
   address, official site link, and category) with `cheerio`. It never stores
   the site's descriptive paragraph text.
2. `scripts/generate-descriptions.js` sends those facts to the Gemini API and
   writes back a short original description per event.
3. `.github/workflows/scrape.yml` runs both scripts on the 1st of every month
   (and on manual trigger via the Actions tab), then commits the updated
   `data/events.json` back to the repo.
4. `index.html`, served by GitHub Pages at `/hedgie/seattle/`, fetches
   `data/events.json` and renders a plain, filterable list.

This lives inside the `hedgie` repo, under the `seattle/` subfolder, alongside
its unrelated root-level "Hello Dad" page. The GitHub Actions workflow file
itself must live at the repo root (`.github/workflows/scrape.yml`) per
GitHub's requirements, but it runs all its steps with `seattle/` as the
working directory.

## Setup

1. Add a repo secret named `GEMINI_API_KEY` (Settings → Secrets and
   variables → Actions, on the `hedgie` repo) with a Gemini API key from
   https://aistudio.google.com/apikey.
2. Enable GitHub Pages (Settings → Pages) serving from the `main` branch,
   root folder — the site is already public at `/hedgie/seattle/`.
3. Trigger the workflow once manually (Actions → Update Seattle events → Run
   workflow) to populate `data/events.json` for the first time.

## Notes

- Categories come from the site's own filter taxonomy (e.g. "music",
  "festival, art fair", "food, beverage") rather than free-text guesses.
- The scraper always fetches the base `/seattle/` URL, which the site itself
  keeps pointed at the current month — no month needs to be hardcoded.
