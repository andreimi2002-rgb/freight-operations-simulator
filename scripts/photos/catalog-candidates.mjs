#!/usr/bin/env node
// Photo candidates for the illustrative photos of trucks, trailers and generic cargo,
// and a wider search for the cities still without a photo (phase B6). Nothing is shown
// on the site until a choice is written to data/catalog-photos.json (or data/photos.json
// for cities), by hand, with the reason.
//
// For each entry of data/catalog-photo-queries.json:
//   image (P18) of the first Wikidata item found for each search term,
//   Commons file search for each search term,
//   for cities, the files of the Commons category.
// Every file must pass the Commons rules in lib/commons.mjs (free licence, author,
// photo not map/flag/logo/collage) and be wide enough.
//
//   node scripts/photos/catalog-candidates.mjs [--offline]  → data/catalog-photo-candidates.json
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createClient } from '../ats/lib/wiki-client.mjs';
import { toPhoto, looksLikeAPhoto, rankOrder } from './lib/commons.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const KINDS = ['trucks', 'trailers', 'cargo', 'cities'];
const MIN_WIDTH = { trucks: 800, trailers: 800, cargo: 800, cities: 1200 };
const SEARCH_LIMIT = 12;
const CATEGORY_LIMIT = 60;
const MAX_CANDIDATES = 12;
const THUMB = 1600;
const client = createClient({ cacheDir: join(root, '.cache/wiki'), offline: process.argv.includes('--offline'), log: console.error });
const get = (base, params) => client.getJson(`${base}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`);
const WD = 'https://www.wikidata.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const IMAGE_FILE = /\.(jpe?g|png|webp)$/i;

const queries = JSON.parse(readFileSync(join(root, 'data/catalog-photo-queries.json'), 'utf8'));
const names = {
  trucks: new Map(JSON.parse(readFileSync(join(root, 'data/ats/trucks.json'), 'utf8')).trucks.map((x) => [x.id, x.name])),
  trailers: new Map(JSON.parse(readFileSync(join(root, 'data/ats/trailers.json'), 'utf8')).trailers.map((x) => [x.id, x.name])),
  cargo: new Map(JSON.parse(readFileSync(join(root, 'data/ats/cargo.json'), 'utf8')).cargo.map((x) => [x.id, x.name])),
  cities: new Map(JSON.parse(readFileSync(join(root, 'data/ats/cities.json'), 'utf8')).cities.map((x) => [x.id, x.name])),
};

// Plain text of an extmetadata HTML value, shortened (used only to help the choice).
const plain = (html, max = 200) => {
  const s = String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s || null;
};

const wikidataItem = new Map();
async function firstItem(term) {
  if (!wikidataItem.has(term)) {
    const j = await get(WD, { action: 'wbsearchentities', search: term, language: 'en', type: 'item', limit: '1' });
    wikidataItem.set(term, j.search?.[0] ? { id: j.search[0].id, label: j.search[0].label, description: j.search[0].description ?? null } : null);
  }
  return wikidataItem.get(term);
}

// 1. Candidate file names per entry.
const entries = [];
for (const kind of KINDS) {
  for (const [id, q] of Object.entries(queries[kind] ?? {})) {
    if (!names[kind].has(id)) throw new Error(`${kind}/${id} is not in the game data`);
    const list = [];
    const add = (file, from) => {
      if (file && IMAGE_FILE.test(file) && looksLikeAPhoto(file) && !list.some((x) => x.file === file)) list.push({ file, from });
    };
    const items = [];
    for (const term of q.search) {
      const item = await firstItem(term);
      if (item && !items.some((x) => x.id === item.id)) items.push(item);
    }
    if (items.length) {
      const j = await get(WD, { action: 'wbgetentities', ids: items.map((x) => x.id).join('|'), props: 'claims' });
      for (const item of items) {
        (j.entities[item.id]?.claims?.P18 ?? [])
          .filter((c) => c.rank !== 'deprecated' && c.mainsnak?.datavalue)
          .sort((a, b) => rankOrder(a.rank) - rankOrder(b.rank))
          .forEach((c) => add(c.mainsnak.datavalue.value, `Wikidata image (P18) of ${item.id} "${item.label}"`));
      }
    }
    if (q.category) {
      const j = await get(COMMONS, { action: 'query', list: 'categorymembers', cmtitle: `Category:${q.category}`, cmtype: 'file', cmlimit: String(CATEGORY_LIMIT) });
      j.query.categorymembers.forEach((m) => add(m.title.replace(/^File:/, ''), `Commons category "${q.category}"`));
    }
    for (const term of q.search) {
      const j = await get(COMMONS, { action: 'query', list: 'search', srnamespace: '6', srsearch: term, srlimit: String(SEARCH_LIMIT) });
      j.query.search.forEach((r) => add(r.title.replace(/^File:/, ''), `Commons search "${term}"`));
    }
    entries.push({ kind, id, name: names[kind].get(id), note: q.note ?? null, wikidata: items, files: list });
  }
}

// 2. Commons file information.
const files = [...new Set(entries.flatMap((e) => e.files.map((x) => x.file)))];
const info = new Map();
for (let i = 0; i < files.length; i += 40) {
  const j = await get(COMMONS, {
    action: 'query', prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: String(THUMB),
    iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|ImageDescription|DateTimeOriginal',
    titles: files.slice(i, i + 40).map((f) => `File:${f}`).join('|'),
  });
  const norm = new Map((j.query.normalized ?? []).map((n) => [n.to, n.from]));
  for (const p of j.query.pages) {
    const name = (norm.get(p.title) ?? p.title).replace(/^File:/, '');
    if (p.imageinfo?.[0]) info.set(name, p.imageinfo[0]);
  }
}

// 3. The rules, and the output.
const today = new Date().toISOString().slice(0, 10);
const out = Object.fromEntries(KINDS.map((k) => [k, {}]));
let total = 0;
for (const e of entries) {
  const ok = [];
  let rejected = 0;
  for (const cand of e.files) {
    const ii = info.get(cand.file);
    const r = toPhoto(ii, { ...cand, verified: today, minWidth: MIN_WIDTH[e.kind] });
    if (!r.photo) { rejected++; continue; }
    const meta = ii.extmetadata ?? {};
    ok.push({ ...r.photo, description: plain(meta.ImageDescription?.value), date: plain(meta.DateTimeOriginal?.value, 40) });
  }
  out[e.kind][e.id] = { name: e.name, note: e.note, wikidata: e.wikidata, candidates: ok.slice(0, MAX_CANDIDATES), rejected };
  total += Math.min(ok.length, MAX_CANDIDATES);
}
writeFileSync(join(root, 'data/catalog-photo-candidates.json'), `${JSON.stringify({
  meta: {
    description: 'Photo candidates for the illustrative photos of trucks, trailers and generic cargo, and for the cities still without a photo. Not shown on the site; the chosen photo goes to data/catalog-photos.json (cities: data/photos.json).',
    source: 'Wikimedia Commons (files, search, categories), Wikidata (P18)',
    rules: `free licence with author (or public domain), photo not map/flag/logo/collage, at least ${MIN_WIDTH.trucks} px wide (cities ${MIN_WIDTH.cities} px)`,
    retrieved: today,
    generator: 'scripts/photos/catalog-candidates.mjs',
  },
  ...out,
}, null, 2)}\n`);
const none = entries.filter((e) => !out[e.kind][e.id].candidates.length).map((e) => `${e.kind}/${e.id}`);
console.log(JSON.stringify({ entries: entries.length, candidates: total, withoutCandidates: none, network: client.stats() }, null, 2));
