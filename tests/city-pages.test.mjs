import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  cityPath, cityParams, statesWithCities, cityCompanies, cityCargoCounts,
  temperature, windSpeed, precipitation, weatherKind, openMeteoUrl,
} from '../src/lib/ats.mjs';
import { acceptLicence, looksLikeAPhoto, toPhoto } from '../scripts/photos/lib/commons.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const load = (f) => JSON.parse(readFileSync(root + f, 'utf8'));
const scope = load('data/ats/scope.json');
const { cities } = load('data/ats/cities.json');
const { companies } = load('data/ats/companies.json');
const { cargo } = load('data/ats/cargo.json');
const { photos } = load('data/photos.json');
const en = load('src/i18n/en.json');

test('one static page per city, under /ats/<state>/<id>', () => {
  const params = cityParams(cities);
  assert.equal(params.length, cities.length);
  const sac = cities.find((c) => c.id === 'sacramento');
  assert.equal(cityPath(sac), '/ats/ca/sacramento');
  assert.deepEqual(params.find((p) => p.props.cityId === 'sacramento').params, { state: 'ca', city: 'sacramento' });
  const paths = new Set(params.map((p) => `${p.params.state}/${p.params.city}`));
  assert.equal(paths.size, params.length, 'duplicate URL');
});

test('the city list groups every city under its state', () => {
  const states = statesWithCities(scope, cities);
  assert.deepEqual(states.map((s) => s.code), scope.states.map((s) => s.code));
  assert.equal(states.reduce((n, s) => n + s.cities.length, 0), cities.length);
});

test('city companies resolve every depot with cargo names', () => {
  for (const city of cities) {
    const groups = cityCompanies(city, companies, cargo);
    const depots = groups.reduce((n, g) => n + g.depots.length, 0);
    assert.equal(depots, city.depots.length, city.id);
    for (const g of groups) for (const d of g.depots) {
      for (const c of [...d.accepts, ...d.provides]) assert.ok(c.name, `${city.id}: cargo without name`);
    }
  }
  const sac = cityCompanies(cities.find((c) => c.id === 'sacramento'), companies, cargo);
  const apade = sac.find((g) => g.company.id === 'apade');
  assert.ok(apade.depots[0].provides.some((c) => c.name === 'Batteries'));
  assert.ok(cityCargoCounts(sac).provides > 0);
});

test('units: US by default values, metric on request', () => {
  assert.deepEqual(temperature(20, 'us'), { value: 68, unit: '°F' });
  assert.deepEqual(temperature(20, 'metric'), { value: 20, unit: '°C' });
  assert.deepEqual(windSpeed(16.09344, 'us'), { value: 10, unit: 'mph' });
  assert.deepEqual(windSpeed(16, 'metric'), { value: 16, unit: 'km/h' });
  assert.deepEqual(precipitation(25.4, 'us'), { value: 1, unit: 'in' });
  assert.deepEqual(precipitation(1.26, 'metric'), { value: 1.3, unit: 'mm' });
});

test('weather codes map to known kinds, each with a label', () => {
  const cases = { 0: 'clear', 2: 'partly', 3: 'cloudy', 45: 'fog', 53: 'drizzle', 63: 'rain', 81: 'rain', 73: 'snow', 86: 'snow', 95: 'storm', 4: 'unknown' };
  for (const [code, kind] of Object.entries(cases)) {
    assert.equal(weatherKind(code), kind, `code ${code}`);
    assert.ok(en.weather[kind], `no label for ${kind}`);
  }
});

test('the Open-Meteo request needs no key and asks for what the page shows', () => {
  const url = new URL(openMeteoUrl({ lat: 38.5, lon: -121.5 }));
  assert.equal(url.host, 'api.open-meteo.com');
  assert.equal(url.searchParams.get('latitude'), '38.5');
  assert.ok(!url.searchParams.has('apikey'));
  for (const f of ['temperature_2m', 'weather_code', 'wind_speed_10m', 'precipitation', 'is_day']) {
    assert.ok(url.searchParams.get('current').includes(f), f);
  }
});

test('every facility in the data has a label', () => {
  for (const f of new Set(cities.flatMap((c) => c.facilities))) assert.ok(en.facilities[f], `no label for facility "${f}"`);
});

test('every city has a photo entry: a checked Commons photo, or null with a reason', () => {
  for (const c of cities) {
    const entry = photos[c.id];
    assert.ok(entry, `${c.id}: no entry in data/photos.json`);
    assert.ok(entry.reason, `${c.id}: no reason`);
    if (!entry.photo) continue;
    const p = entry.photo;
    assert.match(p.src, /^https:\/\/(upload|thumb)\.wikimedia\.org\//, c.id);
    assert.match(p.src960, /^https:\/\/(upload|thumb)\.wikimedia\.org\/.*\/960px-/, c.id);
    assert.match(p.page, /^https:\/\/commons\.wikimedia\.org\//, c.id);
    assert.ok(acceptLicence(p.licence), `${c.id}: licence ${p.licence}`);
    assert.ok(p.author || /^(public domain|pd|cc0)/i.test(p.licence), `${c.id}: no author`);
    assert.ok(p.width >= 1200, `${c.id}: too small`);
  }
});

test('Commons rules: free licences only, no maps or flags', () => {
  assert.ok(acceptLicence('CC BY-SA 4.0'));
  assert.ok(acceptLicence('Public domain'));
  assert.ok(!acceptLicence('CC BY-NC 2.0'));
  assert.ok(!acceptLicence(''));
  assert.ok(!looksLikeAPhoto('Sacramento map.png'));
  assert.ok(looksLikeAPhoto('Sacramento skyline.jpg'));
  const info = { mime: 'image/jpeg', width: 1000, url: 'https://upload.wikimedia.org/a.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:A.jpg', extmetadata: { LicenseShortName: { value: 'CC BY 4.0' }, Artist: { value: 'Someone' } } };
  assert.equal(toPhoto(info, { file: 'A.jpg', from: 'x', verified: 'd', minWidth: 1200 }).reject, 'too small');
  assert.ok(toPhoto(info, { file: 'A.jpg', from: 'x', verified: 'd' }).photo);
});

test('thumbUrl builds Commons thumbnails from thumbnails and originals', async () => {
  const { thumbUrl } = await import('../scripts/photos/lib/commons.mjs');
  assert.equal(
    thumbUrl('https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/A_B.jpg/1600px-A_B.jpg', 960),
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/A_B.jpg/960px-A_B.jpg',
  );
  assert.equal(
    thumbUrl('https://upload.wikimedia.org/wikipedia/commons/f/f1/City.jpg', 960),
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/City.jpg/960px-City.jpg',
  );
  assert.equal(thumbUrl('https://example.com/x.jpg', 960), null);
});
