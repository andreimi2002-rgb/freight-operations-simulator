import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { CARGO, EQUIPMENT, generateMission, toSourcedPlace } from "../src/mission-engine.mjs";
import { setDictionary, t, has, formatKm, formatDuration, formatNumber, formatDate } from "../src/i18n/i18n.mjs";
import { buildLoadSheet, ROW_IDS, displayId } from "../src/view-model/load-sheet.mjs";
import { LEVELS, PHASES, UNAVAILABLE, computedFact, estimatedFact, simulatedFact, sourcedFact, unavailableFact, validateFact } from "../src/view-model/provenance.mjs";
import { cityCode, cityName, inScope, scopeCities } from "../src/data/scope.mjs";
import { NST_ESTIMATES } from "../src/data/nst-estimates.mjs";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const dictionary = JSON.parse(readFileSync(new URL("../src/i18n/ro.json", import.meta.url), "utf8"));
const catalog = JSON.parse(readFileSync(new URL("../src/data/geonames-cities.json", import.meta.url), "utf8"));
setDictionary(dictionary);

const pool = scopeCities(catalog);
const byId = id => catalog.cities.find(city => city.id === id);
const origin = toSourcedPlace(byId(683506), catalog.metadata.importedAt);
const destination = toSourcedPlace(byId(3054643), catalog.metadata.importedAt);
const route = {
  distanceMeters: 832000, durationSeconds: 40800, provider: "Test route", sourceUrl: "https://example.org/routing", retrievedAt: "2026-10-20T08:00:00.000Z",
  profile: "heavy_truck", trafficModel: "approximated",
  countries: ["RO", "HU"], namedRoads: [{ name: "A1", distanceMeters: 300000 }, { name: "A3", distanceMeters: 200000 }, { name: "DN7", distanceMeters: 100000 }, { name: "E68", distanceMeters: 1 }],
  geometry: [[[26.1, 44.4], [19.04, 47.5]]],
};
const mission = cargoId => generateMission({ world: "ETS2", origin, destination, route, cargoId, random: () => 0.3, now: new Date("2026-10-20T08:00:00.000Z") });

test("every cargo produces a complete, valid load sheet", () => {
  for (const id of Object.keys(CARGO)) {
    const sheet = buildLoadSheet(mission(id));
    assert.deepEqual(sheet.rows.map(r => r.id), ROW_IDS);
    for (const r of sheet.rows) {
      assert.deepEqual(validateFact(r.fact), [], `${id}/${r.id}`);
      assert.ok(r.valueText, `${id}/${r.id} has text`);
      assert.ok(!JSON.stringify(r).includes("⟦"), `${id}/${r.id} has no missing translation`);
    }
    assert.ok(!JSON.stringify(sheet).includes("⟦"), `${id} sheet has no missing translation`);
  }
});

test("unavailable rows never carry a value and always name their phase", () => {
  const sheet = buildLoadSheet(mission("apples"));
  const unavailable = sheet.rows.filter(r => r.level === UNAVAILABLE);
  assert.deepEqual(unavailable.map(r => r.id), ["border", "temperature", "adr", "packaging", "mass", "windows", "shipper"]);
  for (const r of unavailable) assert.match(r.valueText, /^Indisponibil încă — Etapa (1B|[2-7])$/);
  assert.equal(sheet.rows.find(r => r.id === "border").valueText, "Indisponibil încă — Etapa 2");
});

test("provenance levels follow the agreed mapping", () => {
  const level = id => buildLoadSheet(mission("apples")).rows.find(r => r.id === id).level;
  assert.equal(level("origin"), "sourced");
  assert.equal(level("destination"), "sourced");
  assert.equal(level("route"), "sourced");
  assert.equal(level("countries"), "sourced");
  assert.equal(level("cargo"), "simulated");
  assert.equal(level("family"), "estimated");
  assert.equal(level("trailer"), "computed");
});

test("hero shows route code, via roads from the routing answer, and pending chips", () => {
  const sheet = buildLoadSheet(mission("apples"));
  assert.equal(sheet.hero.originCode, "BUC");
  assert.equal(sheet.hero.destinationCode, "BUD");
  assert.equal(sheet.hero.originName, "București");
  assert.equal(sheet.hero.destinationName, "Budapesta");
  assert.equal(sheet.hero.via, "A1 · A3 · DN7");
  assert.equal(sheet.hero.destinationLine, "Budapesta, Ungaria");
  assert.deepEqual(sheet.hero.chips.filter(c => !c.available).map(c => c.valueText), ["Etapa 1B", "Etapa 3", "Etapa 3"]);
  assert.match(sheet.displayId, /^FOS-2026-/);
  assert.equal(displayId("FOS-ATS-2026-ABCDE"), "FOS-2026-ABCDE");
});

test("a missing road list or countries list is reported, not invented", () => {
  const bare = generateMission({ world: "ETS2", origin, destination, route: { ...route, namedRoads: [], countries: [] }, cargoId: "apples", random: () => 0.3, now: new Date("2026-10-20T08:00:00.000Z") });
  const sheet = buildLoadSheet(bare);
  assert.equal(sheet.hero.via, null);
  const countries = sheet.rows.find(r => r.id === "countries");
  assert.equal(countries.level, UNAVAILABLE);
  assert.deepEqual(validateFact(countries.fact), []);
});

test("provenance validator rejects incomplete facts", () => {
  assert.ok(validateFact(sourcedFact({ name: "X", url: "", retrievedAt: "2026-01-01" })).length);
  assert.ok(validateFact(sourcedFact({ name: "X", url: "https://x.org" })).length);
  assert.deepEqual(validateFact(sourcedFact({ name: "X", url: "https://x.org", retrievedAt: "2026-01-01" })), []);
  assert.ok(validateFact(computedFact({ formula: "a*b", inputs: [] })).length);
  assert.ok(validateFact(estimatedFact({ basis: "" })).length);
  assert.ok(validateFact(simulatedFact({ note: "" })).length);
  assert.ok(validateFact(unavailableFact("9", "why")).length);
  assert.ok(validateFact({ level: "invented" }).length);
  assert.deepEqual(LEVELS, ["sourced", "computed", "estimated", "simulated"]);
  assert.ok(PHASES.includes("1B"));
});

test("Romanian number, distance, duration and date formats", () => {
  assert.equal(formatKm(832), "832 km");
  assert.equal(formatNumber(21.5), "21,5");
  assert.equal(formatDuration(40800), "11 h 20 min");
  assert.equal(formatDuration(1500), "25 min");
  const date = formatDate("2026-10-21T10:00:00.000Z");
  assert.match(date, /miercuri/i);
  assert.match(date, /octombrie/);
  assert.match(date, /2026/);
});

test("the search scope is Romania, Hungary and Bulgaria without city districts", () => {
  assert.ok(pool.cities.length > 80);
  assert.ok(pool.cities.every(city => ["RO", "HU", "BG"].includes(city.countryCode)));
  assert.ok(pool.cities.every(city => !/^Sector \d|kerület$/.test(city.name)));
  assert.ok(!pool.cities.some(city => ["Pest", "Buda", "Zugló", "Újpest", "Kőbánya", "Asparuhovo"].includes(city.name)));
  assert.ok(pool.cities.some(city => city.name === "Bucharest") && pool.cities.some(city => city.name === "Budapest"));
  assert.equal(inScope({ countryCode: "US", id: 1, name: "Seattle" }), false);
  assert.equal(inScope({ countryCode: "RO", id: 11048319, name: "Sector 3" }), false);
});

test("city codes have three letters and names use comma-below diacritics", () => {
  for (const city of pool.cities) assert.match(cityCode(city), /^[A-Z]{3}$/, city.name);
  assert.equal(cityCode(byId(681290)), "CLJ");
  assert.equal(cityCode({ id: 1, name: "Ploieşti" }), "PLO");
  assert.equal(cityName({ id: 1, name: "Ploieşti" }), "Ploiești");
  assert.equal(cityName({ id: 1, name: "Constanţa" }), "Constanța");
  assert.equal(cityName(byId(683506)), "București");
});

test("the dictionary covers every cargo, trailer, family and category", () => {
  for (const c of Object.values(CARGO)) {
    assert.ok(has(`cargo.${c.id}`), `cargo.${c.id}`);
    assert.ok(has(`family.${c.family}`), `family.${c.family}`);
    assert.ok(NST_ESTIMATES[c.family], `NST estimate for ${c.family}`);
  }
  for (const e of Object.values(EQUIPMENT)) {
    assert.ok(has(`equip.${e.id}`), `equip.${e.id}`);
    assert.ok(has(`equipCat.${e.category}`), `equipCat.${e.category}`);
  }
  for (const id of ROW_IDS) assert.ok(has(`row.${id}.label`), `row.${id}.label`);
});

function sourceFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "data" ? [] : sourceFiles(path);
    return /\.(mjs|js)$/.test(name) ? [path] : [];
  });
}
test("every translation key used in the code exists in ro.json", () => {
  const files = [...sourceFiles(join(root, "src")), join(root, "index.html")];
  const used = new Set();
  for (const file of files) {
    let source;
    try { source = readFileSync(file, "utf8"); } catch { continue; }
    for (const m of source.matchAll(/\bt(?:Or)?\(\s*["']([a-zA-Z][\w.]*)["']/g)) used.add(m[1]);
    for (const m of source.matchAll(/data-i18n(?:-[a-z]+)?="([^"]+)"/g)) used.add(m[1]);
  }
  assert.ok(used.size > 20, "the scan found the keys");
  for (const key of used) assert.ok(has(key), `missing translation key: ${key}`);
});

test("ro.json declares its locale and has no empty strings", () => {
  assert.equal(dictionary._locale, "ro-RO");
  for (const [key, value] of Object.entries(dictionary)) assert.ok(String(value).length > 0, key);
  assert.equal(t("unavailable.phase", { phase: "1B" }), "Indisponibil încă — Etapa 1B");
});
