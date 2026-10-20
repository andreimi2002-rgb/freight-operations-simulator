// Loads the static geographic data used by the 2A facts (country borders, border crossings, Schengen list,
// UN/LOCODE codes). Everything is optional: when a file cannot be loaded the matching facts show "Indisponibil".
import { prepareBorders } from "../engine/border-split.mjs";
import { activeCountries } from "../data/countries.mjs";

async function json(path) {
  const response = await fetch(`/src/data/${path}`, { cache: "force-cache" });
  if (!response.ok) throw new Error(path);
  return response.json();
}

// -> { geo: { borders, crossings, schengen } | null, locodes: { geonamesId: "ROBUH" }, sites: { geonamesId: [site] } }
export async function loadGeoData() {
  const [borders, crossings, schengen, locodes, ...locations] = await Promise.allSettled([
    json("geo/borders.json"), json("geo/border-crossings.json"), json("geo/schengen.json"), json("places/locodes.json"),
    ...activeCountries().map(country => json(`places/locations-${country.code}.json`)),
  ]);
  // loading places by city; a country whose file is missing simply has none
  const sites = {};
  for (const file of locations) if (file.status === "fulfilled") for (const site of file.value.sites) (sites[site.cityId] ??= []).push({ ...site, retrievedAt: file.value.metadata.builtAt });
  const geo = borders.status === "fulfilled"
    ? {
      borders: prepareBorders(borders.value),
      crossings: crossings.status === "fulfilled" ? crossings.value.crossings : [],
      schengen: schengen.status === "fulfilled" ? schengen.value.members : [],
    }
    : null;
  return { geo, locodes: locodes.status === "fulfilled" ? locodes.value.codes : {}, sites };
}
