// Phase S: map DLCs. A job needs the map DLC of every state its route touches.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inRing, stateAt, statesCrossed, pairKey, mapDlcs } from '../src/engine/route-states.mjs';
import { buildJobDataset, packJobDataset, unpackJobDataset } from '../src/engine/dataset.mjs';
import { possibleJobs, randomJob } from '../src/engine/generator.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const load = (f) => JSON.parse(readFileSync(`${root}data/${f}.json`, 'utf8'));
const routeStates = load('ats/route-states');
const { cities } = load('ats/cities');
const scope = load('ats/scope');
const ds = buildJobDataset({
  cities,
  companies: load('ats/companies').companies,
  cargo: load('ats/cargo').cargo,
  trailers: load('ats/trailers').trailers,
  distances: load('ats/distances'),
  trucks: load('ats/trucks').trucks,
  routeStates,
});

test('geometry: point in polygon and states crossed by a path', () => {
  const sq = (x0, code) => ({ code, rings: [[[x0, 0], [x0 + 10, 0], [x0 + 10, 10], [x0, 10]]] });
  const states = [sq(0, 'A'), sq(10, 'B'), sq(20, 'C')];
  assert.ok(inRing([5, 5], states[0].rings[0]));
  assert.ok(!inRing([15, 5], states[0].rings[0]));
  assert.equal(stateAt([25, 5], states), 'C');
  assert.equal(stateAt([50, 5], states), null);
  assert.deepEqual(statesCrossed([[1, 5], [29, 5]], states, 5), ['A', 'B', 'C'], 'a long segment is cut into pieces');
  assert.deepEqual(statesCrossed([[1, 5], [9, 5], [11, 5], [19, 5], [21, 5], [29, 5]], states, 5), ['A', 'B', 'C']);
  assert.deepEqual(statesCrossed([[1, 5], [9, 5], [9, 6], [19, 6], [21, 6], [29, 6]], states, 5), ['A', 'B', 'C']);
  assert.deepEqual(statesCrossed([[1, 5], [11, 5], [1, 6]], states, 5), ['A'], 'one kilometre into a neighbour does not count');
  assert.equal(pairKey('b', 'a'), 'a|b');
});

test('every state of the scope has one map DLC, taken from its cities', () => {
  for (const s of scope.states) {
    const dlcs = new Set(cities.filter((c) => c.state === s.code).map((c) => c.dlc));
    assert.equal(dlcs.size, 1, `${s.code}: ${[...dlcs]}`);
  }
  assert.equal(ds.stateDlc.CA, 'base');
  assert.equal(ds.stateDlc.NV, 'base');
  assert.equal(ds.stateDlc.WA, 'washington');
});

test('route states: every pair has a route, keys are valid city pairs, ends are not repeated', () => {
  assert.deepEqual(routeStates.noRoute, []);
  const ids = new Set(cities.map((c) => c.id));
  const stateOf = new Map(cities.map((c) => [c.id, c.state]));
  const codes = new Set(scope.states.map((s) => s.code));
  for (const [k, via] of Object.entries(routeStates.via)) {
    const [a, b] = k.split('|');
    assert.ok(ids.has(a) && ids.has(b) && a < b, k);
    for (const s of via) {
      assert.ok(codes.has(s), `${k}: ${s}`);
      assert.ok(s !== stateOf.get(a) && s !== stateOf.get(b), `${k}: ${s} is an end`);
    }
  }
});

test('a trip needs the map DLC of every state it touches', () => {
  const ctx = { cityState: new Map(cities.map((c) => [c.id, c.state])), stateDlc: ds.stateDlc, via: ds.via };
  assert.deepEqual(mapDlcs('sacramento', 'los-angeles', ctx), []);
  assert.deepEqual(mapDlcs('los-angeles', 'seattle', ctx), ['oregon', 'washington'], 'California to Washington crosses Oregon');
  assert.deepEqual(mapDlcs('seattle', 'los-angeles', ctx), ['oregon', 'washington'], 'the same both ways');
  assert.ok(mapDlcs('los-angeles', 'albuquerque', ctx).includes('arizona'), 'to New Mexico through Arizona');
});

test('jobs carry the map DLCs; the career filter and owned DLCs are honoured', () => {
  const jobs = possibleJobs(ds, { from: 'los-angeles', to: 'seattle' });
  assert.ok(jobs.length > 0);
  assert.ok(jobs.every((j) => j.dlcs.includes('oregon') && j.dlcs.includes('washington')));
  assert.equal(possibleJobs(ds, { from: 'los-angeles', to: 'seattle', baseOnly: true }).length, 0);
  assert.equal(possibleJobs(ds, { from: 'los-angeles', to: 'seattle', ownedDlcs: new Set(['washington']) }).length, 0, 'Oregon missing');
  assert.ok(possibleJobs(ds, { from: 'los-angeles', to: 'seattle', ownedDlcs: new Set(['washington', 'oregon', ...ds.cargo.map((c) => c.dlc)]) }).length > 0);
  const owned = new Set(['oregon']);
  for (let s = 1; s <= 20; s++) {
    const j = randomJob(ds, { seed: s, ownedDlcs: owned });
    assert.ok(j && j.dlcs.every((d) => owned.has(d)), `seed ${s}`);
  }
});

test('the packed dataset keeps the map DLC data', () => {
  const back = unpackJobDataset(JSON.parse(JSON.stringify(packJobDataset(ds))));
  assert.deepEqual(back.stateDlc, ds.stateDlc);
  assert.deepEqual(back.via, ds.via);
});
