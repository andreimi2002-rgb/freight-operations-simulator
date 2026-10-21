// LOCAL TESTING ONLY. Serves the repository root and answers /api/truck-route with a synthetic
// route (great-circle line with a gentle bend). It is NOT a Geoapify answer: the provider is
// labelled "FIXTURE" and the page shows a "local test data" notice. Real routes need
// GEOAPIFY_API_KEY and `netlify dev`, or a Netlify Deploy Preview.
//   node scripts/dev-server.mjs        (PORT=8080 by default)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT || 8080);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8" };
import { activeCountries } from "../src/data/countries.mjs";
import { handleWeather } from "../netlify/functions/weather.mjs";
const cities = (await Promise.all(activeCountries().map(async c => JSON.parse(await readFile(join(root, "src/data", c.cityFile), "utf8")).cities))).flat();

const rad = d => d * Math.PI / 180;
function haversineKm(a, b) {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
const countryAt = point => cities.reduce((best, city) => {
  const d = haversineKm(point, { lat: city.latitude, lon: city.longitude });
  return d < best.d ? { d, code: city.countryCode } : best;
}, { d: Infinity, code: null }).code;

function fixtureRoute(origin, destination) {
  const crow = haversineKm(origin, destination);
  const km = crow * 1.24;
  const points = [];
  const steps = 60;
  for (let i = 0; i <= steps; i += 1) {
    const f = i / steps;
    const bend = Math.sin(f * Math.PI) * Math.min(0.25, crow / 4000);
    points.push([origin.lon + (destination.lon - origin.lon) * f + bend, origin.lat + (destination.lat - origin.lat) * f + bend * 0.6]);
  }
  const countries = [];
  for (let i = 0; i <= steps; i += 6) {
    const code = countryAt({ lat: points[i][1], lon: points[i][0] });
    if (code && countries.at(-1) !== code) countries.push(code);
  }
  return {
    distanceMeters: Math.round(km * 1000),
    durationSeconds: Math.round(km / 68 * 3600),
    provider: "FIXTURE (test local, nu Geoapify)",
    profile: "heavy_truck",
    modeledMaximumGrossWeightKg: 40000,
    modeledMaximumHeightMeters: 4.1,
    trafficModel: "approximated",
    hasTolls: false,
    hasFerries: false,
    countries,
    roadClasses: [],
    namedRoads: [{ name: "TEST-1", distanceMeters: km * 600 }, { name: "TEST-2", distanceMeters: km * 300 }, { name: "TEST-3", distanceMeters: km * 100 }],
    surfaces: [],
    segmentCount: 0, maneuverCount: 0, providerSegmentCount: 0, omittedSegmentCount: 0, segments: [],
    geometry: [points],
    sourceUrl: "https://apidocs.geoapify.com/docs/routing/",
    retrievedAt: new Date().toISOString(),
  };
}

createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/api/truck-route" && request.method === "POST") {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    try {
      const { origin, destination } = JSON.parse(raw);
      response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(JSON.stringify(fixtureRoute(origin, destination)));
    } catch {
      response.writeHead(400).end(JSON.stringify({ error: "bad request" }));
    }
    return;
  }
  const weatherMatch = url.pathname.match(/^\/api\/weather\/([^/]+)$/);
  if (weatherMatch && request.method === "GET") {
    const answer = await handleWeather(decodeURIComponent(weatherMatch[1])); // real MET Norway data, not a fixture
    response.writeHead(answer.status, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(await answer.text());
    return;
  }
  const relative = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
  const file = join(root, relative === "" ? "index.html" : relative);
  if (!file.startsWith(root)) { response.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    response.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  }
}).listen(port, () => console.log(`FOS dev server (fixture routes) on http://localhost:${port}`));
