const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

export default async function searchPlaces(request) {
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) return json({ error: "Geoapify is not configured. Add GEOAPIFY_API_KEY to Netlify environment variables for Production and Deploy Previews." }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Request body must be valid JSON." }, 400); }
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (query.length < 3 || query.length > 120) return json({ error: "Enter a search between 3 and 120 characters." }, 400);

  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", query);
  url.searchParams.set("limit", "5");
  url.searchParams.set("lang", "en");
  url.searchParams.set("format", "json");
  url.searchParams.set("apiKey", apiKey);

  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (upstream.status === 429) return json({ error: "Place search is temporarily rate limited. Try again shortly." }, 429);
    if (!upstream.ok) return json({ error: "The place-data provider could not complete the search." }, 502);
    const payload = await upstream.json();
    const retrievedAt = new Date().toISOString();
    const results = (payload.results || []).filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lon)).map(item => ({
      id: String(item.place_id || item.datasource?.raw?.osm_id || `${item.lat},${item.lon}`),
      name: item.name || item.address_line1 || item.formatted || "Unnamed place",
      address: item.formatted || item.address_line2 || "Address not provided by source",
      city: item.city || item.town || item.village || null,
      region: item.state || item.county || null,
      country: item.country || null,
      countryCode: item.country_code || null,
      lat: item.lat,
      lon: item.lon,
      resultType: item.result_type || null,
      sourceName: item.datasource?.sourcename || "Geoapify Geocoding API",
      sourceUrl: item.datasource?.url || null,
      attribution: payload.attribution || "Geoapify",
      retrievedAt,
    }));
    return json({
      results,
      source: { provider: "Geoapify Geocoding API", attribution: payload.attribution || "Geoapify", retrievedAt },
    });
  } catch (error) {
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    return json({ error: timeout ? "Place search timed out. Try again." : "Place search is unavailable right now." }, 502);
  }
}
