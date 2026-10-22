// Checks the collected files in data/ats/ (written by scripts/ats/collect.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../data/ats/', import.meta.url));
const load = (f) => JSON.parse(readFileSync(dir + f, 'utf8'));
const scope = load('scope.json');
const { meta: cityMeta, cities } = load('cities.json');
const { companies } = load('companies.json');
const { cargo } = load('cargo.json');
const { trailers } = load('trailers.json');
const { issues } = load('issues.json');
const ids = (list) => new Set(list.map((x) => x.id));

test('every file has the source, licence and retrieval date in meta', () => {
  for (const f of ['cities.json', 'companies.json', 'cargo.json', 'trailers.json', 'issues.json']) {
    const { meta } = load(f);
    assert.equal(meta.source, 'Truck Simulator Wiki', f);
    assert.equal(meta.licence, 'CC BY-SA 4.0', f);
    assert.equal(meta.licenceUrl, 'https://creativecommons.org/licenses/by-sa/4.0/', f);
    assert.match(meta.retrieved, /^\d{4}-\d{2}-\d{2}$/, f);
    assert.ok(meta.attribution.includes('Truck Simulator Wiki contributors'), f);
    assert.deepEqual(meta.states, scope.states.map((s) => s.code), f);
  }
  assert.equal(cityMeta.extraSources[0].source, 'Wikidata');
  assert.equal(cityMeta.extraSources[0].licence, 'CC0 1.0');
});

test('ids are unique and URL-safe', () => {
  for (const [name, list] of [['cities', cities], ['companies', companies], ['cargo', cargo], ['trailers', trailers]]) {
    assert.equal(ids(list).size, list.length, `${name}: duplicate id`);
    for (const x of list) assert.match(x.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${name}: ${x.id}`);
  }
});

test('cities: every state in scope is present, with valid time zones and coordinates', () => {
  for (const s of scope.states) assert.ok(cities.some((c) => c.state === s.code), `no city in ${s.code}`);
  for (const c of cities) {
    assert.ok(scope.states.some((s) => s.code === c.state), c.id);
    assert.equal(c.gameId, null, `${c.id}: the wiki has no city game ids`);
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en-US', { timeZone: c.timezone.iana }), c.id);
    if (c.coordinates) {
      assert.ok(Math.abs(c.coordinates.lat) <= 90 && Math.abs(c.coordinates.lon) <= 180, c.id);
      assert.match(c.coordinates.wikidata, /^Q\d+$/, c.id);
    } else {
      assert.ok(issues.some((i) => i.kind === 'missingCoordinates' && i.entity === c.id), `${c.id}: no coordinates and no issue`);
    }
    assert.ok(c.depots.length > 0, `${c.id}: no depots`);
    assert.match(c.wiki.url, /^https:\/\/trucksimulator\.wiki\.gg\/wiki\//, c.id);
  }
});

test('references between files resolve', () => {
  const cityIds = ids(cities);
  const companyIds = ids(companies);
  const cargoIds = ids(cargo);
  const trailerIds = ids(trailers);
  for (const c of cities) {
    for (const d of c.depots) assert.ok(companyIds.has(d.company), `${c.id} → ${d.company}`);
    for (const n of c.neighbors) assert.ok(cityIds.has(n), `${c.id} neighbor ${n}`);
  }
  for (const co of companies) {
    for (const d of co.depotTypes) {
      for (const cid of d.cities) {
        assert.ok(cityIds.has(cid), `${co.id} → ${cid}`);
        const city = cities.find((c) => c.id === cid);
        assert.ok(city.depots.some((x) => x.company === co.id && x.depotGameId === d.gameId), `${cid} lacks depot ${co.id}`);
      }
      const all = [...d.accepts, ...d.provides, ...Object.values(d.dlcCargo).flatMap((x) => [...x.accepts, ...x.provides])];
      for (const k of all) assert.ok(cargoIds.has(k), `${co.id}/${d.type}: cargo ${k}`);
    }
  }
  for (const c of cargo) for (const t of c.trailerTypes) assert.ok(trailerIds.has(t), `${c.id}: trailer ${t}`);
  for (const t of trailers) for (const k of t.cargo) assert.ok(cargoIds.has(k), `${t.id}: cargo ${k}`);
});

test('depot game ids look like game company names', () => {
  for (const co of companies) for (const d of co.depotTypes) {
    if (d.gameId !== null) assert.match(d.gameId, /^[a-z0-9_]+$/, co.id);
    else assert.ok(issues.some((i) => i.kind === 'missingGameId' && i.entity === co.id), `${co.id}: null gameId without issue`);
  }
});

test('cargo values are numbers or empty with a recorded issue', () => {
  const flagged = (id, field) => issues.some((i) => i.entity === id && i.field === field);
  for (const c of cargo) {
    if (c.weightLb) assert.ok(c.weightLb.min > 0 && c.weightLb.max >= c.weightLb.min, c.id);
    else assert.ok(flagged(c.id, 'weightLb'), `${c.id}: no weight, no issue`);
    if (c.valuePerKm == null) assert.ok(flagged(c.id, 'valuePerKm'), `${c.id}: no value, no issue`);
    if (c.un !== null) assert.match(c.un, /^\d{4}$/, c.id);
    assert.equal(c.gameId, null);
  }
});

test('the cargo catalog is complete: every DLC named in the wiki summary is present', () => {
  const dlcs = new Set(cargo.map((c) => c.dlc));
  for (const d of ['heavy-cargo-pack', 'special-transport', 'forest-machinery', 'volvo-construction-equipment', 'farm-machinery', 'jcb-equipment-pack', 'krone-agriculture-equipment', 'bobcat-cargo-pack']) {
    assert.ok(dlcs.has(d), d);
  }
  assert.ok(cargo.length >= 290, `only ${cargo.length} cargo`);
});

test('every approved alias points to cargo in the catalog', () => {
  const { cargo: aliases } = load('aliases.json');
  const cargoIds = ids(cargo);
  for (const a of aliases) {
    assert.ok(a.reason, `${a.name}: no reason`);
    for (const id of a.cargo) assert.ok(cargoIds.has(id), `${a.name} → ${id}`);
  }
});

test('trucks: released models only, with horsepower and a wiki link', () => {
  const { meta, trucks } = load('trucks.json');
  assert.equal(meta.licence, 'CC BY-SA 4.0');
  assert.ok(trucks.length >= 10);
  for (const t of trucks) {
    assert.match(t.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(t.manufacturer, `${t.id}: manufacturer`);
    assert.ok(t.maxHp >= 300 && t.maxHp <= 800, `${t.id}: maxHp ${t.maxHp}`);
    assert.match(t.wiki.url, /^https:\/\/trucksimulator\.wiki\.gg\/wiki\//);
  }
  const future = issues.filter((i) => i.kind === 'futureTruck').map((i) => i.entity);
  for (const f of future) assert.ok(!trucks.some((t) => t.id === f), `${f} is announced only`);
});
