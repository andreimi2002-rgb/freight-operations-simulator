// Builds src/data/geo/borders.json: country polygons for the active countries and their neighbours,
// from Natural Earth 1:10m "Admin 0 - Countries" (public domain, https://www.naturalearthdata.com/about/terms-of-use/).
// Used to split a route's distance by country. Simplified to ~200 m, coordinates rounded to 3 decimals.
//   node scripts/build-borders.mjs
import { writeFile, mkdir } from "node:fs/promises";
import { ACTIVE_COUNTRIES } from "../src/data/countries.mjs";
import { boxesTouch, expandBox, ringBox, round, simplify } from "./lib/geometry.mjs";

const SOURCE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson";
const TOLERANCE = 0.002;   // degrees (~200 m)
const NEIGHBOURS_WITHIN = 1.5; // degrees around the active countries
const MIN_RING_AREA = 0.0005; // drop tiny islands (square degrees)

const response = await fetch(SOURCE, { headers: { "user-agent": "FOS border builder (https://github.com/andreimi2002-rgb/freight-operations-simulator)" } });
if (!response.ok) throw new Error(`Natural Earth download failed: HTTP ${response.status}`);
const world = await response.json();

const code = props => {
  const iso = props.ISO_A2_EH && props.ISO_A2_EH !== "-99" ? props.ISO_A2_EH : props.ISO_A2;
  return iso && iso !== "-99" ? iso : null;
};
const polygonsOf = geometry => (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates);
const ringArea = ring => Math.abs(ring.reduce((sum, [x, y], i) => { const [x2, y2] = ring[(i + 1) % ring.length]; return sum + (x * y2 - x2 * y); }, 0) / 2);

const features = world.features.map(f => ({ code: code(f.properties), name: f.properties.NAME_EN || f.properties.NAME, polygons: polygonsOf(f.geometry) })).filter(f => f.code);
const active = features.filter(f => ACTIVE_COUNTRIES.includes(f.code));
if (active.length !== ACTIVE_COUNTRIES.length) throw new Error("an active country is missing in Natural Earth");
const activeBox = expandBox(active.flatMap(f => f.polygons.map(p => ringBox(p[0]))).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]), NEIGHBOURS_WITHIN);

const countries = {};
for (const feature of features) {
  const polygons = feature.polygons
    .map(poly => poly.map(ring => simplify(ring, TOLERANCE).map(([x, y]) => [round(x, 3), round(y, 3)])))
    .filter(poly => ringArea(poly[0]) >= MIN_RING_AREA && poly[0].length >= 4);
  if (!polygons.length) continue;
  // keep a country when any of its polygons touches the area around the active countries
  if (!polygons.some(poly => boxesTouch(ringBox(poly[0]), activeBox))) continue;
  countries[feature.code] = { name: feature.name, polygons };
}
for (const c of ACTIVE_COUNTRIES) if (!countries[c]) throw new Error(`${c} has no polygons after simplification`);

const output = {
  metadata: {
    provider: "Natural Earth",
    source: SOURCE,
    dataset: "ne_10m_admin_0_countries",
    license: "Public domain",
    note: "1:10m country boundaries, simplified to about 200 m; accurate to a few kilometres, not survey-grade.",
    builtAt: new Date().toISOString(),
    countries: Object.keys(countries),
  },
  countries,
};
await mkdir(new URL("../src/data/geo/", import.meta.url), { recursive: true });
const text = JSON.stringify(output);
await writeFile(new URL("../src/data/geo/borders.json", import.meta.url), text + "\n");
console.log(`borders.json: ${Object.keys(countries).length} countries (${Object.keys(countries).join(", ")}), ${(text.length / 1024).toFixed(0)} KB`);
