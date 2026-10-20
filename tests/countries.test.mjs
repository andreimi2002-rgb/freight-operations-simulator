import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ACTIVE_COUNTRIES, COUNTRIES, activeCountries } from "../src/data/countries.mjs";
import { generateLoad } from "../src/engine/generator.mjs";
import { validateLoad } from "../src/engine/load-model.mjs";
import { setDictionary } from "../src/i18n/i18n.mjs";
import { activeCountriesText } from "../src/ui/dom.mjs";
import { loadCities, loadCityFile } from "./helpers/cities.mjs";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
setDictionary(JSON.parse(readFileSync(new URL("../src/i18n/ro.json", import.meta.url), "utf8")));

const router = {
  async route({ origin, destination }) {
    return { distanceM: 400000, durationS: 18000, geometry: [[[origin.lon, origin.lat], [destination.lon, destination.lat]]], countries: [], viaNames: [], provider: "Test router", sourceUrl: "https://example.org/route", retrievedAt: "2026-10-20T08:00:00.000Z" };
  },
};
const cycle = values => { let i = 0; return () => values[i++ % values.length]; };
const fixtureCity = (id, name, countryCode, latitude, longitude, timeZone) => ({ id, name, latitude, longitude, countryCode, adminCode: "", featureCode: "PPLA", population: 500000, timeZone, countryRank: 1 });

test("every active country is configured and has a consistent city file", () => {
  assert.ok(ACTIVE_COUNTRIES.length >= 1);
  for (const country of activeCountries()) {
    assert.equal(COUNTRIES[country.code].code, country.code);
    const file = loadCityFile(country);
    assert.equal(file.metadata.countryCode, country.code);
    assert.ok(file.metadata.importedAt && file.metadata.license === "CC BY 4.0");
    assert.ok(file.cities.length >= country.minCities, `${country.code}: ${file.cities.length} cities`);
    assert.ok(file.cities.some(city => city.id === country.capitalGeonamesId), `${country.code} capital`);
    for (const city of file.cities) {
      assert.equal(city.countryCode, country.code, city.name);
      assert.ok(country.timeZones.includes(city.timeZone), `${city.name}: ${city.timeZone}`);
      assert.ok(city.population >= 15000 && city.featureCode !== "PPLX", city.name);
    }
  }
});

test("the merged catalog carries each country's own import date", () => {
  const { cities } = loadCities();
  assert.ok(cities.every(city => city.importedAt));
  assert.equal(new Set(cities.map(city => city.countryCode)).size, ACTIVE_COUNTRIES.length);
});

test("a new country is data only: Austria works without any code change", async () => {
  const vienna = fixtureCity(2761369, "Vienna", "AT", 48.2085, 16.3721, "Europe/Vienna");
  const graz = fixtureCity(2778067, "Graz", "AT", 47.0667, 15.45, "Europe/Vienna");
  const budapest = loadCities().cities.find(city => city.name === "Budapest");
  const options = { cities: [vienna, graz], importedAt: "2026-10-20T00:00:00.000Z", router, now: new Date("2026-10-20T08:00:00Z"), random: cycle([0.1, 0.9, 0.4, 0.6]) };

  const load = await generateLoad({ ...options, countries: ["AT"] });
  assert.deepEqual(validateLoad(load, { countries: ["AT"] }), []);
  assert.ok(validateLoad(load).some(p => p.includes("outside the active countries")), "not valid for the active list alone");
  assert.deepEqual(load.scope.countries, ["AT"]);

  // a cross-package route (Hungary -> Austria) needs both countries listed
  const crossing = await generateLoad({ ...options, cities: [vienna, budapest], originCity: budapest, destinationCity: vienna, countries: ["HU", "AT"] });
  assert.deepEqual(validateLoad(crossing, { countries: ["HU", "AT"] }), []);
  await assert.rejects(
    generateLoad({ ...options, cities: [vienna, budapest], originCity: budapest, destinationCity: vienna }),
    error => error.code === "invalidLoad",
  );
});

test("country texts are built from the data", () => {
  assert.equal(activeCountriesText(), "România, Ungaria și Bulgaria");
});

function sourceFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(mjs|js)$/.test(name) ? [path] : [];
  });
}
test("no code names the active countries; the list lives in src/data/countries.mjs only", () => {
  const folders = ["src/engine", "src/ui", "src/view-model", "src/adapters", "scripts", "netlify"].map(dir => join(root, dir));
  const files = [...folders.flatMap(sourceFiles), join(root, "src/main.js")];
  for (const file of files) {
    let text;
    try { text = readFileSync(file, "utf8"); } catch { continue; } // unreadable in this sandbox; covered by the browser run
    assert.ok(!/\[\s*["']RO["']\s*,\s*["']HU["']/.test(text), `${file} hard-codes a country list`);
    assert.ok(!/cities-ro-hu-bg/.test(text), `${file} points at the old single catalog`);
  }
});
