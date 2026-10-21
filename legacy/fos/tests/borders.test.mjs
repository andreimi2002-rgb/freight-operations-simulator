import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { borderRegime, countryAt, distancesByCountry, findCrossing, haversineM, prepareBorders, splitRoute } from "../src/engine/border-split.mjs";
import { routeGeoFacts } from "../src/engine/geo-facts.mjs";
import { validateFact } from "../src/engine/provenance.mjs";
import { clusterCrossings } from "../scripts/lib/crossings.mjs";
import { distanceToRingsM, simplify } from "../scripts/lib/geometry.mjs";
import { generateLoad } from "../src/engine/generator.mjs";
import { validateLoad } from "../src/engine/load-model.mjs";
import { loadCities } from "./helpers/cities.mjs";

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const realBorders = prepareBorders(json("../src/data/geo/borders.json"));
const crossingsFile = json("../src/data/geo/border-crossings.json");
const schengen = json("../src/data/geo/schengen.json");
const square = (x0, y0, x1, y1) => [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]];
// Three adjacent 1x1 degree "countries" on the equator: A [0,1], B [1,2], C [2,3] (longitude), latitude [0,1].
const synthetic = prepareBorders({ countries: { AA: { polygons: [square(0, 0, 1, 1)] }, BB: { polygons: [square(1, 0, 2, 1)] }, CC: { polygons: [square(2, 0, 3, 1)] } } });
const km = m => m / 1000;

test("point in country: synthetic squares, holes and the real borders", () => {
  assert.equal(countryAt([0.5, 0.5], synthetic), "AA");
  assert.equal(countryAt([1.5, 0.5], synthetic), "BB");
  assert.equal(countryAt([5, 5], synthetic), null);
  const withHole = prepareBorders({ countries: { XX: { polygons: [[...square(0, 0, 4, 4), ...[[[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]]]]] } } });
  assert.equal(countryAt([0.5, 0.5], withHole), "XX");
  assert.equal(countryAt([2, 2], withHole), null, "inside the hole");
  const real = { Bucharest: [26.1, 44.43], Budapest: [19.04, 47.5], Sofia: [23.32, 42.7], Vienna: [16.37, 48.21], Athens: [23.73, 37.98], Belgrade: [20.46, 44.82] };
  assert.deepEqual(Object.fromEntries(Object.entries(real).map(([n, p]) => [n, countryAt(p, realBorders)])), { Bucharest: "RO", Budapest: "HU", Sofia: "BG", Vienna: "AT", Athens: "GR", Belgrade: "RS" });
});

test("a route crossing one border is split where the border is", () => {
  // 0.5,0.5 -> 1.5,0.5 along the equator-parallel: half in AA, half in BB
  const split = splitRoute([[[0.5, 0.5], [1.5, 0.5]]], synthetic);
  assert.deepEqual(split.byCountry.map(c => c.country), ["AA", "BB"]);
  assert.equal(split.crossings.length, 1);
  assert.ok(Math.abs(split.crossings[0].lon - 1) < 1e-4 && Math.abs(split.crossings[0].lat - 0.5) < 1e-4);
  const expectedHalf = haversineM([0.5, 0.5], [1, 0.5]);
  assert.ok(Math.abs(split.byCountry[0].lengthM - expectedHalf) < 5, "AA part");
  assert.ok(Math.abs(split.byCountry[1].lengthM - expectedHalf) < 5, "BB part");
  assert.ok(Math.abs(split.lengthM - haversineM([0.5, 0.5], [1.5, 0.5])) < 5);
});

test("through a third country, with several lines, and back and forth", () => {
  const through = splitRoute([[[0.2, 0.5], [1.5, 0.5]], [[1.5, 0.5], [2.8, 0.5]]], synthetic);
  assert.deepEqual(through.byCountry.map(c => c.country), ["AA", "BB", "CC"]);
  assert.deepEqual(through.crossings.map(c => `${c.from}>${c.to}`), ["AA>BB", "BB>CC"]);
  const bb = through.byCountry[1].lengthM;
  assert.ok(Math.abs(bb - haversineM([1, 0.5], [2, 0.5])) < 10, "BB is crossed completely");
  const there = splitRoute([[[0.5, 0.5], [1.5, 0.5], [0.5, 0.6]]], synthetic);
  assert.deepEqual(there.crossings.map(c => `${c.from}>${c.to}`), ["AA>BB", "BB>AA"]);
  assert.equal(there.byCountry.length, 2, "a country that is re-entered is listed once");
});

test("a route inside one country has no crossing; gaps do not invent one", () => {
  const inside = splitRoute([[[0.1, 0.1], [0.9, 0.9]]], synthetic);
  assert.deepEqual(inside.byCountry.map(c => c.country), ["AA"]);
  assert.equal(inside.crossings.length, 0);
  // the route leaves AA into the sea (no polygon) and comes back: still AA, no crossing
  const gap = splitRoute([[[0.5, 0.5], [0.5, -0.5], [0.6, 0.5]]], synthetic);
  assert.equal(gap.crossings.length, 0);
  assert.ok(gap.unassignedM > 0);
  assert.equal(splitRoute([[[10, 10], [11, 11]]], synthetic), null, "entirely outside");
  assert.equal(splitRoute([[[0.5, 0.5]]], synthetic), null, "a single point");
  assert.equal(splitRoute([], synthetic), null);
});

test("distances add up to the route distance", () => {
  const split = splitRoute([[[0.5, 0.5], [2.5, 0.5]]], synthetic);
  const rows = distancesByCountry(split, 333.3);
  assert.deepEqual(rows.map(r => r.code), ["AA", "BB", "CC"]);
  assert.equal(Math.round(rows.reduce((s, r) => s + r.km, 0) * 10) / 10, 333.3);
  assert.ok(Math.abs(rows[1].share - 0.5) < 0.01);
  assert.equal(distancesByCountry({ byCountry: [] }, 100), null);
});

test("real borders: Bucharest to Budapest crosses once, near the real border, and the shares make sense", () => {
  const line = [[26.1, 44.43], [24, 45.2], [22, 46], [21.2, 46.2], [19.04, 47.5]];
  const split = splitRoute([line], realBorders);
  assert.deepEqual(split.byCountry.map(c => c.country), ["RO", "HU"]);
  assert.equal(split.crossings.length, 1);
  const c = split.crossings[0];
  assert.ok(c.lon > 20.5 && c.lon < 21.8 && c.lat > 45.9 && c.lat < 46.6, `crossing at ${c.lon},${c.lat}`);
  const ro = split.byCountry[0].lengthM / split.lengthM;
  assert.ok(ro > 0.6 && ro < 0.85, `Romanian share ${ro}`);
});

test("real borders: Sofia to Athens passes only Bulgaria and Greece; Bucharest to Sofia crosses the Danube border", () => {
  const sofiaAthens = splitRoute([[[23.32, 42.7], [23.1, 41.5], [23.4, 40.2], [23.73, 37.98]]], realBorders);
  assert.deepEqual(sofiaAthens.byCountry.map(c => c.country), ["BG", "GR"]);
  assert.ok(sofiaAthens.crossings[0].lat > 40.8 && sofiaAthens.crossings[0].lat < 41.7, `crossing at ${sofiaAthens.crossings[0].lat}`);
  const bucSofia = splitRoute([[[26.1, 44.43], [25.9, 43.9], [25, 43.2], [23.32, 42.7]]], realBorders);
  assert.deepEqual(bucSofia.byCountry.map(c => c.country), ["RO", "BG"]);
});

test("the crossing data: grouping within 500 m, public names only, positions near the borders", () => {
  const points = [
    { id: "node/1", lat: 46, lon: 21, tags: { name: "Nădlac II", barrier: "border_control" } },
    { id: "node/2", lat: 46.001, lon: 21.001, tags: { barrier: "border_control" } },
    { id: "node/3", lat: 47, lon: 22, tags: { amenity: "customs", "name:en": "Test crossing" } },
    { id: "node/4", lat: 47.0001, lon: 22.0001, tags: { name: "Test crossing", operator: "Some Company SRL" } },
  ];
  const grouped = clusterCrossings(points, 500);
  assert.equal(grouped.length, 2);
  assert.deepEqual(grouped.map(g => g.name), ["Nădlac II", "Test crossing"]);
  assert.deepEqual(grouped[0].osm, ["node/1", "node/2"]);
  assert.ok(!JSON.stringify(grouped).includes("Some Company"), "operator names are never kept");
  assert.ok(crossingsFile.crossings.length > 50);
  for (const c of crossingsFile.crossings) {
    assert.ok(Number.isFinite(c.lat) && Number.isFinite(c.lon) && c.osm.length >= 1 && ["RO", "HU", "BG"].includes(c.country), JSON.stringify(c));
    assert.ok(!("operator" in c) && !("tags" in c));
  }
  // every crossing lies within 10 km of the land border of its country with a neighbour (not on a coast, not inland)
  const near = c => realBorders.countries.filter(x => x.code !== c.country).some(x => x.polygons.some(({ rings }) => distanceToRingsM([c.lon, c.lat], [rings[0]]) <= 10000));
  const far = crossingsFile.crossings.filter(c => !near(c));
  assert.equal(far.length, 0, `crossings far from any land border: ${far.map(c => c.name || c.osm[0]).join(", ")}`);
  assert.ok(Math.abs(distanceToRingsM([0.5, 0.5], square(0, 0, 1, 1)) - 55660) < 700, "distance helper: 0.5 degree from the nearest edge");
});

test("the nearest crossing within 5 km is used; the regime follows Schengen membership", () => {
  const list = [{ country: "RO", lat: 46.17, lon: 20.74, name: "Nădlac II", osm: ["node/9"] }, { country: "HU", lat: 46.18, lon: 20.75, name: "Csanádpalota", osm: ["node/8"] }, { country: "BG", lat: 43, lon: 25, name: "Far", osm: ["node/7"] }];
  const found = findCrossing({ lat: 46.172, lon: 20.742 }, "RO", "HU", list, 5);
  assert.equal(found.name, "Nădlac II");
  assert.ok(found.distanceM < 1000);
  assert.equal(findCrossing({ lat: 46.172, lon: 20.742 }, "RO", "RS", list, 0.1), null, "nothing within the limit");
  assert.equal(findCrossing({ lat: 43, lon: 25 }, "RO", "HU", list, 5), null, "a crossing of other countries is not used");
  assert.equal(schengen.members.length, 29);
  assert.equal(borderRegime("RO", "HU", schengen.members), "internal");
  assert.equal(borderRegime("RO", "BG", schengen.members), "internal");
  assert.equal(borderRegime("BG", "GR", schengen.members), "internal");
  assert.equal(borderRegime("RO", "RS", schengen.members), "external");
  assert.equal(borderRegime("BG", "TR", schengen.members), "external");
  assert.equal(borderRegime("RO", "MD", schengen.members), "external");
  assert.ok(!schengen.members.includes("CY") && !schengen.members.includes("IE") && !schengen.members.includes("RS"));
});

test("geo facts are valid, name their data sets, and are unavailable without data", () => {
  const summary = { distanceKm: 800, geometry: [[[26.1, 44.43], [24, 45.2], [22, 46], [19.04, 47.5]]] };
  const geo = { borders: realBorders, crossings: crossingsFile.crossings, schengen: schengen.members };
  const facts = routeGeoFacts(summary, geo);
  for (const fact of Object.values(facts)) assert.deepEqual(validateFact(fact), []);
  assert.deepEqual(facts.countryDistances.datasets, ["naturalEarth"]);
  assert.deepEqual(facts.borderCrossings.datasets, ["naturalEarth", "osm", "schengen"]);
  assert.equal(facts.borderCrossings.value.crossings.length, 1);
  assert.equal(facts.borderCrossings.value.crossings[0].regime, "internal");
  assert.equal(Math.round(facts.countryDistances.value.countries.reduce((s, c) => s + c.km, 0)), 800);
  const none = routeGeoFacts(summary, null);
  assert.equal(none.countryDistances.level, "unavailable");
  assert.equal(none.borderCrossings.reason, "borderDataMissing");
  const noGeometry = routeGeoFacts({ distanceKm: 10, geometry: [] }, geo);
  assert.equal(noGeometry.borderCrossings.reason, "noGeometry");
  const domestic = routeGeoFacts({ distanceKm: 50, geometry: [[[26.1, 44.43], [26.2, 44.9]]] }, geo);
  assert.equal(domestic.borderCrossings.formula, "noBorderCrossed");
  assert.deepEqual(domestic.borderCrossings.value.crossings, []);
});

test("a generated load carries the new facts and stays valid", async () => {
  const catalog = loadCities();
  const city = name => catalog.cities.find(c => c.name === name);
  const router = { async route({ origin, destination }) { return { distanceM: 650000, durationS: 28000, geometry: [[[origin.lon, origin.lat], [destination.lon, destination.lat]]], countries: ["RO", "HU"], viaNames: [], provider: "Test router", sourceUrl: "https://example.org/r", retrievedAt: "2026-10-20T08:00:00.000Z" }; } };
  const geo = { borders: realBorders, crossings: crossingsFile.crossings, schengen: schengen.members };
  const load = await generateLoad({ cities: catalog.cities, importedAt: "2026-10-20", router, originCity: city("Bucharest"), destinationCity: city("Budapest"), geo, now: new Date("2026-10-20T08:00:00Z"), random: () => 0.5 });
  assert.deepEqual(validateLoad(load), []);
  assert.deepEqual(load.route.countryDistances.value.countries.map(c => c.code), ["RO", "HU"]);
  assert.equal(load.route.borderCrossings.value.crossings.length, 1);
  const withoutGeo = await generateLoad({ cities: catalog.cities, importedAt: "2026-10-20", router, originCity: city("Bucharest"), destinationCity: city("Budapest"), now: new Date("2026-10-20T08:00:00Z"), random: () => 0.5 });
  assert.deepEqual(validateLoad(withoutGeo), []);
  assert.equal(withoutGeo.route.borderCrossings.level, "unavailable");
});

test("simplification keeps the shape within the tolerance", () => {
  const line = Array.from({ length: 200 }, (_, i) => [i / 100, Math.sin(i / 20) * 0.01]);
  const simple = simplify(line, 0.002);
  assert.ok(simple.length < line.length / 3 && simple.length >= 3);
  assert.deepEqual(simple[0], line[0]);
  assert.deepEqual(simple.at(-1), line.at(-1));
});
