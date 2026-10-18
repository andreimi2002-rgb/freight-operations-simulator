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
  url.searchParams.set("mode", "truck");
  url.searchParams.set("format", "json");
  url.searchParams.set("apiKey", apiKey);

  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (upstream.status === 429) return json({ error: "Truck routing is temporarily rate limited. Try again shortly." }, 429);
    if (!upstream.ok) return json({ error: "The routing provider could not calculate this truck route." }, 502);
    const payload = await upstream.json();
    const route = payload.features?.[0]?.properties || payload.results?.[0];
    if (!Number.isFinite(route?.distance) || !Number.isFinite(route?.time)) return json({ error: "The routing provider returned no usable truck route." }, 502);
    return json({
      distanceMeters: route.distance,
      durationSeconds: route.time,
      provider: "Geoapify Routing API",
      profile: "truck",
      sourceUrl: "https://apidocs.geoapify.com/docs/routing/",
      retrievedAt: new Date().toISOString(),
    });
  } catch (error) {
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    return json({ error: timeout ? "Truck routing timed out. Try again." : "Truck routing is unavailable right now." }, 502);
  }
}
