// Rebuilds src/data/places/lookup.json from the active countries' city files (no download).
//   node scripts/build-places-lookup.mjs
// scripts/import-geonames.mjs also rebuilds it after every import.
import { buildPlacesLookup } from "./lib/places-lookup.mjs";

const { countries, count } = await buildPlacesLookup();
console.log(`lookup.json: ${count} places from ${countries.join(", ")}`);
