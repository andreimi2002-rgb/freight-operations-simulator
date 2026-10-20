// Builds src/data/places/locations-<CC>.json: loading/unloading places from OpenStreetMap (Overpass),
// tied to the catalog cities. Names are kept only when they are public place names (scripts/lib/site-names.mjs).
// Data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).
//   node scripts/build-locations.mjs RO HU BG
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { COUNTRIES, ACTIVE_COUNTRIES } from "../src/data/countries.mjs";
import { overpass, sleep } from "./lib/overpass.mjs";
import { buildSites } from "./lib/sites.mjs";

const UA = "FOS locations (https://github.com/andreimi2002-rgb/freight-operations-simulator)";
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const terms = await read("../src/data/places/public-name-terms.json");
// FOS_OVERPASS_CACHE=<dir> keeps the raw Overpass answers there, so a rerun after a filter change does not query again
const cacheDir = process.env.FOS_OVERPASS_CACHE || null;
if (cacheDir) await mkdir(cacheDir, { recursive: true });
const codes = process.argv.slice(2).length ? process.argv.slice(2) : ACTIVE_COUNTRIES;

for (const code of codes) {
  if (!COUNTRIES[code] || !terms[code]) throw new Error(`no country entry or public-name terms for ${code}`);
  const catalog = await read(`../src/data/${COUNTRIES[code].cityFile}`);
  const area = `area["ISO3166-1"="${code}"][admin_level=2]->.a;`;
  const parts = [
    `way["landuse"="industrial"](area.a);relation["landuse"="industrial"](area.a);`,
    `way["landuse"="port"](area.a);way["harbour"="yes"](area.a);way["industrial"~"^(port|intermodal|logistics|warehouse|distribution)$"](area.a);`,
    `way["landuse"="railway"]["name"](area.a);`,
    `node["man_made"="silo"](area.a);way["man_made"="silo"](area.a);way["building"="silo"](area.a);`,
  ];
  const elements = [];
  for (const [index, part] of parts.entries()) {
    const cacheFile = cacheDir ? `${cacheDir}/${code}-${index}.json` : null;
    let chunk = null;
    if (cacheFile) { try { chunk = JSON.parse(await readFile(cacheFile, "utf8")); } catch { /* not cached yet */ } }
    if (!chunk) {
      chunk = (await overpass(`[out:json][timeout:200];${area}(${part});out tags center bb;`, UA)).elements;
      if (cacheFile) await writeFile(cacheFile, JSON.stringify(chunk));
      await sleep(4000);
    }
    console.log(`  ${code} part ${index}: ${chunk.length} elements`);
    elements.push(...chunk);
  }
  const { sites, report } = buildSites(elements, catalog.cities, terms[code]);
  console.log(code, JSON.stringify(report));
  const output = {
    metadata: {
      provider: "OpenStreetMap contributors via Overpass API",
      license: "ODbL 1.0",
      licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
      attribution: "© OpenStreetMap contributors",
      countryCode: code,
      selection: "landuse=industrial, landuse=port, harbour=yes, industrial=port|intermodal|logistics|warehouse|distribution, named landuse=railway, man_made=silo; within 15 km of a catalog city; max 6 per city and kind; names kept only when public (no company names, see scripts/lib/site-names.mjs)",
      builtAt: new Date().toISOString(),
      report,
      count: sites.length,
    },
    sites,
  };
  await writeFile(new URL(`../src/data/places/locations-${code}.json`, import.meta.url), JSON.stringify(output) + "\n");
  console.log(`locations-${code}.json: ${sites.length} sites`);
}
