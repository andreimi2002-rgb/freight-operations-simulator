// Prepares one photo per city from Wikimedia Commons:
//   1. a hand-picked file from src/data/photos/curated.json (still checked by every rule below);
//   2. through Wikidata: GeoNames ID (P1566) -> Wikidata item -> image (P18, preferred rank first) or
//      Wikivoyage banner (P948);
//   3. the lead image of the city's Wikipedia article (languages per country: wikiLangs in countries.mjs).
// Each candidate must pass: Commons file information (author, licence, size, page), a free licence,
// a photo (not a map, flag, coat of arms or collage), and a checked thumbnail link.
// Writes src/data/photos/cities-<CC>.json (path from src/data/countries.mjs).
//   node scripts/build-city-photos.mjs            (active countries)
//   node scripts/build-city-photos.mjs AT GR      (explicit countries)
// Cities with several Wikidata items, no free photo, or only files that fail a rule are skipped (no guessing).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { ACTIVE_COUNTRIES, COUNTRIES } from "../src/data/countries.mjs";
import { groupByGeonames, matchCity, toPhoto } from "./lib/commons.mjs";

const USER_AGENT = "FOS city photos (https://github.com/andreimi2002-rgb/freight-operations-simulator)";
const SPARQL = "https://query.wikidata.org/sparql";
const COMMONS = "https://commons.wikimedia.org/w/api.php";
const THUMB_WIDTH = 1280;
const today = new Date().toISOString().slice(0, 10);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(url, options = {}, attempt = 1) {
  const response = await fetch(url, { ...options, headers: { "user-agent": USER_AGENT, ...(options.headers || {}) }, signal: AbortSignal.timeout(60000) });
  if ((response.status === 429 || response.status >= 500) && attempt < 4) {
    await sleep(2000 * attempt);
    return request(url, options, attempt + 1);
  }
  return response;
}

async function wikidataRows(geonamesIds, langs) {
  const query = `SELECT ?item ?geo ?img ?rank ?banner ?links ?wpLang ?wpTitle WHERE {
    VALUES ?geo { ${geonamesIds.map(id => `"${id}"`).join(" ")} }
    ?item wdt:P1566 ?geo .
    OPTIONAL { ?item wikibase:sitelinks ?links }
    OPTIONAL { ?item p:P18 ?st . ?st ps:P18 ?img ; wikibase:rank ?rank . FILTER(?rank != wikibase:DeprecatedRank) }
    OPTIONAL { ?item wdt:P948 ?banner }
    OPTIONAL { ?wp schema:about ?item ; schema:inLanguage ?wpLang ; schema:name ?wpTitle ; schema:isPartOf ?site . FILTER(?wpLang IN (${langs.map(l => `"${l}"`).join(", ")}) && CONTAINS(STR(?site), ".wikipedia.org")) }
  }`;
  const response = await request(SPARQL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/sparql-results+json" },
    body: new URLSearchParams({ query }),
  });
  if (!response.ok) throw new Error(`Wikidata answered HTTP ${response.status}`);
  const json = await response.json();
  return json.results.bindings.map(b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
}

async function commonsInfo(files) {
  const out = new Map();
  for (let i = 0; i < files.length; i += 40) {
    const batch = files.slice(i, i + 40);
    const params = new URLSearchParams({
      action: "query", format: "json", formatversion: "2", prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata", iiurlwidth: String(THUMB_WIDTH),
      iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl", titles: batch.map(f => `File:${f}`).join("|"),
    });
    const response = await request(`${COMMONS}?${params}`);
    if (!response.ok) throw new Error(`Commons answered HTTP ${response.status}`);
    const json = await response.json();
    const normalized = new Map((json.query?.normalized || []).map(n => [n.to, n.from]));
    for (const page of json.query?.pages || []) {
      const asked = (normalized.get(page.title) || page.title).replace(/^File:/, "");
      out.set(asked, page.imageinfo?.[0] || null);
    }
    await sleep(300);
  }
  return out;
}

// Lead image file name of Wikipedia articles: Map("lang|Title" -> file name | null).
async function wikipediaLeadImages(articles) {
  const out = new Map();
  const byLang = new Map();
  for (const a of articles) byLang.set(a.lang, [...(byLang.get(a.lang) || []), a.title]);
  for (const [lang, titles] of byLang) {
    for (let i = 0; i < titles.length; i += 40) {
      const batch = titles.slice(i, i + 40);
      const params = new URLSearchParams({ action: "query", format: "json", formatversion: "2", prop: "pageimages", piprop: "name", redirects: "1", titles: batch.join("|") });
      const response = await request(`https://${lang}.wikipedia.org/w/api.php?${params}`);
      if (!response.ok) continue;
      const json = await response.json();
      const redirected = new Map((json.query?.redirects || []).map(r => [r.to, r.from]));
      const normalized = new Map((json.query?.normalized || []).map(n => [n.to, n.from]));
      for (const page of json.query?.pages || []) {
        const asked = redirected.get(page.title) || page.title;
        out.set(`${lang}|${normalized.get(asked) || asked}`, page.pageimage || null);
      }
      await sleep(300);
    }
  }
  return out;
}

async function linkWorks(src) {
  try {
    const response = await request(src, { method: "HEAD" });
    return response.ok && /^image\//.test(response.headers.get("content-type") || "");
  } catch { return false; }
}

const curated = JSON.parse(await readFile(new URL("../src/data/photos/curated.json", import.meta.url), "utf8").catch(() => '{"photos":{}}')).photos || {};

// Tries the candidates in order; returns the first that passes every rule, or the reasons.
async function firstUsable(candidates, info, wikidata) {
  const reasons = [];
  for (const candidate of candidates) {
    const result = toPhoto(info.get(candidate.file), { ...candidate, verified: today });
    if (result.reject) { reasons.push(`${candidate.file}: ${result.reject}`); continue; }
    if (!(await linkWorks(result.photo.src))) { reasons.push(`${candidate.file}: link does not load`); continue; }
    return { photo: { ...result.photo, wikidata } };
  }
  return { reasons };
}

const codes = process.argv.slice(2).map(c => c.toUpperCase());
for (const code of codes.length ? codes : ACTIVE_COUNTRIES) {
  const country = COUNTRIES[code];
  if (!country?.photoFile) { console.error(`${code}: no photoFile in src/data/countries.mjs`); process.exitCode = 1; continue; }
  const catalog = JSON.parse(await readFile(new URL(`../src/data/${country.cityFile}`, import.meta.url), "utf8"));
  const ids = catalog.cities.map(city => String(city.id));
  const langs = [...new Set([...(country.wikiLangs || []), "en"])];

  const rows = [];
  for (let i = 0; i < ids.length; i += 60) { rows.push(...await wikidataRows(ids.slice(i, i + 60), langs)); await sleep(500); }
  const byGeo = groupByGeonames(rows);

  // Pass 1: hand-picked file, then P18 / P948.
  const matches = new Map();
  const skipped = {};
  for (const id of ids) {
    const match = matchCity(id, byGeo);
    // A hand-picked file is tied to the GeoNames ID itself, so a Wikidata ambiguity does not matter.
    if (match.skip && curated[id]) { matches.set(id, { qid: null, articles: [], candidates: [{ file: curated[id].file, from: "curated" }] }); continue; }
    if (match.skip) { skipped[id] = match.skip; continue; }
    const hand = curated[id] ? [{ file: curated[id].file, from: "curated" }] : [];
    matches.set(id, { ...match, candidates: [...hand, ...match.candidates.filter(c => c.file !== curated[id]?.file)] });
  }
  const photos = {};
  const failed = {};
  const info1 = await commonsInfo([...new Set([...matches.values()].flatMap(m => m.candidates.map(c => c.file)))]);
  for (const [id, match] of matches) {
    const result = await firstUsable(match.candidates, info1, match.qid);
    if (result.photo) photos[id] = result.photo; else failed[id] = result.reasons;
    await sleep(60);
  }

  // Pass 2: the lead image of the city's Wikipedia article, for cities still without a photo.
  const pending = [...matches].filter(([id]) => !photos[id]);
  const wiki = await wikipediaLeadImages(pending.flatMap(([, m]) => m.articles));
  const wikiCandidates = new Map(pending.map(([id, m]) => [id, [...new Set(m.articles.map(a => wiki.get(`${a.lang}|${a.title}`)).filter(Boolean))].map(file => ({ file: file.replace(/_/g, " "), from: "wikipedia" }))]));
  const info2 = await commonsInfo([...new Set([...wikiCandidates.values()].flat().map(c => c.file))]);
  for (const [id, match] of pending) {
    const result = await firstUsable(wikiCandidates.get(id), info2, match.qid);
    if (result.photo) photos[id] = result.photo;
    else {
      const all = [...(failed[id] || []), ...(result.reasons || [])];
      skipped[id] = all.join("; ") || "no image on Wikidata or Wikipedia";
    }
    await sleep(60);
  }

  const output = {
    metadata: {
      provider: "Wikimedia Commons via Wikidata and Wikipedia",
      countryCode: code,
      builtAt: new Date().toISOString(),
      rule: "hand-picked file (curated.json) or GeoNames ID (P1566) -> one Wikidata item (several: only one with >= 3x the sitelinks of the next) -> P18 (preferred first), P948 banner, or the Wikipedia lead image; free licences only (PD, CC0, CC BY, CC BY-SA, Attribution, FAL); >= 500 px; maps, flags, coats of arms, logos and collages excluded by file name; thumbnail link checked.",
      cities: ids.length,
      withPhoto: Object.keys(photos).length,
      skipped: Object.keys(skipped).length,
    },
    photos,
    skipped,
  };
  await mkdir(new URL("../src/data/photos/", import.meta.url), { recursive: true });
  await writeFile(new URL(`../src/data/${country.photoFile}`, import.meta.url), JSON.stringify(output, null, 1) + "\n");
  const bySource = Object.values(photos).reduce((acc, p) => ({ ...acc, [p.from]: (acc[p.from] || 0) + 1 }), {});
  const reasons = Object.values(skipped).map(r => r.replace(/^.*?: /, "").replace(/\(Q.*\)/, "").split(";")[0].trim());
  const tally = reasons.reduce((acc, r) => ({ ...acc, [r]: (acc[r] || 0) + 1 }), {});
  console.log(`${code}: ${output.metadata.withPhoto}/${ids.length} cities with a photo`, bySource, "skipped:", tally);
}
