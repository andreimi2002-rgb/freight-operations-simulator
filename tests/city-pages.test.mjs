import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  cityPath, cityParams, statesWithCities, cityCompanies, cityCargoCounts,
  temperature, windSpeed, precipitation, weatherKind, weatherPath,
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

test('sky categories from the weather function map to kinds, each with a label', () => {
  const cases = [["clear", null, "clear"], ["partly", null, "partly"], ["cloudy", null, "cloudy"], ["fog", null, "fog"], ["rain", "light", "drizzle"], ["rain", "heavy", "rain"], ["sleet", null, "sleet"], ["snow", null, "snow"], ["thunder", null, "storm"], [null, null, "unknown"]];
  for (const [sky, intensity, kind] of cases) {
    assert.equal(weatherKind(sky, intensity), kind, String(sky));
    assert.ok(en.weather[kind], `no label for ${kind}`);
  }
});

test('the page asks our own weather function, never a third party directly', () => {
  assert.equal(weatherPath("sacramento"), "/api/weather/sacramento");
  const live = readFileSync(root + "src/scripts/live.mjs", "utf8");
  assert.doesNotMatch(live, /open-meteo|api.met.no/i);
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

test('job sheet helpers: weather at a time, severe weather, night', async () => {
  const { weatherAt, isSevere, isNight } = await import('../src/lib/ats.mjs');
  const series = [
    { t: '2026-10-22T10:00:00Z', stepH: 1, sky: 'clear' },
    { t: '2026-10-22T11:00:00Z', stepH: 6, sky: 'snow' },
  ];
  assert.equal(weatherAt(series, '2026-10-22T10:30:00Z').sky, 'clear');
  assert.equal(weatherAt(series, '2026-10-22T15:59:00Z').sky, 'snow');
  assert.equal(weatherAt(series, '2026-10-23T10:00:00Z'), null);
  assert.ok(isSevere({ sky: 'snow' }) && isSevere({ sky: 'fog' }) && isSevere({ sky: 'rain', intensity: 'heavy' }));
  assert.ok(!isSevere({ sky: 'rain', intensity: 'light' }) && !isSevere(null));
  assert.ok(isNight(23) && isNight(3) && !isNight(6) && !isNight(21));
});
