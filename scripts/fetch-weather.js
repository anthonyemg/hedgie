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
  "&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles&forecast_days=7";
const AQI_URL =
  `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
  "&current=us_aqi&timezone=America%2FLos_Angeles";

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

// Grouped by icon rather than exact code, since e.g. "moderate" vs "heavy"
// rain don't need visually distinct icons.
const WEATHER_ICONS = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌦️",
  55: "🌦️",
  56: "🌧️",
  57: "🌧️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  66: "🌧️",
  67: "🌧️",
  71: "🌨️",
  73: "🌨️",
  75: "🌨️",
  77: "🌨️",
  80: "🌧️",
  81: "🌧️",
  82: "🌧️",
  85: "🌨️",
  86: "🌨️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

function describeWeatherCode(code) {
  return WEATHER_CODES[code] || `Unknown conditions (code ${code})`;
}

function iconForWeatherCode(code) {
  return WEATHER_ICONS[code] || "🌡️";
}

// US EPA AQI breakpoints (https://www.airnow.gov/aqi/aqi-basics/).
const AQI_LEVELS = [
  { max: 50, category: "Good" },
  { max: 100, category: "Moderate" },
  { max: 150, category: "Unhealthy for sensitive groups" },
  { max: 200, category: "Unhealthy" },
  { max: 300, category: "Very unhealthy" },
  { max: Infinity, category: "Hazardous" },
];

function categorizeAqi(aqi) {
  return AQI_LEVELS.find((level) => aqi <= level.max).category;
}

// Air quality forecast is a separate free Open-Meteo API; fetched
// independently so a hiccup there doesn't take down the main forecast.
async function fetchAqi() {
  try {
    const res = await fetch(AQI_URL);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    const aqi = data.current.us_aqi;
    return { aqi, aqi_category: categorizeAqi(aqi) };
  } catch (err) {
    console.error(`Failed to fetch AQI (continuing without it): ${err.message}`);
    return { aqi: null, aqi_category: null };
  }
}

async function fetchWeather() {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch weather: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const aqi = await fetchAqi();

  // items[0] is today, which also carries the current reading (including
  // AQI, which we only fetch for today); the rest of the week only has a
  // forecast high/low (no "current" temp).
  const items = data.daily.time.map((date, i) => ({
    date,
    temp_f: i === 0 ? data.current.temperature_2m : null,
    condition: describeWeatherCode(data.daily.weather_code[i]),
    icon: iconForWeatherCode(data.daily.weather_code[i]),
    high_f: data.daily.temperature_2m_max[i],
    low_f: data.daily.temperature_2m_min[i],
    precipitation_probability_max: data.daily.precipitation_probability_max[i],
    aqi: i === 0 ? aqi.aqi : null,
    aqi_category: i === 0 ? aqi.aqi_category : null,
  }));

  const outPath = new URL("../data/weather.json", import.meta.url);
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(
    outPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        source: `Open-Meteo forecast for Seattle, WA (${LATITUDE}, ${LONGITUDE})`,
        status: "ok",
        items,
      },
      null,
      2
    ) + "\n"
  );

  console.log(`Fetched ${items.length}-day forecast; today: ${items[0].temp_f}°F, ${items[0].condition}`);
}

fetchWeather().catch((err) => {
  console.error(err);
  process.exit(1);
});
