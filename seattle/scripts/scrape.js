// Scrapes FACTS ONLY about upcoming Seattle events from events12.com/seattle/.
// We never store their written description text (copyright) — only structured
// facts (name, date, location, category, and links), per the site's own
// robots.txt (which allows crawling this page).
import { writeFile, mkdir } from "node:fs/promises";
import * as cheerio from "cheerio";

// events12.com's /seattle/ base URL always renders whatever the current
// calendar month is (verified: fetching it on the 1st of a month already
// shows that month's events), so there's no need to hardcode a dated path
// or chase the "next month" link — this one URL stays "current" forever.
const SOURCE_URL = "https://www.events12.com/seattle/";

const USER_AGENT = "SeattleThingsToDoBot/1.0 (+personal hobby project, monthly run)";

// The site's own category taxonomy, from its filter checkboxes (e.g. class
// "q7" on an <article> means the "music" filter applies to it). q20/q21/q22
// are non-category flags (past/21+/seated) and are ignored.
const CATEGORY_MAP = {
  q0: "other",
  q1: "auto, boat, RV show",
  q2: "conference, expo",
  q3: "dance",
  q4: "festival, art fair",
  q5: "film",
  q6: "food, beverage",
  q7: "music",
  q8: "parade, lights",
  q9: "party, bar events",
  q10: "play, musical, show",
  q11: "run/walk, bike, swim",
  q12: "spectator sport",
};

function categoryFromClassList(classAttr) {
  const classes = (classAttr || "").split(/\s+/);
  for (const cls of classes) {
    if (Object.prototype.hasOwnProperty.call(CATEGORY_MAP, cls)) {
      return CATEGORY_MAP[cls];
    }
  }
  return null;
}

function parseNeighborhood(milesText) {
  const text = (milesText || "").trim();
  if (!text) return { neighborhood: null, distance_from_downtown: null };
  const match = text.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    return { neighborhood: match[1].trim(), distance_from_downtown: match[2].trim() };
  }
  return { neighborhood: text, distance_from_downtown: null };
}

function parseAddressFromMapLink(href) {
  if (!href) return null;
  try {
    const url = new URL(href, SOURCE_URL);
    return url.searchParams.get("query");
  } catch {
    return null;
  }
}

function extractEvent($, article) {
  const $article = $(article);
  const $h3 = $article.find("h3").first();
  if ($h3.length === 0) return null; // skip non-event widgets (e.g. concert tables)

  const isFree = $h3.find(".free").length > 0;
  const name = $h3.clone().find(".free").remove().end().text().trim();

  const dateText = $article.find("p.date, p.date.icon").first().text().trim();
  const milesText = $article.find("p.miles").first().text();
  const { neighborhood, distance_from_downtown } = parseNeighborhood(milesText);

  const mapHref = $article.find("a.b1").first().attr("href");
  const address = parseAddressFromMapLink(mapHref);

  // Content links (the event's own site) never carry a class attribute;
  // map/tickets/photos/video buttons always do (b1/b2/b3/b5/b4).
  const $sourceLink = $article
    .find("a")
    .filter((_, el) => !$(el).attr("class"))
    .first();
  const source_url = $sourceLink.attr("href") || null;

  const category = categoryFromClassList($article.attr("class"));
  const id = $article.attr("id") || null;

  return {
    id,
    name,
    is_free: isFree,
    date_text: dateText,
    neighborhood,
    distance_from_downtown,
    address,
    source_url,
    category,
  };
}

async function scrape() {
  const res = await fetch(SOURCE_URL, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${SOURCE_URL}: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  const events = [];
  $("article").each((_, article) => {
    const event = extractEvent($, article);
    if (event && event.name) events.push(event);
  });

  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  const outPath = new URL("../data/events.json", import.meta.url);
  await writeFile(
    outPath,
    JSON.stringify(
      { source_url: SOURCE_URL, scraped_at: new Date().toISOString(), events },
      null,
      2
    ) + "\n"
  );

  console.log(`Scraped ${events.length} events from ${SOURCE_URL}`);
}

scrape().catch((err) => {
  console.error(err);
  process.exit(1);
});
