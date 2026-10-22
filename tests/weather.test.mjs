// The MET Norway sample in tests/fixtures is a recorded answer (Bucharest, 20 Oct 2026, trimmed),
// kept from FOS and used only for tests. MET Norway data: CC BY 4.0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { categorize, clearWeatherCache, normalizeForecast, USER_AGENT } from '../netlify/lib/forecast.mjs';
import { handleWeather } from '../netlify/functions/weather.mjs';

const sample = JSON.parse(readFileSync(new URL('./fixtures/met-locationforecast-bucharest.json', import.meta.url), 'utf8'));
const NOW = Date.parse('2026-10-20T15:10:00Z');
const fakeFetch = (status = 200, body = sample, seen = []) => async (url, opts) => {
  seen.push({ url, opts });
  return new Response(JSON.stringify(body), { status, headers: { expires: new Date(NOW + 30 * 60000).toUTCString() } });
};
const city = { id: 'testville', coordinates: { lat: 44.432251, lon: 26.106389 }, timezone: { iana: 'Europe/Bucharest' } };
const cities = new Map([[city.id, city]]);

test('MET symbol codes become sky categories', () => {
  assert.deepEqual(categorize('clearsky_night'), { sky: 'clear', intensity: null, night: true });
  assert.deepEqual(categorize('lightrainshowers_day'), { sky: 'rain', intensity: 'light', night: false });
  assert.deepEqual(categorize('heavysnow'), { sky: 'snow', intensity: 'heavy', night: false });
  assert.equal(categorize('sleetshowersandthunder_night').sky, 'thunder');
  assert.equal(categorize(null).sky, null);
});

test('the forecast is reduced to now and three local days starting today', () => {
  const w = normalizeForecast(sample, { timeZone: 'Europe/Bucharest', now: NOW });
  assert.equal(w.now.t, '2026-10-20T15:00:00Z');
  assert.deepEqual(w.days.map((d) => d.date), ['2026-10-20', '2026-10-21', '2026-10-22']);
  for (const d of w.days) assert.ok(d.minC <= d.maxC && d.sky, d.date);
  assert.ok(Number.isInteger(w.now.windKmh), 'wind in km/h');
  assert.ok(w.series.length > 0 && w.series.every((e) => Date.parse(e.t) <= NOW + 72 * 3600000), 'a 72-hour series for the job sheet');
});

test('the function looks the city up, rounds coordinates to 4 decimals and identifies itself', async () => {
  clearWeatherCache();
  const seen = [];
  const res = await handleWeather('testville', { fetchImpl: fakeFetch(200, sample, seen), now: NOW, cities });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.city, 'testville');
  assert.equal(body.source.license, 'CC BY 4.0');
  assert.match(seen[0].url, /lat=44\.4323&lon=26\.1064$/);
  assert.equal(seen[0].opts.headers['User-Agent'], USER_AGENT);
  assert.match(USER_AGENT, /github\.com/);
  assert.match(res.headers.get('Netlify-CDN-Cache-Control'), /s-maxage=1200/);
});

test('unknown cities and bad ids never reach MET Norway; failures are not cached long', async () => {
  clearWeatherCache();
  const seen = [];
  assert.equal((await handleWeather('../etc', { fetchImpl: fakeFetch(200, sample, seen), now: NOW, cities })).status, 400);
  assert.equal((await handleWeather('nowhere', { fetchImpl: fakeFetch(200, sample, seen), now: NOW, cities })).status, 404);
  assert.equal(seen.length, 0);
  const fail = await handleWeather('testville', { fetchImpl: fakeFetch(503), now: NOW, cities });
  assert.equal(fail.status, 502);
  assert.match(fail.headers.get('Netlify-CDN-Cache-Control'), /s-maxage=60/);
});

test('every real city can be served (coordinates and time zone present)', async () => {
  const { cities: all } = JSON.parse(readFileSync(new URL('../data/ats/cities.json', import.meta.url), 'utf8'));
  for (const c of all) {
    clearWeatherCache();
    const res = await handleWeather(c.id, { fetchImpl: fakeFetch(), now: NOW });
    assert.equal(res.status, 200, c.id);
  }
});
