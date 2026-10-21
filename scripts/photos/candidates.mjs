#!/usr/bin/env node
// Photo candidates for the city pages, for the owner to choose from (one per
// city, chosen by hand: DEVELOPMENT_PLAN.md, stage 2). Nothing is shown on the
// site until a choice is written to data/photos.json.
//
// For each city in data/ats/cities.json (its Wikidata item):
//   Wikivoyage banner (P948), image (P18, preferred first), lead image of the
//   English Wikipedia article, and a few photos from the city's Commons category (P373).
// Every file must pass the Commons rules in lib/commons.mjs (free licence,
// author, photo not map/flag/collage) and be at least 1200 px wide.
//
//   node scripts/photos/candidates.mjs   → data/photo-candidates.json
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createClient } from '../ats/lib/wiki-client.mjs';
import { toPhoto, looksLikeAPhoto, rankOrder } from './lib/commons.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const MAX = 4;
const MIN_WIDTH = 1200;
const THUMB = 1600;
const CATEGORY_FILES = 10;
const client = createClient({ cacheDir: join(root, '.cache/wiki'), offline: process.argv.includes('--offline'), log: console.error });
const get = (base, params) => client.getJson(`${base}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`);
const WD = 'https://www.wikidata.org/w/api.php';
const EN = 'https://en.wikipedia.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';

const { cities } = JSON.parse(readFileSync(join(root, 'data/ats/cities.json'), 'utf8'));
const withItem = cities.filter((c) => c.coordinates?.wikidata);

// 1. Wikidata claims.
const claims = new Map();
for (let i = 0; i < withItem.length; i += 50) {
  const ids = withItem.slice(i, i + 50).map((c) => c.coordinates.wikidata);
  const j = await get(WD, { action: 'wbgetentities', ids: ids.join('|'), props: 'claims|sitelinks', sitefilter: 'enwiki' });
  for (const [q, e] of Object.entries(j.entities)) claims.set(q, e);
}
const values = (e, p) => (e?.claims?.[p] ?? [])
  .filter((c) => c.rank !== 'deprecated' && c.mainsnak?.datavalue)
  .sort((a, b) => rankOrder(a.rank) - rankOrder(b.rank))
  .map((c) => c.mainsnak.datavalue.value);

// 2. English Wikipedia lead images.
const enTitles = withItem.map((c) => claims.get(c.coordinates.wikidata)?.sitelinks?.enwiki?.title).filter(Boolean);
const leadImage = new Map();
for (let i = 0; i < enTitles.length; i += 50) {
  const j = await get(EN, { action: 'query', prop: 'pageimages', piprop: 'name', titles: enTitles.slice(i, i + 50).join('|') });
  for (const p of j.query.pages) if (p.pageimage) leadImage.set(p.title, p.pageimage.replace(/_/g, ' '));
}

// 3. Candidate file names per city.
const candidates = new Map();
for (const c of withItem) {
  const e = claims.get(c.coordinates.wikidata);
  const list = [];
  const add = (file, from) => { if (file && !list.some((x) => x.file === file)) list.push({ file, from }); };
  values(e, 'P948').forEach((f) => add(f, 'Wikivoyage banner (P948)'));
  values(e, 'P18').forEach((f) => add(f, 'Wikidata image (P18)'));
  add(leadImage.get(e?.sitelinks?.enwiki?.title), 'Wikipedia lead image');
  const cat = values(e, 'P373')[0];
  if (cat) {
    const j = await get(COMMONS, { action: 'query', list: 'categorymembers', cmtitle: `Category:${cat}`, cmtype: 'file', cmlimit: '50' });
    j.query.categorymembers
      .map((m) => m.title.replace(/^File:/, ''))
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && looksLikeAPhoto(f))
      .slice(0, CATEGORY_FILES)
      .forEach((f) => add(f, `Commons category "${cat}"`));
  }
  candidates.set(c.id, list);
}

// 4. Commons file information and the rules.
const files = [...new Set([...candidates.values()].flat().map((x) => x.file))];
const info = new Map();
for (let i = 0; i < files.length; i += 40) {
  const j = await get(COMMONS, {
    action: 'query', prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: String(THUMB),
    iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl', titles: files.slice(i, i + 40).map((f) => `File:${f}`).join('|'),
  });
  const norm = new Map((j.query.normalized ?? []).map((n) => [n.to, n.from]));
  for (const p of j.query.pages) {
    const name = (norm.get(p.title) ?? p.title).replace(/^File:/, '');
    if (p.imageinfo?.[0]) info.set(name, p.imageinfo[0]);
  }
}

const today = new Date().toISOString().slice(0, 10);
const out = {};
let total = 0;
for (const c of withItem) {
  const ok = [];
  const rejected = [];
  for (const cand of candidates.get(c.id)) {
    const r = toPhoto(info.get(cand.file), { ...cand, verified: today, minWidth: MIN_WIDTH });
    if (r.photo) ok.push(r.photo); else rejected.push({ file: cand.file, reason: r.reject });
  }
  // Landscape first (the hero is wide), keeping source order otherwise.
  ok.sort((a, b) => Number(b.width > b.height) - Number(a.width > a.height));
  out[c.id] = { name: c.name, state: c.state, wikidata: c.coordinates.wikidata, candidates: ok.slice(0, MAX), rejected };
  total += out[c.id].candidates.length;
}
writeFileSync(join(root, 'data/photo-candidates.json'), `${JSON.stringify({
  meta: {
    description: 'Photo candidates for the city pages, for the owner to choose from. Not shown on the site; the chosen photo goes to data/photos.json.',
    source: 'Wikimedia Commons (files), Wikidata (P18, P948, P373), English Wikipedia (lead image)',
    rules: `free licence with author (or public domain), photo not map/flag/collage, at least ${MIN_WIDTH} px wide`,
    retrieved: today,
    generator: 'scripts/photos/candidates.mjs',
  },
  cities: out,
}, null, 2)}\n`);
const none = Object.entries(out).filter(([, v]) => !v.candidates.length).map(([k]) => k);
console.log(JSON.stringify({ cities: withItem.length, candidates: total, withoutCandidates: none, network: client.stats() }, null, 2));
