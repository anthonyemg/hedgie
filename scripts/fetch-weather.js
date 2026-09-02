// Fetches today's Seattle forecast from Open-Meteo (free, no API key) and
// saves it to data/weather.json. Runs once each morning via GitHub Actions
// so the site reads a static file instead of calling the API on every page
// load.
import { writeFile, mkdir } from "node:fs/promises";

const LATITUDE = 47.6062;
const LONGITUDE = -122.3321;
const SOURCE_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
  "&current=temperature_2m,weather_code,precipitation" +
  "&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max" +
  "&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles&forecast_days=1";

// https://open-meteo.com/en/docs — WMO weather interpretation codes.
const WEATHER_CODES = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function describeWeatherCode(code) {
  return WEATHER_CODES[code] || `Unknown conditions (code ${code})`;
}

async function fetchWeather() {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch weather: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();

  const item = {
    date: data.daily.time[0],
    temp_f: data.current.temperature_2m,
    condition: describeWeatherCode(data.current.weather_code),
    high_f: data.daily.temperature_2m_max[0],
    low_f: data.daily.temperature_2m_min[0],
    precipitation_probability_max: data.daily.precipitation_probability_max[0],
  };

  const outPath = new URL("../data/weather.json", import.meta.url);
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(
    outPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        source: `Open-Meteo forecast for Seattle, WA (${LATITUDE}, ${LONGITUDE})`,
        status: "ok",
        items: [item],
      },
      null,
      2
    ) + "\n"
  );

  console.log(`Fetched weather for ${item.date}: ${item.temp_f}°F, ${item.condition}`);
}

fetchWeather().catch((err) => {
  console.error(err);
  process.exit(1);
});
