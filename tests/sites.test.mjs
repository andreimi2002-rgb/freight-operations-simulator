import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createNameFilter, fold } from "../scripts/lib/site-names.mjs";
import { areaKm2, buildSites } from "../scripts/lib/sites.mjs";
import { pickSite, siteFact } from "../src/engine/sites.mjs";
import { siteKindsFor } from "../src/data/places/site-kinds.mjs";
import { CARGO } from "../src/engine/cargo.mjs";
import { validateFact } from "../src/engine/provenance.mjs";
import { generateLoad } from "../src/engine/generator.mjs";
import { validateLoad } from "../src/engine/load-model.mjs";
import { buildLoadSheet } from "../src/view-model/load-sheet.mjs";
import { setDictionary } from "../src/i18n/i18n.mjs";
import { loadCities } from "./helpers/cities.mjs";

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
setDictionary(json("../src/i18n/ro.json"));
const terms = json("../src/data/places/public-name-terms.json");
const catalog = loadCities();
const cityNamed = name => catalog.cities.find(c => c.name === name);
const filterFor = (code, kind) => createNameFilter({ terms: terms[code].terms[kind], fillers: terms[code].fillers, directions: terms[code].directions, cityNames: catalog.cities.filter(c => c.countryCode === code).map(c => c.name) });

test("folding removes accents and punctuation", () => {
  assert.equal(fold("Zonă Industrială, Vest!"), "zona industriala vest");
  assert.equal(fold("Ипари  Парк"), "ипари парк");
});

test("public place names are kept, company names are not", () => {
  const industrial = filterFor("RO", "industrialZone");
  assert.equal(industrial("Zona Industrială Vest"), "Zona Industrială Vest");
  assert.equal(industrial("Parc Industrial Arad"), "Parc Industrial Arad");
  assert.equal(industrial("Parc Industrial II"), "Parc Industrial II");
  assert.equal(industrial("Zona industrială de Nord Oradea"), "Zona industrială de Nord Oradea");
  assert.equal(industrial("Parc Industrial Bosch"), null, "a company word after the term");
  assert.equal(industrial("Platforma Industrială Alfa Metal S.R.L."), null, "legal form");
  assert.equal(industrial("Mecanica Fină"), null, "no public term");
  assert.equal(industrial("Parc Industrial Arad & Co"), null, "ampersand");
  assert.equal(industrial(""), null);
  assert.equal(industrial(undefined), null);
  const port = filterFor("RO", "port");
  assert.equal(port("Portul Constanța"), "Portul Constanța");
  assert.equal(port("Port Petrom"), null);
});

test("operator, brand and owner tags exclude a name that repeats them", () => {
  const industrial = filterFor("RO", "industrialZone");
  assert.equal(industrial("Parc Industrial Arad", { operator: "Parc Industrial Arad" }), null);
  assert.equal(industrial("Parc Industrial Arad", { brand: "Parc Industrial" }), null);
  assert.equal(industrial("Parc Industrial Arad", { operator: "Primăria Arad" }), "Parc Industrial Arad");
});

test("Hungarian and Bulgarian names follow the same rule", () => {
  const hu = filterFor("HU", "industrialZone");
  assert.equal(hu("Szegedi Ipari Park"), "Szegedi Ipari Park", "city adjective");
  assert.equal(hu("Győr Ipari Park"), "Győr Ipari Park");
  assert.equal(hu("Audi Ipari Park"), null);
  assert.equal(hu("Kovács Kft. Ipari Park"), null);
  const bg = filterFor("BG", "industrialZone");
  assert.equal(bg("Индустриална зона Север"), "Индустриална зона Север");
  assert.equal(bg("Индустриален парк Загоре ООД"), null);
});

test("legal forms are caught in every language", () => {
  const f = filterFor("RO", "logisticsPark");
  for (const name of ["Parc Logistic Alfa SA", "Parc Logistic Alfa GmbH", "Parc Logistic Alfa Kft", "Parc Logistic Alfa Ltd", "Parc Logistic Alfa ООД"]) assert.equal(f(name), null, name);
  assert.equal(f("Parc Logistic Nord"), "Parc Logistic Nord");
});

test("area of a bounding box in km²", () => {
  assert.ok(Math.abs(areaKm2({ minlat: 46, maxlat: 46.01, minlon: 21, maxlon: 21.01 }) - 0.77) < 0.1);
  assert.equal(areaKm2(undefined), 0);
});

const arad = cityNamed("Arad");
const element = (id, tags, lat, lon, size = 0.02) => ({ type: "way", id, tags, center: { lat, lon }, bounds: { minlat: lat - size / 2, maxlat: lat + size / 2, minlon: lon - size / 2, maxlon: lon + size / 2 } });

test("sites: classification, public names, city assignment, limits", () => {
  const near = [arad.latitude, arad.longitude];
  const elements = [
    element(1, { landuse: "industrial", name: "Zona Industrială Vest" }, near[0] + 0.01, near[1] + 0.01),
    element(2, { landuse: "industrial", name: "Alfa Metal S.R.L." }, near[0] + 0.03, near[1], 0.03), // company name, big enough to stay generic
    element(3, { landuse: "industrial" }, near[0] - 0.03, near[1], 0.03),                              // unnamed zone
    element(4, { landuse: "industrial", name: "Tiny" }, near[0], near[1] + 0.05, 0.001),               // too small
    element(5, { landuse: "port", name: "Portul Arad" }, near[0] + 0.02, near[1] - 0.02, 0.02),
    element(6, { landuse: "industrial", industrial: "factory", name: "Fabrica X" }, near[0], near[1] + 0.04, 0.05), // a factory, not a zone
    { type: "node", id: 7, tags: { man_made: "silo", name: "Agro SRL" }, lat: near[0] + 0.02, lon: near[1] },
    element(8, { landuse: "industrial", name: "Parc Industrial Arad" }, 47.5, 19.0, 0.02),            // far from every Romanian city? (Budapest): still assigned to a catalog city
  ];
  const { sites, report } = buildSites(elements, catalog.cities.filter(c => c.countryCode === "RO"), terms.RO);
  const byId = Object.fromEntries(sites.map(s => [s.id, s]));
  assert.equal(byId["way/1"].name, "Zona Industrială Vest");
  assert.equal(byId["way/1"].kind, "industrialZone");
  assert.equal(byId["way/2"].name, null, "company name never kept");
  assert.equal(byId["way/2"].kind, "industrialZone");
  assert.equal(byId["way/3"].name, null);
  assert.equal(byId["way/4"], undefined, "too small");
  assert.equal(byId["way/5"].kind, "port");
  assert.equal(byId["way/6"], undefined, "factory is not a zone");
  assert.equal(byId["node/7"].kind, "silo");
  assert.equal(byId["node/7"].name, null, "silo names are never kept");
  assert.equal(byId["way/8"], undefined, "no Romanian city within 15 km");
  assert.ok(sites.every(s => s.cityId === arad.id));
  assert.equal(report.noCity, 1);
  assert.equal(report.tooSmall, 1);
  assert.ok(report.nameRemoved >= 2);
});

test("sites: per-city cap and near-duplicates", () => {
  const elements = [];
  for (let i = 0; i < 12; i += 1) elements.push(element(100 + i, { landuse: "industrial" }, arad.latitude + 0.02 * (i % 4) - 0.03, arad.longitude + 0.02 * Math.floor(i / 4) - 0.02, 0.03 + i * 0.001));
  elements.push(element(200, { landuse: "industrial" }, arad.latitude, arad.longitude, 0.02));
  elements.push(element(201, { landuse: "industrial" }, arad.latitude + 0.001, arad.longitude, 0.02)); // 110 m from 200
  const { sites } = buildSites(elements, catalog.cities.filter(c => c.countryCode === "RO"), terms.RO);
  assert.ok(sites.filter(s => s.kind === "industrialZone").length <= 6);
  assert.ok(!(sites.some(s => s.id === "way/200") && sites.some(s => s.id === "way/201")));
});

const siteOf = (id, kind, cityId) => ({ id, kind, name: null, lat: 46, lon: 21, cityId, areaKm2: 1 });

test("the place is chosen by cargo kind, with a fallback to none", () => {
  const sites = { 1: [siteOf("way/1", "industrialZone", 1), siteOf("way/2", "silo", 1), siteOf("way/3", "port", 1)], 2: [siteOf("way/4", "railTerminal", 2)] };
  assert.equal(pickSite(1, CARGO.wheat, sites, () => 0).kind, "silo", "grain prefers a silo");
  assert.equal(pickSite(1, CARGO.fuel, sites, () => 0).kind, "port");
  assert.equal(pickSite(1, CARGO.machinery, sites, () => 0).kind, "industrialZone");
  assert.equal(pickSite(2, CARGO.machinery, sites, () => 0), null, "no suitable kind in that city");
  assert.equal(pickSite(3, CARGO.wheat, sites, () => 0), null, "city without sites");
  assert.equal(pickSite(1, CARGO.wheat, null, () => 0), null, "no site data at all");
  assert.ok(Object.values(CARGO).every(c => siteKindsFor(c).length > 0));
});

test("site fact: sourced with OSM link and licence, or unavailable with a reason", () => {
  const fact = siteFact(siteOf("way/42", "port", 7), "2026-10-21T00:00:00.000Z");
  assert.deepEqual(validateFact(fact), []);
  assert.equal(fact.source.url, "https://www.openstreetmap.org/way/42");
  assert.match(fact.source.license, /ODbL/);
  const none = siteFact(null, "2026-10-21T00:00:00.000Z");
  assert.deepEqual(validateFact(none), []);
  assert.equal(none.reason, "noSite");
});

const router = () => {
  const calls = [];
  return { calls, async route({ origin, destination }) {
    calls.push({ origin, destination });
    return { distanceM: 300000, durationS: 14400, geometry: [[[origin.lon, origin.lat], [destination.lon, destination.lat]]], countries: ["RO"], viaNames: [], provider: "Test router", sourceUrl: "https://example.org/route", retrievedAt: "2026-10-21T08:00:00.000Z" };
  } };
};

test("a load with places routes between the places; without data it uses the cities", async () => {
  const a = cityNamed("Arad"), b = cityNamed("Cluj-Napoca");
  const sites = { [a.id]: [{ ...siteOf("way/10", "industrialZone", a.id), lat: 46.2, lon: 21.3, name: "Zona Industrială Vest" }], [b.id]: [{ ...siteOf("way/11", "industrialZone", b.id), lat: 46.8, lon: 23.5 }] };
  const r1 = router();
  const load = await generateLoad({ cities: catalog.cities, importedAt: "2026-10-21", router: r1, originCity: a, destinationCity: b, cargoId: "machinery", sites, now: new Date("2026-10-21T08:00:00Z"), random: () => 0.5 });
  assert.deepEqual(validateLoad(load), []);
  assert.equal(load.originSite.value.name, "Zona Industrială Vest");
  assert.equal(load.destinationSite.value.name, null);
  assert.deepEqual(r1.calls[0].origin, { lat: 46.2, lon: 21.3 });
  assert.deepEqual(r1.calls[0].destination, { lat: 46.8, lon: 23.5 });
  const r2 = router();
  const plain = await generateLoad({ cities: catalog.cities, importedAt: "2026-10-21", router: r2, originCity: a, destinationCity: b, cargoId: "machinery", now: new Date("2026-10-21T08:00:00Z"), random: () => 0.5 });
  assert.deepEqual(validateLoad(plain), []);
  assert.equal(plain.originSite.level, "unavailable");
  assert.deepEqual(r2.calls[0].origin, { lat: a.latitude, lon: a.longitude });
});

test("the sheet shows the place (name or kind), the map pins move, and a load without site fields still renders", async () => {
  const a = cityNamed("Arad"), b = cityNamed("Cluj-Napoca");
  const sites = { [a.id]: [{ ...siteOf("way/10", "industrialZone", a.id), lat: 46.2, lon: 21.3, name: "Zona Industrială Vest" }], [b.id]: [{ ...siteOf("way/11", "port", b.id), lat: 46.8, lon: 23.5 }] };
  const load = await generateLoad({ cities: catalog.cities, importedAt: "2026-10-21", router: router(), originCity: a, destinationCity: b, cargoId: "fuel", sites, now: new Date("2026-10-21T08:00:00Z"), random: () => 0 });
  const sheet = buildLoadSheet(load);
  const row = id => sheet.rows.find(r => r.id === id);
  assert.equal(row("originSite").valueText, "Zona Industrială Vest, Arad");
  assert.match(row("destinationSite").valueText, /^Port, /);
  assert.ok(row("originSite").detail.links.some(l => l.url === "https://www.openstreetmap.org/way/10"));
  assert.deepEqual(sheet.map.origin, { lat: 46.2, lon: 21.3 });
  const old = structuredClone(load);
  delete old.originSite; delete old.destinationSite;
  const oldSheet = buildLoadSheet(old);
  assert.equal(oldSheet.rows.find(r => r.id === "originSite").available, false);
});

for (const code of ["RO", "HU", "BG"]) {
  const path = new URL(`../src/data/places/locations-${code}.json`, import.meta.url);
  test(`locations-${code}.json: valid sites, no company names`, { skip: !existsSync(path) && "file not built yet" }, () => {
    const file = JSON.parse(readFileSync(path, "utf8"));
    const cityIds = new Set(catalog.cities.map(c => c.id));
    assert.match(file.metadata.license, /ODbL/);
    assert.ok(file.sites.length > 0);
    const legal = /(^| )(sa|srl|s r l|kft|zrt|ood|eood|ад|оод|gmbh|ltd)( |$)|[&@]/u;
    const ids = new Set();
    for (const s of file.sites) {
      assert.match(s.id, /^(way|relation|node)\/\d+$/);
      assert.ok(!ids.has(s.id), `duplicate ${s.id}`); ids.add(s.id);
      assert.ok(cityIds.has(s.cityId), `unknown city ${s.cityId}`);
      assert.ok(Number.isFinite(s.lat) && Number.isFinite(s.lon));
      assert.ok(["industrialZone", "port", "railTerminal", "logisticsPark", "silo"].includes(s.kind));
      if (s.name) assert.ok(!legal.test(fold(s.name)), `company-like name kept: ${s.name}`);
      if (s.kind === "silo") assert.equal(s.name, null);
    }
  });
}
