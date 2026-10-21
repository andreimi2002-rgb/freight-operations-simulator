// Turns OSM elements into loading/unloading sites tied to catalog cities (pure; tested).
import { haversineM } from "../../src/engine/border-split.mjs";
import { createNameFilter } from "./site-names.mjs";

export const KINDS = ["industrialZone", "port", "railTerminal", "logisticsPark", "silo"];
export const MAX_CITY_KM = 15;
export const MAX_PER_CITY_KIND = 6;
const MERGE_M = 300;
// smallest area (km²) for a place, by kind and by whether its name is public (named) or not
const MIN_AREA = { industrialZone: [0.25, 0.03], port: [0.05, 0.02], railTerminal: [0.02, 0.02], logisticsPark: [0.02, 0.02], silo: [0, 0] };

// "out center bb" may give only the bounding box for a way: its middle is then the position
const centerOf = e => ({
  lat: e.lat ?? e.center?.lat ?? (e.bounds ? (e.bounds.minlat + e.bounds.maxlat) / 2 : undefined),
  lon: e.lon ?? e.center?.lon ?? (e.bounds ? (e.bounds.minlon + e.bounds.maxlon) / 2 : undefined),
});
export function areaKm2(bounds) {
  if (!bounds) return 0;
  const lat = (bounds.minlat + bounds.maxlat) / 2;
  return Math.abs(bounds.maxlat - bounds.minlat) * 110.54 * Math.abs(bounds.maxlon - bounds.minlon) * 111.32 * Math.cos(lat * Math.PI / 180);
}

// elements: Overpass elements ({ type, id, tags, lat/lon or center, bounds }); cities: [{ id, name, latitude, longitude }]
// termsForCountry: one country's entry of public-name-terms.json
// -> { sites, report }
export function buildSites(elements, cities, termsForCountry) {
  const cityNames = cities.map(c => c.name);
  const filters = Object.fromEntries(Object.entries(termsForCountry.terms).map(([kind, terms]) => [kind, createNameFilter({ terms, fillers: termsForCountry.fillers, directions: termsForCountry.directions, cityNames })]));
  const report = { elements: elements.length, named: 0, generic: 0, nameRemoved: 0, noCity: 0, tooSmall: 0, unclassified: 0 };
  const found = [];
  for (const e of elements) {
    const tags = e.tags || {};
    const { lat, lon } = centerOf(e);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const area = areaKm2(e.bounds);
    const raw = tags.name || tags["name:ro"] || tags["name:hu"] || tags["name:bg"] || tags["name:en"] || "";
    const publicAs = kind => filters[kind]?.(raw, tags) ?? null;
    let kind = null, name = null;
    if (tags.man_made === "silo" || tags.building === "silo") kind = "silo";
    else if (tags.landuse === "port" || tags.harbour === "yes" || tags.industrial === "port") { kind = "port"; name = publicAs("port"); }
    else if (tags.industrial === "intermodal") { kind = "railTerminal"; name = publicAs("railTerminal"); }
    else if (tags.landuse === "railway" && (name = publicAs("railTerminal"))) kind = "railTerminal";
    else if (["logistics", "warehouse", "distribution"].includes(tags.industrial) || tags.landuse === "industrial") {
      if ((name = publicAs("logisticsPark"))) kind = "logisticsPark";
      else if ((name = publicAs("industrialZone"))) kind = "industrialZone";
      else if (tags.landuse === "industrial" && (!tags.industrial || tags.industrial === "yes")) kind = "industrialZone"; // unnamed zone: generic
    }
    if (!kind) { report.unclassified += 1; continue; }
    if (raw && !name && kind !== "silo") report.nameRemoved += 1;
    if (kind === "silo") name = null;
    const named = Boolean(name);
    if (area < MIN_AREA[kind][named ? 1 : 0]) { report.tooSmall += 1; continue; }
    let best = null;
    for (const c of cities) {
      const d = haversineM([lon, lat], [c.longitude, c.latitude]);
      if (d <= MAX_CITY_KM * 1000 && (!best || d < best.d)) best = { c, d };
    }
    if (!best) { report.noCity += 1; continue; }
    found.push({ id: `${e.type}/${e.id}`, kind, name, lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5, cityId: best.c.id, areaKm2: Math.round(area * 100) / 100 });
  }
  // largest first (named before unnamed); drop near-duplicates of the same kind in one city; cap per city and kind
  found.sort((a, b) => Number(Boolean(b.name)) - Number(Boolean(a.name)) || b.areaKm2 - a.areaKm2 || a.id.localeCompare(b.id));
  const kept = [];
  for (const s of found) {
    const mine = kept.filter(k => k.cityId === s.cityId && k.kind === s.kind);
    if (mine.length >= MAX_PER_CITY_KIND) continue;
    if (mine.some(k => haversineM([k.lon, k.lat], [s.lon, s.lat]) < MERGE_M)) continue;
    kept.push(s);
  }
  for (const s of kept) report[s.name ? "named" : "generic"] += 1;
  kept.sort((a, b) => a.cityId - b.cityId || KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || a.id.localeCompare(b.id));
  return { sites: kept, report };
}
