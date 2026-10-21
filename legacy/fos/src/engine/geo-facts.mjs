// Facts derived from the route geometry and geographic data: distance by country and border crossings.
// geo: { borders (prepared, see border-split.mjs), crossings: [{ country, lat, lon, name, osm }], schengen: [codes] }
// Without geo data (or without a usable geometry) both facts are unavailable, with the reason.
import { borderRegime, distancesByCountry, findCrossing, splitRoute } from "./border-split.mjs";
import { computed, unavailable } from "./provenance.mjs";

const MATCH_KM = 5;

export function routeGeoFacts(summary, geo) {
  if (!geo?.borders) return { countryDistances: unavailable("2", "borderDataMissing"), borderCrossings: unavailable("2", "borderDataMissing") };
  const split = splitRoute(summary.geometry, geo.borders);
  if (!split) return { countryDistances: unavailable("2", "noGeometry"), borderCrossings: unavailable("2", "noGeometry") };
  const rows = distancesByCountry(split, summary.distanceKm);
  if (!rows) return { countryDistances: unavailable("2", "noGeometry"), borderCrossings: unavailable("2", "noGeometry") };

  const countryDistances = computed({ countries: rows }, "countryDistances", {
    routeKm: summary.distanceKm,
    geometryKm: Math.round(split.lengthM / 100) / 10,
    countries: rows.length,
  }, { datasets: ["naturalEarth"] });

  const crossings = split.crossings.map(c => {
    const found = findCrossing(c, c.from, c.to, geo.crossings || [], MATCH_KM);
    return {
      from: c.from, to: c.to,
      lat: Math.round(c.lat * 1e4) / 1e4, lon: Math.round(c.lon * 1e4) / 1e4,
      name: found?.name ?? null,
      osm: found?.osm ?? [],
      distanceM: found ? found.distanceM : null,
      regime: borderRegime(c.from, c.to, geo.schengen || []),
    };
  });
  const borderCrossings = crossings.length
    ? computed({ crossings }, "borderCrossings", { crossings: crossings.length, matchKm: MATCH_KM, matched: crossings.filter(c => c.osm.length).length }, { datasets: ["naturalEarth", "osm", "schengen"] })
    : computed({ crossings: [] }, "noBorderCrossed", { countries: rows.length }, { datasets: ["naturalEarth"] });
  return { countryDistances, borderCrossings };
}
