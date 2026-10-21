// Builds src/data/geo/border-crossings.json from OpenStreetMap (Overpass API):
// barrier=border_control and amenity=customs inside each active country. Elements within 500 m of
// each other (one crossing is often mapped as several nodes) are grouped into one crossing.
// Data © OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright).
//   node scripts/build-border-crossings.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { ACTIVE_COUNTRIES } from "../src/data/countries.mjs";
import { clusterCrossings } from "./lib/crossings.mjs";
import { distanceToRingsM } from "./lib/geometry.mjs";

const MAX_FROM_LAND_BORDER_M = 10000;
// Land borders = the boundaries of the NEIGHBOURING countries in borders.json (a coast is not one).
const borders = JSON.parse(await readFile(new URL("../src/data/geo/borders.json", import.meta.url), "utf8")).countries;
const nearLandBorder = c => Object.entries(borders).some(([code, country]) => code !== c.country && country.polygons.some(rings => distanceToRingsM([c.lon, c.lat], [rings[0]]) <= MAX_FROM_LAND_BORDER_M));

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function overpass(query) {
  let lastError = "";
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    for (const url of OVERPASS) {
      try {
        const response = await fetch(url, { method: "POST", headers: { "user-agent": "FOS border crossings (https://github.com/andreimi2002-rgb/freight-operations-simulator)", "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(180000) });
        if (response.ok) { const json = await response.json(); if (Array.isArray(json.elements)) return json; }
        lastError = `${url}: HTTP ${response.status}`;
      } catch (error) { lastError = `${url}: ${error.message}`; }
    }
    console.error(`  attempt ${attempt} failed (${lastError}); waiting`);
    await sleep(15000 * attempt);
  }
  throw new Error(`Overpass did not answer: ${lastError}`);
}

const crossings = [];
for (const code of ACTIVE_COUNTRIES) {
  const query = `[out:json][timeout:150];area["ISO3166-1"="${code}"][admin_level=2]->.a;(node["barrier"="border_control"](area.a);node["amenity"="customs"](area.a);way["amenity"="customs"](area.a);way["barrier"="border_control"](area.a););out tags center;`;
  const { elements } = await overpass(query);
  const points = elements.map(e => ({ id: `${e.type}/${e.id}`, lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon, tags: e.tags || {} })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  const all = clusterCrossings(points, 500).map(c => ({ ...c, country: code }));
  // customs offices inland, at airports or ports are not road crossings: keep those within 10 km of a land border
  const grouped = all.filter(nearLandBorder);
  console.log(`${code}: ${points.length} OSM elements -> ${all.length} groups -> ${grouped.length} within ${MAX_FROM_LAND_BORDER_M / 1000} km of a land border (${grouped.filter(c => c.name).length} named)`);
  crossings.push(...grouped);
  await sleep(4000);
}

const output = {
  metadata: {
    provider: "OpenStreetMap contributors via Overpass API",
    license: "ODbL 1.0",
    licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
    attribution: "© OpenStreetMap contributors",
    query: "barrier=border_control, amenity=customs (nodes and ways) inside each active country; grouped within 500 m; kept when within 10 km of a land border with another country",
    builtAt: new Date().toISOString(),
    count: crossings.length,
  },
  crossings,
};
await mkdir(new URL("../src/data/geo/", import.meta.url), { recursive: true });
await writeFile(new URL("../src/data/geo/border-crossings.json", import.meta.url), JSON.stringify(output) + "\n");
console.log(`border-crossings.json: ${crossings.length} crossings`);
