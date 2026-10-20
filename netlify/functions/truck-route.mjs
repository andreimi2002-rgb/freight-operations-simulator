const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

const validPoint = point => point && Number.isFinite(point.lat) && Number.isFinite(point.lon)
  && point.lat >= -90 && point.lat <= 90 && point.lon >= -180 && point.lon <= 180;

export default async function truckRoute(request) {
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) return json({ error: "Geoapify is not configured. Add GEOAPIFY_API_KEY to Netlify environment variables for Production and Deploy Previews." }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Request body must be valid JSON." }, 400); }
  if (!validPoint(body?.origin) || !validPoint(body?.destination)) return json({ error: "Choose valid source locations before routing." }, 400);

  const url = new URL("https://api.geoapify.com/v1/routing");
  url.searchParams.set("waypoints", `${body.origin.lat},${body.origin.lon}|${body.destination.lat},${body.destination.lon}`);
  url.searchParams.set("mode", "heavy_truck");
  url.searchParams.set("traffic", "approximated");
  url.searchParams.set("details", "route_details,instruction_details");
  url.searchParams.set("lang", /^[a-z]{2}$/.test(body.lang || "") ? body.lang : "en"); // road names in the interface language
  url.searchParams.set("format", "geojson");
  url.searchParams.set("apiKey", apiKey);

  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (upstream.status === 429) return json({ error: "Truck routing is temporarily rate limited. Try again shortly." }, 429);
    if (!upstream.ok) return json({ error: "The routing provider could not calculate this truck route." }, 502);
    const payload = await upstream.json();
    const feature = payload.features?.[0];
    const route = feature?.properties || payload.results?.[0];
    if (!Number.isFinite(route?.distance) || !Number.isFinite(route?.time)) return json({ error: "The routing provider returned no usable truck route." }, 502);

    const rawLegs = Array.isArray(route.legs) ? route.legs : [];
    const allSteps = rawLegs.flatMap((leg, legIndex) => (Array.isArray(leg.steps) ? leg.steps : []).map(step => ({ ...step, legIndex })));
    const roadClassTotals = new Map();
    const namedRoadTotals = new Map();
    const surfaceTotals = new Map();
    const countries = new Set();
    for (const leg of rawLegs) {
      const values = Array.isArray(leg.country_code) ? leg.country_code : leg.country_code ? [leg.country_code] : [];
      values.forEach(code => countries.add(String(code).toUpperCase()));
    }
    for (const step of allSteps) {
      const distance = Number.isFinite(step.distance) ? step.distance : 0;
      if (step.road_class) roadClassTotals.set(step.road_class, (roadClassTotals.get(step.road_class) || 0) + distance);
      if (step.name) namedRoadTotals.set(step.name, (namedRoadTotals.get(step.name) || 0) + distance);
      if (step.surface) surfaceTotals.set(step.surface, (surfaceTotals.get(step.surface) || 0) + distance);
    }
    const summarize = totals => [...totals.entries()]
      .map(([name, distanceMeters]) => ({ name, distanceMeters, share: route.distance ? distanceMeters / route.distance : 0 }))
      .sort((a, b) => b.distanceMeters - a.distanceMeters);
    const geometry = feature?.geometry?.type === "MultiLineString"
      ? feature.geometry.coordinates
      : feature?.geometry?.type === "LineString" ? [feature.geometry.coordinates] : [];
    const sampledGeometry = geometry.map(line => {
      if (!Array.isArray(line) || line.length <= 500) return line;
      const interval = Math.ceil(line.length / 500);
      return line.filter((_, index) => index === 0 || index === line.length - 1 || index % interval === 0);
    });
    const rawSegments = allSteps.map(step => ({
      distanceMeters: Number.isFinite(step.distance) ? step.distance : null,
      durationSeconds: Number.isFinite(step.time) ? step.time : null,
      roadName: typeof step.name === "string" ? step.name.slice(0, 120) : null,
      roadClass: typeof step.road_class === "string" ? step.road_class : null,
      surface: typeof step.surface === "string" ? step.surface : null,
      speedLimit: Number.isFinite(step.speed_limit) ? step.speed_limit : null,
      truckLimit: Number.isFinite(step.truck_limit) ? step.truck_limit : null,
      laneCount: Number.isFinite(step.lane_count) ? step.lane_count : null,
      toll: step.toll === true,
      ferry: step.ferry === true,
      bridge: step.bridge === true,
      tunnel: step.tunnel === true,
      instruction: typeof step.instruction?.text === "string" ? step.instruction.text.slice(0, 300) : null,
      maneuver: typeof step.instruction?.type === "string" ? step.instruction.type : null,
    }));
    const groupedSegments = [];
    for (const step of rawSegments) {
      const previous = groupedSegments.at(-1);
      const sameRoadProperties = previous
        && ["roadName", "roadClass", "surface", "speedLimit", "truckLimit"].every(key => previous[key] === step[key]);
      if (sameRoadProperties && !step.instruction) {
        previous.distanceMeters += step.distanceMeters || 0;
        previous.durationSeconds += step.durationSeconds || 0;
        if (previous.laneCount !== step.laneCount) previous.laneCount = null;
        previous.toll ||= step.toll;
        previous.ferry ||= step.ferry;
        previous.bridge ||= step.bridge;
        previous.tunnel ||= step.tunnel;
      } else {
        groupedSegments.push({ ...step });
      }
    }
    const maneuvers = groupedSegments.filter(step => step.instruction);
    const segments = maneuvers.slice(0, 20);
    return json({
      distanceMeters: route.distance,
      durationSeconds: route.time,
      provider: "Geoapify Routing API",
      profile: "heavy_truck",
      modeledMaximumGrossWeightKg: 40000,
      modeledMaximumHeightMeters: 4.1,
      trafficModel: "approximated",
      hasTolls: route.toll === true || allSteps.some(step => step.toll === true),
      hasFerries: route.ferry === true || allSteps.some(step => step.ferry === true),
      countries: [...countries],
      roadClasses: summarize(roadClassTotals),
      namedRoads: summarize(namedRoadTotals).slice(0, 12),
      surfaces: summarize(surfaceTotals),
      segmentCount: groupedSegments.length,
      maneuverCount: maneuvers.length,
      providerSegmentCount: allSteps.length,
      omittedSegmentCount: Math.max(0, maneuvers.length - segments.length),
      segments,
      geometry: sampledGeometry,
      sourceUrl: "https://apidocs.geoapify.com/docs/routing/",
      retrievedAt: new Date().toISOString(),
    });
  } catch (error) {
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    return json({ error: timeout ? "Truck routing timed out. Try again." : "Truck routing is unavailable right now." }, 502);
  }
}
