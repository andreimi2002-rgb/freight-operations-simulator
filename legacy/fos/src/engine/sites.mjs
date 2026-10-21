// Loading and unloading places inside a city (phase 2B). Places come from OpenStreetMap (ODbL), prepared
// offline by scripts/build-locations.mjs. Without a place the route simply runs between the cities.
import { siteKindsFor } from "../data/places/site-kinds.mjs";
import { sourced, unavailable } from "./provenance.mjs";

// sitesByCity: { [geonamesId]: [{ id, kind, name|null, lat, lon, cityId, areaKm2 }] } -> a site or null
export function pickSite(cityId, cargo, sitesByCity, random = Math.random) {
  const sites = sitesByCity?.[cityId];
  if (!sites?.length) return null;
  const kinds = siteKindsFor(cargo);
  // the first kind (in order of preference) that the city has; a random place of that kind
  for (const kind of kinds) {
    const matching = sites.filter(site => site.kind === kind);
    if (matching.length) return matching[Math.min(matching.length - 1, Math.floor(random() * matching.length))];
  }
  return null;
}

// retrievedAt: the date of the data file the site came from (site.retrievedAt) or, failing that, the given date
export function siteFact(site, retrievedAt) {
  if (!site) return unavailable("2", "noSite");
  const osmId = site.id;
  return sourced({
    osmId, kind: site.kind, name: site.name ?? null, lat: site.lat, lon: site.lon, cityGeonamesId: site.cityId,
  }, { name: "OpenStreetMap", url: `https://www.openstreetmap.org/${osmId}`, retrievedAt: site.retrievedAt || retrievedAt, license: "ODbL 1.0, © OpenStreetMap contributors" }, { datasets: ["osmSites"] });
}
