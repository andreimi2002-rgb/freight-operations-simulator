#!/usr/bin/env node
// Collect American Truck Simulator data for the states in data/ats/scope.json
// from Truck Simulator Wiki (CC BY-SA 4.0) and write data/ats/*.json.
//
//   node scripts/ats/collect.mjs            use the local cache, fetch what is missing
//   node scripts/ats/collect.mjs --refresh  fetch everything again (new game update)
//   node scripts/ats/collect.mjs --offline  cache only, never touch the network
//
// At most one request per second per host; cache in .cache/wiki/ (not in git).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createClient, mediaWiki, USER_AGENT } from './lib/wiki-client.mjs';
import { parseCityPage, parseCompanyPage, parseCargoList, parseTrailerPage } from './lib/parse-ats.mjs';
import { linkTargets } from './lib/wikitext.mjs';
import { coordinatesFor } from './lib/wikidata.mjs';
import { buildDataset } from './lib/build.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const outDir = join(root, 'data/ats');
const args = new Set(process.argv.slice(2));
const log = (...m) => console.error(...m);

const scope = JSON.parse(readFileSync(join(outDir, 'scope.json'), 'utf8'));
const client = createClient({
  cacheDir: join(root, '.cache/wiki'),
  offline: args.has('--offline'),
  refresh: args.has('--refresh'),
  log,
});
const wiki = mediaWiki(client, scope.wiki.api);
const pageUrl = (title) => scope.wiki.pageBase + encodeURIComponent(title.replace(/ /g, '_')).replace(/%2F/g, '/').replace(/%3A/g, ':');

// 1. Current cities in the states in scope.
log('cities…');
const excluded = new Set();
for (const cat of scope.wiki.excludeCityCategories) for (const t of await wiki.categoryMembers(cat)) excluded.add(t);
const gameCities = new Set(await wiki.categoryMembers(scope.wiki.cityCategory));
const cityTitles = [];
for (const st of scope.states) {
  for (const t of await wiki.categoryMembers(st.category)) {
    if (gameCities.has(t) && !excluded.has(t)) cityTitles.push(t);
  }
}
const cityRaw = await wiki.pages(cityTitles);
const cityPages = cityTitles.map((t) => {
  const p = cityRaw.get(t);
  return p ? { ...parseCityPage(p.title, p.text), revid: p.revid } : { title: t, notes: ['page missing'] };
});

// 2. Companies (all ATS company pages; build keeps those with depots in scope).
log('companies…');
const companyTitles = await wiki.categoryMembers(scope.wiki.companyCategory);
const companyRaw = await wiki.pages(companyTitles);
const companyPages = companyTitles.map((t) => {
  const p = companyRaw.get(t);
  if (!p) return { title: t, notes: ['page missing'] };
  const mentionsScope = scope.states.some((s) => p.text.includes(`[[${s.name}]]`));
  return { ...parseCompanyPage(p.title, p.text), revid: p.revid, mentionsScope };
});

// 3. Cargo list.
log('cargo…');
const cargoPage = (await wiki.pages([scope.wiki.cargoListPage])).get(scope.wiki.cargoListPage);
const cargoList = parseCargoList(cargoPage.text);

// 4. Trailer type pages.
log('trailers…');
const trailerTitles = await wiki.categoryMembers(scope.wiki.trailerCategory);
const trailerRaw = await wiki.pages(trailerTitles);
const trailerPages = trailerTitles.map((t) => {
  const p = trailerRaw.get(t);
  return p ? { ...parseTrailerPage(p.title, p.text), revid: p.revid } : { title: t, notes: ['page missing'] };
});

// 5. Resolve redirects for every linked title we need to match.
log('redirects…');
const stateNames = new Set(scope.states.map((s) => s.name));
const known = new Set([...cityTitles, ...companyTitles]);
const toResolve = new Set();
for (const p of companyPages) for (const d of p.depotTypes ?? []) {
  for (const [st, titles] of Object.entries(d.citiesByState)) if (stateNames.has(st)) titles.forEach((t) => known.has(t) || toResolve.add(t));
}
for (const p of cityPages) for (const t of [...(p.depotLinks ?? []), ...(p.connectionLinks ?? [])]) if (!known.has(t)) toResolve.add(t);
const titleRedirects = await wiki.resolve([...toResolve]);

// 6. Coordinates from Wikidata.
log('coordinates…');
const prelim = cityPages.filter((p) => p.name).map((p) => {
  const st = scope.states.find((s) => s.code === p.state);
  return { id: null, title: p.title, name: p.name, stateName: st?.name, stateQid: st?.wikidata };
});
// Ids are assigned in build; use the same rule here (slug of name).
const { slug } = await import('./lib/wikitext.mjs');
const seen = new Set();
for (const c of prelim) {
  let id = slug(c.name);
  if (seen.has(id)) id = `${id}-${scope.states.find((s) => s.name === c.stateName).code.toLowerCase()}`;
  seen.add(id);
  c.id = id;
}
const coordinates = await coordinatesFor(client, prelim.filter((c) => c.stateQid));

// 7. Build and write.
const data = buildDataset({
  scope, cityPages, companyPages, cargoRows: cargoList.rows, cargoSummary: cargoList.summary, trailerPages, titleRedirects, coordinates, pageUrl,
});
for (const note of cargoList.notes) data.issues.push({ kind: 'parseError', entity: 'cargo list', detail: note });

const retrieved = new Date().toISOString().slice(0, 10);
const wikiMeta = {
  source: 'Truck Simulator Wiki',
  sourceUrl: 'https://trucksimulator.wiki.gg',
  licence: 'CC BY-SA 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  attribution: 'Game data from Truck Simulator Wiki contributors (trucksimulator.wiki.gg), CC BY-SA 4.0.',
  retrieved,
  generator: 'scripts/ats/collect.mjs',
  userAgent: USER_AGENT,
  game: scope.game,
  states: scope.states.map((s) => s.code),
};
const files = {
  'cities.json': {
    meta: {
      ...wikiMeta,
      description: 'Current cities of the game in the states in scope (removed and future cities excluded). Depots come from the company pages.',
      extraSources: [{
        field: 'coordinates',
        source: 'Wikidata',
        sourceUrl: 'https://www.wikidata.org',
        licence: 'CC0 1.0',
        licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
        note: 'Coordinates of the real-world city (P625), matched through the English Wikipedia article "<City>, <State>" and checked to lie in the state. They are real-world coordinates, not positions on the game map.',
      }],
      count: data.cities.length,
    },
    cities: data.cities,
  },
  'companies.json': {
    meta: { ...wikiMeta, description: 'Companies with at least one depot in the states in scope; only depot types present in scope are listed. gameId / defIds are the company definition names given on the wiki.', count: data.companies.length },
    companies: data.companies,
  },
  'cargo.json': {
    meta: { ...wikiMeta, description: 'Complete ATS cargo catalog from the wiki cargo list. weightLb in pounds; valuePerKm is the game unit_reward_per_km as given on the wiki.', sourcePage: pageUrl(scope.wiki.cargoListPage), sourceRevid: cargoPage.revid, count: data.cargo.length },
    cargo: data.cargo,
  },
  'trailers.json': {
    meta: { ...wikiMeta, description: 'Trailer types named on the cargo list, each with the dealer trailer models (wiki trailer pages) that belong to it. priceUsd is the base dealer price shown on the wiki.', count: data.trailers.length },
    trailers: data.trailers,
  },
  'issues.json': {
    meta: { ...wikiMeta, description: 'Problems found while collecting: missing values, contradictions between pages, names that do not match. For manual checking.', count: data.issues.length },
    issues: data.issues,
  },
};
mkdirSync(outDir, { recursive: true });
for (const [name, body] of Object.entries(files)) writeFileSync(join(outDir, name), `${JSON.stringify(body, null, 2)}\n`);

// 8. Summary.
const kinds = {};
for (const i of data.issues) kinds[i.kind] = (kinds[i.kind] ?? 0) + 1;
const st = client.stats();
console.log(JSON.stringify({
  cities: data.cities.length,
  citiesByState: Object.fromEntries(scope.states.map((s) => [s.code, data.cities.filter((c) => c.state === s.code).length])),
  companies: data.companies.length,
  depots: data.cities.reduce((n, c) => n + c.depots.length, 0),
  cargo: data.cargo.length,
  trailers: data.trailers.length,
  issues: data.issues.length,
  issuesByKind: kinds,
  network: st,
}, null, 2));
