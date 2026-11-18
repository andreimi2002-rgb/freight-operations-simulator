import assert from 'node:assert/strict';
import { test } from 'node:test';
import { wikiFromGameData, WikiIndex, type GameData } from '@trucksim/core';
import { extractGameData } from '../src/gamedata/extract.ts';
import { findInstall } from '../src/gamedata/store.ts';
import { cityHash64 } from '../src/scs/cityhash.ts';
import { parseSii } from '../src/scs/sii.ts';

test('cityhash: empty string is K2 (the HashFS root directory)', () => {
  assert.equal(cityHash64(''), 0x9ae16a3b2f90404fn);
  // Stable across lengths that take the different code paths.
  for (const s of ['def', 'def/city.sii', 'def/company/subse/editor', 'a'.repeat(40), 'b'.repeat(100)]) {
    assert.equal(typeof cityHash64(s), 'bigint');
    assert.equal(cityHash64(s), cityHash64(Buffer.from(s)));
  }
});

test('sii: units, includes, arrays, vectors, one-line units, comments', () => {
  const files: Record<string, string> = {
    'def/city/a.sui': 'city_data : city.a\n{\n\tcity_name: "Aaa # not a comment"\n\tpopulation: 1200\n\tmap_x_offsets[]: 1\n\tmap_x_offsets[]: -2\n}\n',
  };
  const text = 'SiiNunit\n{\n# comment\n@include "city/a.sui"\ncompany_def : .x {\n city: brasov\n}\nthing: t.b\n{\n pos: (1, 2.5, -3)\n names[0]: "x"\n names[1]: "y"\n f: &3f800000\n}\n}\n';
  const units = parseSii('def/city.sii', text, (p) => files[p] ?? null);
  assert.equal(units.length, 3);
  const city = units.find((u) => u.className === 'city_data')!;
  assert.equal(city.name, 'city.a');
  assert.equal(city.attrs.city_name, 'Aaa # not a comment');
  assert.equal(city.attrs.population, 1200);
  assert.deepEqual(city.attrs.map_x_offsets, [1, -2]);
  assert.equal(city.source, 'def/city/a.sui');
  assert.equal(units.find((u) => u.className === 'company_def')!.attrs.city, 'brasov');
  const thing = units.find((u) => u.className === 'thing')!;
  assert.deepEqual(thing.attrs.pos, [1, 2.5, -3]);
  assert.deepEqual(thing.attrs.names, ['x', 'y']);
  assert.equal(thing.attrs.f, 1);
});

test('wiki from game data: ATS depots grouped by brand, telemetry ids resolve', () => {
  const gd: GameData = {
    meta: { game: 'ats', generatedAt: '', archivesStamp: 0, archives: 1, dlcs: [], languages: [], extractorVersion: 1 },
    countries: [{ id: 'california', name: 'California', nameRo: 'California', code: 'CA', iso: null, dlc: null }],
    cities: [{ id: 'san_francisco', name: 'San Francisco', nameRo: null, country: 'california', population: 870000, dlc: null, companies: ['ai_car_pln', 'ai_car_whs'] }],
    companies: [
      { id: 'ai_car_pln', name: 'AI Automotive', cities: ['san_francisco'], cargoOut: ['car_parts'], cargoIn: [], dlc: null },
      { id: 'ai_car_whs', name: 'AI Automotive', cities: ['san_francisco'], cargoOut: [], cargoIn: ['car_parts'], dlc: null },
    ],
    trucks: [],
    trailerAliases: { krone_cool: 'krone.coolliner.single_3.reefer' },
    trailers: [{ id: 'krone.coolliner', brand: 'Krone', model: 'Cool Liner', dlc: 'dlc_krone', bodies: [{ name: 'Cool Liner', bodyType: 'reefer', volumeM3: 87, lengthM: 13.55 }], chassis: ['3 axe'] }],
    cargo: [{ id: 'car_parts', name: 'Car Parts', nameRo: 'Piese auto', unitMassKg: 100, unitVolume: 1, rewardPerKm: 0.5, fragility: 0.3, adrClass: null, valuable: false, overweight: false, groups: [], bodyTypes: ['dryvan'], dlc: null }],
  };
  const w = new WikiIndex(wikiFromGameData(gd));
  assert.equal(w.data.companies.length, 1);
  assert.equal(w.companyByGameId('ai_car_whs')?.name, 'AI Automotive');
  assert.equal(w.city('san_francisco')?.state, 'California');
  assert.equal(w.city('san-francisco')?.name, 'San Francisco');
  assert.equal(w.cargo('car_parts')?.name, 'Piese auto');
  assert.equal(w.search('piese')[0]?.id, 'car_parts');
  assert.equal(w.trailerByGameId('krone.coolliner.single_3.reefer')?.name, 'Krone Cool Liner');
  assert.equal(w.trailer('krone.coolliner')?.dlc, 'krone');
  assert.equal(w.trailerByGameId('krone_cool')?.name, 'Krone Cool Liner', 'company job trailer resolved through its definition');
});

const ets2 = findInstall('ets2');
test('extract: reference job (Subse, Brașov -> Ruse, chocolate) from the installed ETS2', { skip: ets2 ? false : 'ETS2 not installed' }, () => {
  const { data } = extractGameData('ets2', ets2!);
  const brasov = data.cities.find((c) => c.id === 'brasov');
  assert.ok(brasov, 'Brașov exists (Road to the Black Sea)');
  assert.equal(brasov.country, 'romania');
  assert.ok(brasov.companies.includes('subse'));
  assert.equal(data.cities.find((c) => c.id === 'ruse')?.name, 'Ruse');
  assert.ok(data.companies.find((c) => c.id === 'subse')?.cargoOut.includes('chocolate'));
  assert.equal(data.cargo.find((c) => c.id === 'chocolate')?.nameRo, 'Ciocolată');
  // Recording 2026-11-18 14:40: the attached trailer had id "schw_curtain" with empty brand and name.
  assert.match(data.trailerAliases?.schw_curtain ?? '', /^schwmuller.curtain./);
  const w = new WikiIndex(wikiFromGameData(data));
  assert.match(w.trailerByGameId('schw_curtain')?.name ?? '', /^Schwarzmüller /);
});
