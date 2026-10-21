// GET /api/weather/683506 -> weather for one city of the active countries (GeoNames ID).
// The city is looked up here (the browser never sends coordinates), so only our cities can be
// queried and the CDN keeps one answer per city.
import lookup from "../../src/data/places/lookup.json" with { type: "json" };
import { SOURCE, getCityWeather } from "../lib/weather/forecast.mjs";

const json = (body, status, cdnCache) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=120",
    "Netlify-CDN-Cache-Control": cdnCache,
  },
});

export async function handleWeather(id, { fetchImpl = fetch, now = Date.now(), places = lookup.places } = {}) {
  if (!/^\d{1,10}$/.test(id)) return json({ ok: false, error: "badId" }, 400, "public, durable, s-maxage=86400");
  const place = places[id];
  if (!place) return json({ ok: false, error: "unknownCity" }, 404, "public, durable, s-maxage=86400");
  const [lat, lon, timeZone, countryCode] = place;
  try {
    const weather = await getCityWeather({ lat, lon, timeZone }, { fetchImpl, now });
    // Fresh for 20 minutes on the CDN, then served stale for up to 10 more while refreshing.
    return json({ ok: true, geonamesId: Number(id), countryCode, timeZone, source: SOURCE, fetchedAt: new Date(now).toISOString(), ...weather }, 200, "public, durable, s-maxage=1200, stale-while-revalidate=600");
  } catch (error) {
    console.error("weather", id, error?.message || error);
    return json({ ok: false, error: "weatherUnavailable" }, 502, "public, s-maxage=60");
  }
}

export default async (request, context) => handleWeather(String(context?.params?.id || ""));

export const config = {
  path: "/api/weather/:id",
  method: "GET",
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
