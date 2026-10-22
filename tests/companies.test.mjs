import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { companyPath, monogram, companyRelations, companiesByCategory, companyCities } from '../src/lib/companies.mjs';
import { buildJobDataset } from '../src/engine/dataset.mjs';
import { randomJob, possibleJobs } from '../src/engine/generator.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const load = (f) => JSON.parse(readFileSync(`${root}data/ats/${f}.json`, 'utf8'));
const { companies } = load('companies');
const { cities } = load('cities');
const en = JSON.parse(readFileSync(`${root}src/i18n/en.json`, 'utf8'));
const byId = new Map(companies.map((c) => [c.id, c]));

test('one page per company with depots on the map; every city depot links to one', () => {
  assert.ok(companies.length > 0);
  for (const c of companies) {
    assert.equal(companyPath(c), `/ats/company/${c.id}`);
    assert.ok(companyCities(c).length > 0, `${c.id} has cities`);
  }
  for (const city of cities) for (const d of city.depots) assert.ok(byId.has(d.company), `${city.id} → ${d.company}`);
});

test('every company category has a label and the grouping covers all companies', () => {
  const groups = companiesByCategory(companies);
  assert.equal(groups.reduce((n, g) => n + g.companies.length, 0), companies.length);
  for (const g of groups) assert.ok(en.companies.categories[g.category], `no label for category ${g.category}`);
});

test('relations only list real links: partner accepts (or provides) the shared cargo in another city', () => {
  const cargoOf = (d, side) => new Set([...d[side], ...Object.values(d.dlcCargo ?? {}).flatMap((v) => v[side])]);
  for (const c of companies.slice(0, 20)) {
    for (const [side, other] of [['provides', 'accepts'], ['accepts', 'provides']]) {
      for (const r of companyRelations(c, companies, side)) {
        for (const cargoId of r.cargo) {
          assert.ok(c.depotTypes.some((d) => cargoOf(d, side).has(cargoId)), `${c.id} ${side} ${cargoId}`);
          assert.ok(r.company.depotTypes.some((d) => cargoOf(d, other).has(cargoId)), `${r.company.id} ${other} ${cargoId}`);
        }
        assert.ok(r.cities.length > 0);
      }
    }
  }
});

test('monogram', () => {
  assert.equal(monogram('Coastline Mining'), 'CM');
  assert.equal(monogram('Apade'), 'AP');
  assert.equal(monogram("Farmer's Barn"), 'FB');
});

test('a job generated for a company leaves from one of its depots', () => {
  const ds = buildJobDataset({ cities, companies, cargo: load('cargo').cargo, trailers: load('trailers').trailers, distances: load('distances'), trucks: load('trucks').trucks });
  for (const id of ['apade', 'coastline-mining', 'wallbert']) {
    if (!byId.has(id)) continue;
    for (let s = 1; s <= 10; s++) {
      const j = randomJob(ds, { seed: s, company: id });
      assert.ok(j, `${id} seed ${s}`);
      assert.equal(ds.depots[j.source].company, id);
    }
  }
  assert.ok(possibleJobs(ds, { from: 'sacramento', company: 'apade' }).every((j) => ds.depots[j.source].company === 'apade'));
});
