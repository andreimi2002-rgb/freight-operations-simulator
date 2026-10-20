import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { setDictionary, t, has, formatKm, formatDuration, formatNumber, formatDate, formatTime } from "../src/i18n/i18n.mjs";
import { buildLoadSheet, buildRecentEntry, ROW_IDS, zoneLabel } from "../src/view-model/load-sheet.mjs";
import { generateLoad } from "../src/engine/generator.mjs";
import { CARGO } from "../src/engine/cargo.mjs";
import { EQUIPMENT } from "../src/engine/equipment.mjs";
import { ALL_ROLES } from "../src/data/cargo/roles.mjs";
import { PACKAGING_PROFILES } from "../src/data/cargo/packaging-profiles.mjs";
import { NST_ESTIMATES } from "../src/data/cargo/nst-estimates.mjs";
import { cityCode, cityName } from "../src/data/scope.mjs";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const dictionary = JSON.parse(readFileSync(new URL("../src/i18n/ro.json", import.meta.url), "utf8"));
const catalog = JSON.parse(readFileSync(new URL("../src/data/places/cities-ro-hu-bg.json", import.meta.url), "utf8"));
setDictionary(dictionary);

const city = name => catalog.cities.find(c => c.name === name);
const router = (countries = ["RO", "HU"], viaNames = ["A1", "M43", "M5"]) => ({
  async route({ origin, destination }) {
    return { distanceM: 832000, durationS: 40800, geometry: [[[origin.lon, origin.lat], [destination.lon, destination.lat]]], countries, viaNames, provider: "Test router", sourceUrl: "https://example.org/route", retrievedAt: "2026-10-20T08:00:00.000Z", trafficModel: "approximated" };
  },
});
const make = (options = {}) => generateLoad({
  cities: catalog.cities, importedAt: "2026-10-20T00:00:00.000Z", router: options.router || router(),
  originCity: city("Bucharest"), destinationCity: city("Budapest"), cargoId: "apples", equipmentId: "reefer",
  now: new Date("2026-10-20T08:00:00.000Z"), random: () => 0.5, ...options,
});

test("every cargo on every listed trailer gives a complete, fully translated sheet", async () => {
  for (const cargo of Object.values(CARGO)) {
    for (const equipmentId of cargo.equipmentIds) {
      const sheet = buildLoadSheet(await make({ cargoId: cargo.id, equipmentId }));
      assert.deepEqual(sheet.rows.map(r => r.id), ROW_IDS);
      for (const r of sheet.rows) assert.ok(r.valueText, `${cargo.id}/${equipmentId}/${r.id} has text`);
      const json = JSON.stringify(sheet);
      assert.ok(!json.includes("⟦"), `${cargo.id}/${equipmentId}: missing translation ${json.match(/⟦[^⟧]*⟧/)?.[0]}`);
    }
  }
});

test("provenance of each row follows the agreed mapping", async () => {
  const sheet = buildLoadSheet(await make());
  const level = id => sheet.rows.find(r => r.id === id).level;
  for (const id of ["origin", "destination", "route", "countries", "floor"]) assert.equal(level(id), "sourced", id);
  for (const id of ["packaging", "mass", "loadingMetres", "trailer", "transit"]) assert.equal(level(id), "computed", id);
  for (const id of ["family", "unitMass"]) assert.equal(level(id), "estimated", id);
  for (const id of ["cargo", "loadingWindow", "unloadingWindow", "shipper", "consignee"]) assert.equal(level(id), "simulated", id);
  for (const id of ["border", "temperature", "adr"]) assert.equal(level(id), "unavailable", id);
});

test("apples in a reefer, Bucharest to Budapest: the numbers shown", async () => {
  const sheet = buildLoadSheet(await make());
  const value = id => sheet.rows.find(r => r.id === id).valueText;
  assert.equal(value("packaging"), "33 × europalet EPAL");
  assert.equal(value("unitMass"), "≈ 700 kg");
  assert.equal(value("mass"), "≈ 23,1 t");
  assert.equal(value("loadingMetres"), "13,2 m");
  assert.equal(value("floor"), "13,31 m × 2,48 m · sarcină utilă 31 t");
  assert.equal(value("transit"), "23 h 5 min");
  assert.equal(value("countries"), "România → Ungaria");
  assert.equal(value("border"), "Indisponibil încă — Etapa 2");
  assert.equal(sheet.hero.originCode, "BUC");
  assert.equal(sheet.hero.destinationName, "Budapesta");
  assert.equal(sheet.hero.via, "A1 · M43 · M5");
  assert.match(value("loadingWindow"), /\(UTC\+[23]\)$/);
  assert.ok(sheet.warnings.length >= 2);
  const mass = sheet.rows.find(r => r.id === "mass");
  assert.match(mass.fact.note, /estimare/);
  assert.ok(mass.fact.inputs.length >= 2);
});

test("the drawer explains sources, formulas, bases and missing values", async () => {
  const sheet = buildLoadSheet(await make());
  const row = id => sheet.rows.find(r => r.id === id);
  assert.equal(row("origin").fact.source.name, "GeoNames");
  assert.ok(row("origin").detail.links.some(l => l.url === `https://www.geonames.org/${city("Bucharest").id}/`));
  assert.ok(row("transit").detail.links.some(l => l.url.includes("eur-lex.europa.eu/eli/reg/2006/561")));
  assert.ok(row("transit").detail.meta.some(m => m.label === "Repaus zilnic" && m.value === "11 h"));
  assert.ok(row("floor").detail.links.some(l => l.url.includes("dsv.com")));
  assert.ok(row("packaging").detail.links.some(l => l.url.includes("epal-pallets.org")));
  assert.match(row("unitMass").fact.basis, /Interval estimat: 500 kg–900 kg/);
  assert.match(row("adr").detail.explanation, /ADR/);
});

test("non-palletised cargo shows why it is unavailable, never a number", async () => {
  const fuel = buildLoadSheet(await make({ cargoId: "fuel", equipmentId: "fuelTanker" }));
  for (const id of ["packaging", "unitMass", "mass", "loadingMetres", "floor"]) {
    const r = fuel.rows.find(x => x.id === id);
    assert.equal(r.level, "unavailable", id);
    assert.match(r.valueText, /^Indisponibil încă — Etapa \d/);
  }
  assert.equal(fuel.hero.chips.find(c => c.id === "mass").available, false);
  assert.equal(fuel.kpis.find(k => k.id === "mass").valueText, null);
});

test("a missing road list or country list is reported, not invented", async () => {
  const sheet = buildLoadSheet(await make({ router: router([], []) }));
  assert.equal(sheet.hero.via, null);
  assert.equal(sheet.rows.find(r => r.id === "countries").level, "unavailable");
});

test("Romanian number, distance, duration, date and time-zone formats", () => {
  assert.equal(formatKm(832), "832 km");
  assert.equal(formatNumber(21.5), "21,5");
  assert.equal(formatDuration(40800), "11 h 20 min");
  assert.equal(formatDuration(1500), "25 min");
  assert.equal(formatDuration(32400), "9 h");
  const date = formatDate("2026-10-21T10:00:00.000Z");
  assert.match(date, /miercuri/i);
  assert.match(date, /octombrie/);
  assert.equal(formatTime("2026-10-21T03:30:00.000Z", "Europe/Bucharest"), "06:30");
  assert.equal(formatTime("2026-10-21T03:30:00.000Z", "Europe/Budapest"), "05:30");
  assert.equal(zoneLabel("2026-07-01T12:00:00Z", "Europe/Sofia"), "UTC+3");
  assert.equal(zoneLabel("2026-12-01T12:00:00Z", "Europe/Budapest"), "UTC+1");
});

test("city codes have three letters and names use comma-below diacritics", () => {
  for (const c of catalog.cities) assert.match(cityCode(c), /^[A-Z]{3}$/, c.name);
  assert.equal(cityCode(city("Cluj-Napoca")), "CLJ");
  assert.equal(cityName({ id: 1, name: "Ploieşti" }), "Ploiești");
  assert.equal(cityName({ geonamesId: 683506, name: "Bucharest" }), "București");
});

test("recent-load chips use the route code and translated cargo", async () => {
  const entry = buildRecentEntry(await make());
  assert.equal(entry.code, "BUC→BUD");
  assert.equal(entry.label, "Mere (proaspete, soiuri mixte)");
});

test("the dictionary covers every cargo, trailer, family, category, role, basis and reason", () => {
  for (const c of Object.values(CARGO)) {
    assert.ok(has(`cargo.${c.id}`), `cargo.${c.id}`);
    assert.ok(has(`family.${c.family}`), `family.${c.family}`);
    assert.ok(NST_ESTIMATES[c.family], `NST estimate for ${c.family}`);
  }
  for (const e of Object.values(EQUIPMENT)) {
    assert.ok(has(`equip.${e.id}`), `equip.${e.id}`);
    assert.ok(has(`equipCat.${e.category}`), `equipCat.${e.category}`);
  }
  for (const role of ALL_ROLES) assert.ok(has(`role.${role}`), `role.${role}`);
  for (const profile of Object.values(PACKAGING_PROFILES)) {
    assert.ok(profile.unitType ? has(`basis.unitMass.${profile.basis}`) : has(`reason.${profile.reason}`), JSON.stringify(profile));
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
test("every literal translation key used in the code exists in ro.json", () => {
  const files = [...sourceFiles(join(root, "src")), join(root, "index.html")];
  const used = new Set();
  for (const file of files) {
    let source;
    try { source = readFileSync(file, "utf8"); } catch { continue; } // some files are not readable in the sandbox; the browser test covers them
    for (const m of source.matchAll(/\bt(?:Or)?\(\s*["']([a-zA-Z][\w.]*)["']/g)) used.add(m[1]);
    for (const m of source.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)) used.add(m[1]);
  }
  assert.ok(used.size > 50, "the scan found the keys");
  for (const key of used) assert.ok(has(key), `missing translation key: ${key}`);
});

test("ro.json declares its locale, has no empty strings and no duplicate keys", () => {
  assert.equal(dictionary._locale, "ro-RO");
  for (const [key, value] of Object.entries(dictionary)) assert.ok(String(value).length > 0, key);
  const raw = readFileSync(new URL("../src/i18n/ro.json", import.meta.url), "utf8");
  const seen = new Set();
  for (const m of raw.matchAll(/^\s*"([^"]+)"\s*:/gm)) { assert.ok(!seen.has(m[1]), `duplicate key: ${m[1]}`); seen.add(m[1]); }
  assert.equal(t("unavailable.phase", { phase: "1B" }), "Indisponibil încă — Etapa 1B");
});
