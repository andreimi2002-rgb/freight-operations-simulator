// Removes from the catalog the cities that have no usable photo after scripts/build-city-photos.mjs
// (owner's decision, 2026-10-20: small or ambiguous cities without a free photo are not offered).
//   node scripts/prune-cities-without-photo.mjs        (active countries)
// Records each removed city in src/data/places/exclusions.json (with the reason), so that
// scripts/import-geonames.mjs keeps them out, and rewrites the city files, photo files and lookup.json.
import { readFile, writeFile } from "node:fs/promises";
import { ACTIVE_COUNTRIES, COUNTRIES } from "../src/data/countries.mjs";
import { buildPlacesLookup } from "./lib/places-lookup.mjs";

const EXCLUSIONS = new URL("../src/data/places/exclusions.json", import.meta.url);
const read = async url => JSON.parse(await readFile(url, "utf8"));
const exclusions = await read(EXCLUSIONS).catch(() => ({ about: "", cities: {} }));
exclusions.about = "Cities left out of the catalog on purpose. scripts/import-geonames.mjs skips them. Remove an entry to bring a city back (e.g. when a free photo appears).";

for (const code of process.argv.slice(2).map(c => c.toUpperCase()).length ? process.argv.slice(2).map(c => c.toUpperCase()) : ACTIVE_COUNTRIES) {
  const country = COUNTRIES[code];
  const cityUrl = new URL(`../src/data/${country.cityFile}`, import.meta.url);
  const photoUrl = new URL(`../src/data/${country.photoFile}`, import.meta.url);
  const catalog = await read(cityUrl);
  const photos = await read(photoUrl);
  const removed = catalog.cities.filter(city => !photos.photos[city.id]);
  if (removed.some(city => city.id === country.capitalGeonamesId)) throw new Error(`${code}: the capital has no photo; not pruning`);
  for (const city of removed) {
    exclusions.cities[city.id] = { name: city.name, countryCode: code, population: city.population, reason: `no usable free photo: ${photos.skipped[city.id] || "none"}`, since: new Date().toISOString().slice(0, 10) };
  }
  catalog.cities = catalog.cities.filter(city => photos.photos[city.id]);
  catalog.cities.forEach((city, index) => { city.countryRank = index + 1; });
  catalog.metadata.count = catalog.cities.length;
  catalog.metadata.excluded = "cities without a usable free photo are listed in src/data/places/exclusions.json";
  if (catalog.cities.length < country.minCities) throw new Error(`${code}: only ${catalog.cities.length} cities would remain`);
  photos.skipped = {};
  photos.metadata.cities = catalog.cities.length;
  photos.metadata.skipped = 0;
  await writeFile(cityUrl, JSON.stringify(catalog) + "\n");
  await writeFile(photoUrl, JSON.stringify(photos, null, 1) + "\n");
  console.log(`${code}: removed ${removed.length} (${removed.map(c => c.name).join(", ")}); ${catalog.cities.length} cities remain`);
}
await writeFile(EXCLUSIONS, JSON.stringify(exclusions, null, 1) + "\n");
const lookup = await buildPlacesLookup();
console.log(`lookup.json: ${lookup.count} places`);
