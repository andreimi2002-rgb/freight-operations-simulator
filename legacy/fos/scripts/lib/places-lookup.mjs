// Builds src/data/places/lookup.json: a compact index of the active countries' cities
// (GeoNames ID -> coordinates, time zone, country) used by server functions (e.g. /api/weather/:id),
// so they can look a city up without naming any country in code.
import { readFile, writeFile } from "node:fs/promises";
import { activeCountries } from "../../src/data/countries.mjs";

export async function buildPlacesLookup() {
  const places = {};
  const countries = [];
  for (const country of activeCountries()) {
    const file = JSON.parse(await readFile(new URL(`../../src/data/${country.cityFile}`, import.meta.url), "utf8"));
    countries.push(country.code);
    for (const city of file.cities) places[city.id] = [city.latitude, city.longitude, city.timeZone, city.countryCode];
  }
  const lookup = { generatedFrom: "src/data/countries.mjs (active countries) + their city files", countries, places };
  await writeFile(new URL("../../src/data/places/lookup.json", import.meta.url), JSON.stringify(lookup) + "\n");
  return { countries, count: Object.keys(places).length };
}
