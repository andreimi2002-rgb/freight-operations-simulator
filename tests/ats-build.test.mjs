import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDataset } from '../scripts/ats/lib/build.mjs';

const scope = {
  states: [{ code: 'CA', name: 'California' }, { code: 'NV', name: 'Nevada' }],
  timezones: { PDT: 'America/Los_Angeles' },
};

const city = (title, name, state, extra = {}) => ({
  title, name, state, dlc: 'base', addedInUpdate: null, timezoneGame: 'PDT', companyCount: null,
  truckDealers: [], facilities: [], roads: [], facilityDetails: [], landmarks: [],
  depotLinks: [], connectionLinks: [], notes: [], revid: 1, ...extra,
});

const row = (name, extra = {}) => ({
  name, introducedWith: { kind: 'launch', name: null }, weightLb: { min: 1, max: 2 }, weightRaw: '1–2',
  valuePerKm: 1, valuePerKmRange: null, valuePerKmAlt: [], valueRaw: '1', un: null, unExpected: null,
  unFlagged: false, unRaw: null, dynamicLoading: false, flags: [], hazmatClasses: [], unknownSkillIcons: [],
  trailerTypes: ['Dry Van'], ...extra,
});

const depot = (type, gameId, citiesByState, accepts = [], provides = [], extra = {}) => ({
  type, gameIds: gameId ? [gameId] : [], citiesByState, locations: {},
  cargo: { accepts: { base: accepts, dlc: {} }, provides: { base: provides, dlc: {} } }, ...extra,
});

function build(overrides = {}) {
  return buildDataset({
    scope,
    cityPages: [
      city('Sacramento', 'Sacramento', 'CA', { companyCount: 3, depotLinks: ['Apade', 'Ghost Co'], connectionLinks: ['Reno', 'Oregon', 'Huron (California)'] }),
      city('Reno', 'Reno', 'NV'),
      city('Huron (California)', 'Huron', 'CA'),
    ],
    companyPages: [
      { title: 'Apade', name: 'Apade', fullName: 'Apade Auto Parts', category: 'vehicle', industry: 'x', defIds: ['apa_car_whs'], notes: [], revid: 2,
        depotTypes: [depot('Warehouse', 'apa_car_whs', { California: ['Sacramento', 'Huron'], Arizona: ['Yuma'] }, ['Beverages', 'Frozen Foods', 'Mystery'], ['Transformer'])] },
      { title: 'Far Co', name: 'Far Co', defIds: [], notes: [], revid: 3, depotTypes: [depot('Plant', 'far_pln', { Oregon: ['Bend'] })] },
      { title: 'Ford', notes: ['no Infobox Company'] },
      { title: 'Gone', name: 'Gone', removed: true, depotTypes: [], defIds: [], notes: [] },
    ],
    cargoRows: [
      row('Beverages'),
      row('Frozen Food'),
      row('Transformer'),
      row('Transformer', { introducedWith: { kind: 'dlc', name: 'Heavy Cargo Pack' }, trailerTypes: ['Lowboy'] }),
      row('Grain', { trailerTypes: ['Hopper'] }),
      row('Corn', { trailerTypes: ['Hopper'] }),
    ],
    cargoSummary: { asOfUpdate: '1.61', base: 4, total: 6, dlc: { 'Heavy Cargo Pack': 1 } },
    trailerPages: [
      { title: 'Dry Van Trailer', name: 'Dry Van', priceUsd: 41380, ownable: true, articulated: false, cargoTypesNote: null, cargo: ['Beverages'], revid: 4 },
      { title: 'Grain Hopper Trailer', name: 'Grain Hopper', priceUsd: 50000, ownable: true, articulated: false, cargoTypesNote: null, cargo: ['Grain', 'Corn'], revid: 5 },
    ],
    titleRedirects: new Map(),
    coordinates: new Map([['sacramento', { lat: 38.5, lon: -121.5, wikidata: 'Q18013' }], ['reno', { error: 'none' }]]),
    pageUrl: (t) => `https://wiki/${t}`,
    ...overrides,
  });
}

test('depots come from company pages and only for states in scope', () => {
  const d = build();
  assert.deepEqual(d.companies.map((c) => c.id), ['apade']);
  const sac = d.cities.find((c) => c.id === 'sacramento');
  assert.deepEqual(sac.depots, [{ company: 'apade', depotGameId: 'apa_car_whs', type: 'Warehouse' }]);
  assert.deepEqual(d.companies[0].depotTypes[0].cities, ['huron', 'sacramento']);
});

test('a link to a disambiguation page in a state row is matched by name and noted', () => {
  const d = build();
  assert.ok(d.issues.some((i) => i.kind === 'linkResolvedByName' && i.detail.includes('"Huron"')));
});

test('cargo names: same name gets a DLC suffix; DLC context chooses; plural matched and noted; unknown left out', () => {
  const d = build();
  assert.ok(d.cargo.some((c) => c.id === 'transformer'));
  assert.ok(d.cargo.some((c) => c.id === 'transformer-heavy-cargo-pack'));
  const wh = d.companies[0].depotTypes[0];
  assert.deepEqual(wh.accepts, ['beverages', 'frozen-food']);
  assert.deepEqual(wh.provides, ['transformer'], 'base section picks the base game version');
  assert.ok(d.issues.some((i) => i.kind === 'nameVariant' && i.detail.includes('Frozen Foods')));
  assert.ok(d.issues.some((i) => i.kind === 'unknownCargo' && i.detail.includes('Mystery')));
});

test('cross-checks: city page vs company pages, company count, neighbors', () => {
  const d = build();
  const sac = d.cities.find((c) => c.id === 'sacramento');
  assert.deepEqual(sac.neighbors, ['huron', 'reno']);
  assert.ok(d.issues.some((i) => i.kind === 'mismatch' && i.entity === 'sacramento' && i.field === 'companyCount'));
});

test('coordinates are kept or reported missing', () => {
  const d = build();
  assert.deepEqual(d.cities.find((c) => c.id === 'sacramento').coordinates, { lat: 38.5, lon: -121.5, wikidata: 'Q18013' });
  assert.equal(d.cities.find((c) => c.id === 'reno').coordinates, null);
  assert.ok(d.issues.some((i) => i.kind === 'missingCoordinates' && i.entity === 'reno'));
});

test('trailer types from the cargo list, dealer models by name or by shared cargo', () => {
  const d = build();
  const byId = Object.fromEntries(d.trailers.map((t) => [t.id, t]));
  assert.deepEqual(Object.keys(byId).sort(), ['dry-van', 'hopper', 'lowboy']);
  assert.deepEqual(byId['dry-van'].models.map((m) => [m.id, m.match.by]), [['dry-van', 'name']]);
  assert.deepEqual(byId.hopper.models.map((m) => [m.id, m.match.by, m.match.jaccard]), [['grain-hopper', 'cargo overlap', 1]]);
  assert.deepEqual(byId.lowboy.models, []);
  assert.deepEqual(byId.hopper.cargo, ['corn', 'grain']);
  assert.ok(d.issues.some((i) => i.kind === 'noTrailerPage' && i.ids.includes('lowboy')));
});

test('removed companies are skipped silently, non-company pages are reported', () => {
  const d = build();
  assert.ok(d.issues.some((i) => i.kind === 'skippedPage' && i.entity === 'Ford'));
  assert.ok(!d.issues.some((i) => i.entity === 'Gone' || i.entity === 'gone'));
});

test('summary counts are compared with the table', () => {
  const d = build();
  const counts = d.issues.filter((i) => i.kind === 'countMismatch').map((i) => i.detail);
  assert.equal(counts.length, 1);
  assert.match(counts[0], /says 4 base cargoes; the table has 5/);
});

test('approved aliases: a typo maps to one cargo, a generic name to every variant and is marked', () => {
  const d = build({
    aliases: { cargo: [
      { name: 'Mystery', cargo: ['beverages'], reason: 'typo on the wiki' },
      { name: 'Frozen Foods', cargo: ['frozen-food', 'beverages'], reason: 'generic', generic: true },
      { name: 'Nothing', cargo: ['not-a-cargo'], reason: 'bad' },
    ] },
  });
  const wh = d.companies[0].depotTypes[0];
  assert.deepEqual(wh.accepts, ['beverages', 'frozen-food']);
  assert.deepEqual(wh.genericNames, { 'Frozen Foods': ['frozen-food', 'beverages'] });
  assert.ok(!d.issues.some((i) => i.kind === 'unknownCargo'));
  assert.ok(d.issues.some((i) => i.kind === 'aliasApplied' && i.entity === 'mystery'));
  assert.ok(d.issues.some((i) => i.kind === 'aliasError' && i.entity === 'nothing'));
});

test('a trailer page found by title is attached to its type', () => {
  const base = build();
  const d = build({
    trailerPages: [
      { title: 'Lowboy Trailer', name: 'Lowboy', priceUsd: null, pricesUsd: [], ownable: false, articulated: false, cargoTypesNote: null, cargo: [], revid: 9, forType: 'Lowboy' },
    ],
  });
  assert.deepEqual(base.trailers.find((t) => t.id === 'lowboy').models, []);
  const lowboy = d.trailers.find((t) => t.id === 'lowboy');
  assert.deepEqual(lowboy.models.map((m) => [m.id, m.match.by, m.ownable]), [['lowboy', 'page title', false]]);
});
