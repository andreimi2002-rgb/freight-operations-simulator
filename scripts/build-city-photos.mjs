// Prepares one photo per city from Wikimedia Commons, through Wikidata:
//   GeoNames ID (P1566) -> Wikidata item -> image (P18, preferred rank first) or Wikivoyage banner (P948)
//   -> Commons file information (author, licence, size, page) -> checked thumbnail link.
// Writes src/data/photos/cities-<CC>.json (path from src/data/countries.mjs).
//   node scripts/build-city-photos.mjs            (active countries)
//   node scripts/build-city-photos.mjs AT GR      (explicit countries)
// Cities with several Wikidata items, no free photo, or a file that fails a rule are skipped (no guessing).
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

async function wikidataRows(geonamesIds) {
  const query = `SELECT ?item ?geo ?img ?rank ?banner ?links WHERE {
    VALUES ?geo { ${geonamesIds.map(id => `"${id}"`).join(" ")} }
    ?item wdt:P1566 ?geo .
    OPTIONAL { ?item wikibase:sitelinks ?links }
    OPTIONAL { ?item p:P18 ?st . ?st ps:P18 ?img ; wikibase:rank ?rank . FILTER(?rank != wikibase:DeprecatedRank) }
    OPTIONAL { ?item wdt:P948 ?banner }
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

async function linkWorks(src) {
  try {
    const response = await request(src, { method: "HEAD" });
    return response.ok && /^image\//.test(response.headers.get("content-type") || "");
  } catch { return false; }
}

const codes = process.argv.slice(2).map(c => c.toUpperCase());
for (const code of codes.length ? codes : ACTIVE_COUNTRIES) {
  const country = COUNTRIES[code];
  if (!country?.photoFile) { console.error(`${code}: no photoFile in src/data/countries.mjs`); process.exitCode = 1; continue; }
  const catalog = JSON.parse(await readFile(new URL(`../src/data/${country.cityFile}`, import.meta.url), "utf8"));
  const ids = catalog.cities.map(city => String(city.id));

  const rows = [];
  for (let i = 0; i < ids.length; i += 80) { rows.push(...await wikidataRows(ids.slice(i, i + 80))); await sleep(500); }
  const byGeo = groupByGeonames(rows);

  const matches = new Map();
  const skipped = {};
  for (const id of ids) {
    const match = matchCity(id, byGeo);
    if (match.skip) skipped[id] = match.skip;
    else if (!match.candidates.length) skipped[id] = "no image on Wikidata";
    else matches.set(id, match);
  }
  const info = await commonsInfo([...new Set([...matches.values()].flatMap(m => m.candidates.map(c => c.file)))]);

  const photos = {};
  for (const [id, match] of matches) {
    const reasons = [];
    for (const candidate of match.candidates) {
      const result = toPhoto(info.get(candidate.file), { ...candidate, verified: today });
      if (result.reject) { reasons.push(`${candidate.file}: ${result.reject}`); continue; }
      if (!(await linkWorks(result.photo.src))) { reasons.push(`${candidate.file}: link does not load`); continue; }
      photos[id] = { ...result.photo, wikidata: match.qid };
      break;
    }
    if (!photos[id]) skipped[id] = reasons.join("; ") || "no usable photo";
    await sleep(80);
  }

  const output = {
    metadata: {
      provider: "Wikimedia Commons via Wikidata",
      countryCode: code,
      builtAt: new Date().toISOString(),
      rule: "GeoNames ID (P1566) -> one Wikidata item (several: only one with >= 3x the sitelinks of the next) -> P18 (preferred first) or P948 banner; free licences only (PD, CC0, CC BY, CC BY-SA, Attribution, FAL); >= 640 px; maps, flags, coats of arms, logos and collages excluded by file name; thumbnail link checked.",
      cities: ids.length,
      withPhoto: Object.keys(photos).length,
      skipped: Object.keys(skipped).length,
    },
    photos,
    skipped,
  };
  await mkdir(new URL("../src/data/photos/", import.meta.url), { recursive: true });
  await writeFile(new URL(`../src/data/${country.photoFile}`, import.meta.url), JSON.stringify(output, null, 1) + "\n");
  const reasons = Object.values(skipped).map(r => r.replace(/^.*?: /, "").replace(/\(Q.*\)/, "").split(";")[0].trim());
  const tally = reasons.reduce((acc, r) => ({ ...acc, [r]: (acc[r] || 0) + 1 }), {});
  console.log(`${code}: ${output.metadata.withPhoto}/${ids.length} cities with a photo; skipped:`, tally);
}
