// GET /api/weather/sacramento -> real weather for one Freight World city, from MET Norway.
// The city is looked up here (the browser never sends coordinates), so only our cities can be
// queried and the CDN keeps one answer per city. Ported from FOS (git tag fos-final).
import citiesFile from '../../data/ats/cities.json' with { type: 'json' };
import { SOURCE, getCityWeather } from '../lib/forecast.mjs';

const json = (body, status, cdnCache) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=120',
    'Netlify-CDN-Cache-Control': cdnCache,
  },
});

const byId = new Map(citiesFile.cities.map((c) => [c.id, c]));

export async function handleWeather(id, { fetchImpl = fetch, now = Date.now(), cities = byId } = {}) {
  if (!/^[a-z0-9-]{1,60}$/.test(id)) return json({ ok: false, error: 'badId' }, 400, 'public, durable, s-maxage=86400');
  const city = cities.get(id);
  if (!city?.coordinates) return json({ ok: false, error: 'unknownCity' }, 404, 'public, durable, s-maxage=86400');
  const { lat, lon } = city.coordinates;
  const timeZone = city.timezone.iana;
  try {
    const weather = await getCityWeather({ lat, lon, timeZone }, { fetchImpl, now });
    // Fresh for 20 minutes on the CDN, then served stale for up to 10 more while refreshing.
    return json({ ok: true, city: id, timeZone, source: SOURCE, fetchedAt: new Date(now).toISOString(), ...weather }, 200, 'public, durable, s-maxage=1200, stale-while-revalidate=600');
  } catch (error) {
    console.error('weather', id, error?.message || error);
    return json({ ok: false, error: 'weatherUnavailable' }, 502, 'public, s-maxage=60');
  }
}

export default async (request, context) => handleWeather(String(context?.params?.id || ''));

export const config = {
  path: '/api/weather/:id',
  method: 'GET',
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
