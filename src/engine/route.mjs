// Calls a routing adapter (Geoapify today, an own OSM router in phase 5) and checks its answer.
// Adapter contract: route({ origin, destination, vehicle }) -> { distanceM, durationS, geometry,
//   countries, viaNames, provider, sourceUrl, retrievedAt, profile?, trafficModel?, hasTolls? }
import { sourced, unavailable } from "./provenance.mjs";

export class RouteAnswerError extends Error {}

export function checkRouteAnswer(answer) {
  const ok = answer && Number.isFinite(answer.distanceM) && answer.distanceM > 0 && Number.isFinite(answer.durationS) && answer.durationS > 0
    && Array.isArray(answer.geometry) && answer.provider && /^https?:\/\//.test(answer.sourceUrl || "") && answer.retrievedAt;
  if (!ok) throw new RouteAnswerError("unusable route answer");
  return answer;
}

export async function routeFacts(router, origin, destination, vehicle = "heavyTruck") {
  const answer = checkRouteAnswer(await router.route({ origin: { lat: origin.lat, lon: origin.lon }, destination: { lat: destination.lat, lon: destination.lon }, vehicle }));
  return {
    summary: sourced({
      distanceKm: answer.distanceM / 1000,
      durationS: answer.durationS,
      countries: answer.countries || [],
      viaNames: answer.viaNames || [],
      geometry: answer.geometry,
      profile: answer.profile || null,
      trafficModel: answer.trafficModel || null,
      hasTolls: answer.hasTolls === true,
      provider: answer.provider,
    }, { name: answer.provider, url: answer.sourceUrl, retrievedAt: answer.retrievedAt }),
    // Filled by routeGeoFacts() (src/engine/geo-facts.mjs) when border data is available.
    borderCrossings: unavailable("2", "borderDataMissing"),
    countryDistances: unavailable("2", "borderDataMissing"),
  };
}
