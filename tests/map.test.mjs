import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildRoadGraph, routeBetween, nearestNode } from '../src/engine/roadgraph.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const map = JSON.parse(readFileSync(`${root}data/map/ats-map.json`, 'utf8'));
const { cities } = JSON.parse(readFileSync(`${root}data/ats/cities.json`, 'utf8'));
const scope = JSON.parse(readFileSync(`${root}data/ats/scope.json`, 'utf8'));
const { pairs } = JSON.parse(readFileSync(`${root}data/ats/distances.json`, 'utf8'));

test('map layers: public-domain source, every state in scope, every city with coordinates', () => {
  assert.equal(map.meta.licence, 'Public domain');
  assert.match(map.meta.source, /Natural Earth/);
  assert.deepEqual(map.states.map((s) => s.code).sort(), scope.states.map((s) => s.code).sort());
  assert.equal(map.cities.length, cities.filter((c) => c.coordinates).length);
  for (const c of map.cities) {
    assert.ok(c.xy[0] >= map.bounds[0] - 5 && c.xy[0] <= map.bounds[2] + 5, `${c.id} x inside`);
    assert.ok(c.xy[1] >= map.bounds[1] - 5 && c.xy[1] <= map.bounds[3] + 5, `${c.id} y inside`);
  }
  assert.ok(map.roads.length > 300);
  for (const r of map.roads) assert.ok(['I', 'US', 'S', 'O'].includes(r.level) && r.pts.length >= 2);
});

test('every city is close to a road and every pair of cities has a route', () => {
  const g = buildRoadGraph(map.roads);
  // Natural Earth lacks a few local roads (e.g. AZ-95 through Lake Havasu City, ~28 km): the
  // route is joined to the nearest road with a short straight link.
  for (const c of map.cities) assert.ok(nearestNode(g, c.xy).km < 30, `${c.id} near a road`);
  const ratios = [];
  for (const a of map.cities) for (const b of map.cities) {
    if (a.id === b.id) continue;
    const r = routeBetween(g, a.xy, b.xy);
    assert.ok(r, `${a.id} → ${b.id}`);
    ratios.push(r.km / pairs.find((p) => p.from === a.id && p.to === b.id).km);
  }
  ratios.sort((x, y) => x - y);
  const median = ratios[Math.floor(ratios.length / 2)];
  assert.ok(median > 0.85 && median < 1.15, `drawn routes follow real roads (median ratio ${median.toFixed(2)})`);
});

test('Los Angeles to Phoenix is drawn along Interstate 10', () => {
  const g = buildRoadGraph(map.roads);
  const xy = Object.fromEntries(map.cities.map((c) => [c.id, c.xy]));
  const r = routeBetween(g, xy['los-angeles'], xy.phoenix);
  const refs = new Set(r.roads.filter((i) => i >= 0).map((i) => `${map.roads[i].level}${map.roads[i].ref}`));
  assert.ok(refs.has('I10'), [...refs].join(','));
});

test('map cities carry their facilities and companies for the icons', () => {
  const { companies } = JSON.parse(readFileSync(`${root}data/ats/companies.json`, 'utf8'));
  const ids = new Set(companies.map((c) => c.id));
  const en = JSON.parse(readFileSync(`${root}src/i18n/en.json`, 'utf8'));
  for (const c of map.cities) {
    const city = cities.find((x) => x.id === c.id);
    assert.deepEqual(c.facilities, city.facilities, c.id);
    assert.deepEqual(c.companies.map((x) => x[0]).sort(), [...new Set(city.depots.map((d) => d.company))].sort(), c.id);
    for (const [id] of c.companies) assert.ok(ids.has(id));
    for (const f of c.facilities) assert.ok(en.facilities[f], `label for ${f}`);
  }
});
