// Reads the facts-only events scraped by scrape.js and asks Gemini to write
// a short, original one-to-two sentence description for each — built only
// from the extracted facts, never from the source site's own copy.
import { readFile, writeFile } from "node:fs/promises";

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const DATA_PATH = new URL("../data/events.json", import.meta.url);

function buildPrompt(event) {
  const facts = [
    `Name: ${event.name}`,
    `Category: ${event.category || "unknown"}`,
    `Dates: ${event.date_text || "unknown"}`,
    `Free: ${event.is_free ? "yes" : "no"}`,
    event.neighborhood ? `Neighborhood: ${event.neighborhood}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    "Write one short, plain, factual sentence (max 25 words) describing this " +
    "Seattle-area event for a personal events list. Use only the facts given " +
    "below — do not invent details, prices, or venue descriptions. No marketing " +
    "language, no emoji, no quotes around the output.\n\n" +
    facts
  );
}

async function describeEvent(event) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const body = {
    contents: [{ parts: [{ text: buildPrompt(event) }] }],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? text.trim() : null;
}

async function main() {
  if (!API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  const raw = await readFile(DATA_PATH, "utf8");
  const data = JSON.parse(raw);

  for (const event of data.events) {
    try {
      event.description = await describeEvent(event);
      console.log(`Described: ${event.name}`);
    } catch (err) {
      console.error(`Failed to describe "${event.name}": ${err.message}`);
      event.description = null;
    }
    // Small delay to stay well under API rate limits.
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  data.descriptions_generated_at = new Date().toISOString();
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2) + "\n");

  console.log(`Generated descriptions for ${data.events.length} events`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
