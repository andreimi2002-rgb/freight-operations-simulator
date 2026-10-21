// Test helper: the city catalog of the active countries, read from their data files.
import { readFileSync } from "node:fs";
import { activeCountries } from "../../src/data/countries.mjs";

export function loadCityFile(country) {
  return JSON.parse(readFileSync(new URL(`../../src/data/${country.cityFile}`, import.meta.url), "utf8"));
}

export function loadCities() {
  const files = activeCountries().map(loadCityFile);
  const cities = files.flatMap(file => file.cities.map(city => ({ ...city, importedAt: file.metadata.importedAt })));
  return { metadata: files[0].metadata, cities };
}
