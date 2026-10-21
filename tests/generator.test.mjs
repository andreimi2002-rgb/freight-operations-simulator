import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildJobDataset, packJobDataset, unpackJobDataset } from '../src/engine/dataset.mjs';
import { departures, possibleJobs, featuredCity, hash, rng, driveHours, indexDataset, randomJob, seedToCode, codeToSeed } from '../src/engine/generator.mjs';
import { distance, weight, localDateHour, clockTime, kmToMi } from '../src/lib/ats.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const load = (f) => JSON.parse(readFileSync(`${root}data/ats/${f}.json`, 'utf8'));
const distances = load('distances');
const ds = buildJobDataset({
  cities: load('cities').cities,
  companies: load('companies').companies,
  cargo: load('cargo').cargo,
  trailers: load('trailers').trailers,
  distances,
});
const ix = indexDataset(ds);

/** Every rule that makes a job possible in the game. */
function assertValid(j, from) {
  const src = ds.depots[j.source];
  const dst = ds.depots[j.destination];
  const cargo = ix.cargo.get(j.cargo);
  assert.equal(src.city, from, 'leaves from the city');
  assert.notEqual(dst.city, from, 'goes to another city');
  assert.equal(dst.city, j.to);
  assert.ok(src.offers.some((o) => o.cargo === j.cargo), `${src.company} offers ${j.cargo}`);
  assert.ok(dst.accepts.some((a) => a.cargo === j.cargo), `${dst.company} accepts ${j.cargo}`);
  assert.equal(j.km, ds.km[`${from}>${j.to}`]);
  if (j.trailer) assert.ok(cargo.trailers.includes(j.trailer), `${j.trailer} allowed for ${j.cargo}`);
  if (j.weightLb != null) assert.ok(j.weightLb >= cargo.w[0] && j.weightLb <= cargo.w[1], `weight in range for ${j.cargo}`);
  if (cargo.dlc !== 'base') assert.ok(j.dlcs.includes(cargo.dlc), 'cargo DLC listed as needed');
}

test('seeded random is deterministic', () => {
  assert.equal(hash('sacramento|2026-10-22|14'), hash('sacramento|2026-10-22|14'));
  assert.notEqual(hash('sacramento|2026-10-22|14'), hash('sacramento|2026-10-22|15'));
  const a = rng(42); const b = rng(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test('same city, date and hour give the same board; the next hour gives another', () => {
  const a = departures(ds, { city: 'sacramento', date: '2026-10-22', hour: 14 });
  const b = departures(ds, { city: 'sacramento', date: '2026-10-22', hour: 14 });
  const c = departures(ds, { city: 'sacramento', date: '2026-10-22', hour: 15 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(a.length, 12);
});

test('every board job on every city is possible in the game and leaves within six hours', () => {
  for (const city of ds.cities) {
    const board = departures(ds, { city: city.id, date: '2026-10-22', hour: 9 });
    let last = -1;
    for (const j of board) {
      assertValid(j, city.id);
      assert.ok(j.weightLb != null, 'board jobs have a weight');
      assert.ok(j.departMinute >= 9 * 60 && j.departMinute < 15 * 60, `${city.id}: departs in the window`);
      assert.ok(j.departMinute >= last, 'sorted by time');
      last = j.departMinute;
    }
    assert.equal(new Set(board.map((j) => j.id)).size, board.length, 'unique ids');
  }
});

test('the planner lists only possible jobs and honours its filters', () => {
  const all = possibleJobs(ds, { from: 'sacramento', to: 'las-vegas' });
  assert.ok(all.length > 0);
  all.forEach((j) => assertValid(j, 'sacramento'));
  const base = possibleJobs(ds, { from: 'sacramento', to: 'las-vegas', baseOnly: true });
  assert.ok(base.length < all.length && base.every((j) => j.dlcs.length === 0));
  const noHaz = possibleJobs(ds, { from: 'sacramento', allowHazmat: false });
  assert.ok(noHaz.every((j) => !ix.cargo.get(j.cargo).hz));
  const flatbed = possibleJobs(ds, { from: 'sacramento', trailer: 'flatbed' });
  assert.ok(flatbed.length && flatbed.every((j) => ix.cargo.get(j.cargo).trailers.includes('flatbed')));
  const owned = possibleJobs(ds, { from: 'sacramento', ownedDlcs: new Set(['heavy-cargo-pack']) });
  assert.ok(owned.every((j) => j.dlcs.every((d) => d === 'heavy-cargo-pack')));
});

test('every city has jobs to other cities', () => {
  for (const c of ds.cities) assert.ok(possibleJobs(ds, { from: c.id }).length > 0, c.id);
});

test('the featured city is the same for everyone in an hour', () => {
  const a = featuredCity(ds, { date: '2026-10-22', hour: 9 });
  assert.equal(a, featuredCity(ds, { date: '2026-10-22', hour: 9 }));
  assert.ok(ds.cities.some((c) => c.id === a));
});

test('the packed dataset unpacks to the same data and stays small', () => {
  const packed = JSON.stringify(packJobDataset(ds));
  assert.deepEqual(unpackJobDataset(JSON.parse(packed)), JSON.parse(JSON.stringify(ds)));
  assert.ok(packed.length < 200 * 1024, `packed size ${packed.length}`);
});

test('distances: every ordered pair, positive, marked as estimate with OSM attribution', () => {
  const n = ds.cities.length;
  assert.equal(distances.pairs.length, n * (n - 1));
  assert.equal(distances.meta.provenance, 'estimated');
  assert.equal(distances.meta.licence, 'ODbL 1.0');
  assert.ok(distances.meta.attribution.includes('OpenStreetMap'));
  for (const p of distances.pairs) assert.ok(p.km > 0, `${p.from}>${p.to}`);
  const la = distances.pairs.find((p) => p.from === 'los-angeles' && p.to === 'san-francisco');
  assert.ok(kmToMi(la.km) > 330 && kmToMi(la.km) < 430, 'LA to SF is about 380 mi by road');
});

test('drive time at 55 mph; distance, weight and clock formatting', () => {
  assert.equal(driveHours(88.5), 1);
  assert.deepEqual(distance(160.9344, 'us'), { value: 100, unit: 'mi' });
  assert.deepEqual(distance(160.4, 'metric'), { value: 160, unit: 'km' });
  assert.deepEqual(weight(22046, 'metric'), { value: 10000, unit: 'kg' });
  assert.deepEqual(weight(22046, 'us'), { value: 22046, unit: 'lb' });
  assert.deepEqual(clockTime(14 * 60 + 5), { text: '2:05 PM', nextDay: false });
  assert.deepEqual(clockTime(24 * 60 + 30), { text: '12:30 AM', nextDay: true });
  const { date, hour } = localDateHour('America/Los_Angeles', new Date('2026-10-22T21:30:00Z'));
  assert.equal(date, '2026-10-22');
  assert.equal(hour, 14);
});

test('a generated job is reproducible from its seed, valid, and honours the start city and career filter', () => {
  for (const seed of [1, 42, 123456789, 0xffffffff]) {
    const a = randomJob(ds, { seed });
    assert.deepEqual(a, randomJob(ds, { seed }), "same seed, same job");
    assertValid(a, a.from);
    assert.ok(a.weightLb != null && a.trailer);
  }
  const sac = randomJob(ds, { seed: 7, from: "sacramento" });
  assert.equal(sac.from, "sacramento");
  for (let s = 1; s <= 40; s++) assert.deepEqual(randomJob(ds, { seed: s, baseOnly: true }).dlcs, []);
  const seeds = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(randomJob(ds, { seed: i + 1 }))));
  assert.ok(seeds.size > 15, "different seeds give different jobs");
});

test('job codes in the address round-trip and reject junk', () => {
  assert.equal(seedToCode(255), "000000ff");
  assert.equal(codeToSeed("000000ff"), 255);
  assert.equal(codeToSeed(seedToCode(0xdeadbeef)), 0xdeadbeef);
  assert.equal(codeToSeed("xyz"), null);
  assert.equal(codeToSeed(null), null);
});
