import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cargoDepots, cargoRoutes, dealerCities, cargoPath, trailerPath, truckPath } from '../src/lib/catalog.mjs';
import { buildJobDataset } from '../src/engine/dataset.mjs';
import { randomJob } from '../src/engine/generator.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const load = (f) => JSON.parse(readFileSync(`${root}data/ats/${f}.json`, 'utf8'));
const { companies } = load('companies');
const { cargo } = load('cargo');
const { cities } = load('cities');
const { trucks } = load('trucks');
const { trailers } = load('trailers');
const distances = load('distances');

test('paths', () => {
  assert.equal(cargoPath({ id: 'buttermilk' }), '/ats/cargo/buttermilk');
  assert.equal(trailerPath({ id: 'dry-van' }), '/ats/trailer/dry-van');
  assert.equal(truckPath({ id: 'mack-anthem' }), '/ats/truck/mack-anthem');
});

test('who offers and accepts a cargo matches the company data, with DLC sections', () => {
  const offers = cargoDepots('buttermilk', companies, 'provides');
  assert.ok(offers.length > 0);
  for (const d of offers) assert.ok(d.dlc === null ? true : typeof d.dlc === 'string');
  for (const d of cargoDepots('beverages', companies, 'accepts')) {
    const type = d.company.depotTypes.find((x) => x.type === d.type && x.gameId === d.gameId);
    const ids = new Set([...type.accepts, ...Object.values(type.dlcCargo ?? {}).flatMap((v) => v.accepts)]);
    assert.ok(ids.has('beverages'), `${d.company.id}`);
  }
});

test('routes of a cargo are real city pairs, sorted by distance', () => {
  const r = cargoRoutes('buttermilk', companies, distances);
  assert.ok(r.count > 0);
  for (let i = 1; i < r.longest.length; i++) assert.ok(r.longest[i - 1].km >= r.longest[i].km);
  for (const p of [...r.longest, ...r.shortest]) assert.notEqual(p.from, p.to);
});

test('every truck make maps to dealer cities by name', () => {
  const mack = dealerCities('Mack', cities);
  assert.ok(mack.some((c) => c.id === 'sacramento'));
  assert.ok(dealerCities('Peterbilt', cities).length > 0, 'Peterbilt (large) counts as Peterbilt');
  for (const t of trucks) assert.ok(Array.isArray(dealerCities(t.manufacturer, cities)));
});

test('every trailer type id used by cargo has a trailer page', () => {
  const ids = new Set(trailers.map((t) => t.id));
  for (const c of cargo) for (const t of c.trailerTypes) assert.ok(ids.has(t), `${c.id} → ${t}`);
});

test('a job generated for a cargo carries that cargo', () => {
  const ds = buildJobDataset({ cities, companies, cargo, trailers, distances, trucks });
  for (const id of ['buttermilk', 'beverages', 'excavator']) {
    if (!cargo.some((c) => c.id === id)) continue;
    for (let s = 1; s <= 5; s++) {
      const j = randomJob(ds, { seed: s, cargo: id });
      if (!j) continue;
      assert.equal(j.cargo, id);
    }
  }
});
