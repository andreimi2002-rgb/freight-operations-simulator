// Countries are DATA. The engine, the UI, the importer and the tests read this list; nothing else
// names a country. A country package (see docs/ROADMAP.md) adds an entry here plus data files.
//
//   code             ISO 3166-1 alpha-2
//   timeZones        IANA zones the country's cities may use (the importer rejects any other)
//   capitalGeonamesId  a city that must be in the catalog (sanity check on import)
//   minCities        the importer refuses a catalog with fewer cities than this
//   cityFile         catalog file, relative to src/data/
//   wikiLangs        Wikipedia languages whose lead image may be used when Wikidata has no photo (English is always added)
//   photoFile        prepared city photos (scripts/build-city-photos.mjs), relative to src/data/
export const COUNTRIES = {
  RO: { code: "RO", timeZones: ["Europe/Bucharest"], capitalGeonamesId: 683506, minCities: 50, cityFile: "places/cities-RO.json", wikiLangs: ["ro"], photoFile: "photos/cities-RO.json" },
  HU: { code: "HU", timeZones: ["Europe/Budapest"], capitalGeonamesId: 3054643, minCities: 40, cityFile: "places/cities-HU.json", wikiLangs: ["hu"], photoFile: "photos/cities-HU.json" },
  BG: { code: "BG", timeZones: ["Europe/Sofia"], capitalGeonamesId: 727011, minCities: 25, cityFile: "places/cities-BG.json", wikiLangs: ["bg"], photoFile: "photos/cities-BG.json" },
};

// Countries the application currently serves.
export const ACTIVE_COUNTRIES = ["RO", "HU", "BG"];

export const activeCountries = () => ACTIVE_COUNTRIES.map(code => COUNTRIES[code]);
