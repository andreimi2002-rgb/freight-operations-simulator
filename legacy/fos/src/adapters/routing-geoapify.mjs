import { languageTag } from "../i18n/i18n.mjs";

// Routing adapter, TEMPORARY: Geoapify heavy-truck routing through the Netlify function
// /api/truck-route (the API key stays on the server). Phase 5 replaces it with an own
// OpenStreetMap router that implements the same route() contract (see src/engine/route.mjs).

export class RouteServiceError extends Error {
  constructor(status) { super(`route service error ${status}`); this.status = status; }
}


export function createGeoapifyRouter({ endpoint = "/api/truck-route", fetchImpl = (...args) => fetch(...args) } = {}) {
  return {
    async route({ origin, destination }) {
      let response;
      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ origin, destination, lang: languageTag() }),
        });
      } catch { throw new RouteServiceError(0); }
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) throw new RouteServiceError(response.status || 0);
      return {
        distanceM: payload.distanceMeters,
        durationS: payload.durationSeconds,
        geometry: payload.geometry || [],
        countries: payload.countries || [],
        viaNames: (payload.namedRoads || []).slice(0, 3).map(road => road.name).filter(Boolean),
        provider: payload.provider || "Geoapify Routing API",
        sourceUrl: payload.sourceUrl || "https://apidocs.geoapify.com/docs/routing/",
        retrievedAt: payload.retrievedAt,
        profile: payload.profile || null,
        trafficModel: payload.trafficModel || null,
        hasTolls: payload.hasTolls === true,
      };
    },
  };
}
