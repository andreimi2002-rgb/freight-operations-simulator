#!/usr/bin/env node
// Builds data/map/ats-map.json: the base layers of the Freight World map, drawn in our
// own style (no game files): state shapes and borders, lakes, and the roads of the states
// in scope with their number and level (Interstate / US / State). Source: Natural Earth
// 1:10m (public domain). Projected to x/y once here so the browser only draws.
//
//   node scripts/map/build-map.mjs          (downloads into .cache/ne if missing)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cacheDir = join(root, '.cache/ne');
const UA = 'FreightWorldDataBot/0.1 (https://github.com/andreimi2002-rgb/freight-operations-simulator)';
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';

async function ne(name) {
  const file = join(cacheDir, `${name}.geojson`);
  if (!existsSync(file)) {
    mkdirSync(cacheDir, { recursive: true });
    const res = await fetch(`${NE}${name}.geojson`, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${name}: ${res.status}`);
    writeFileSync(file, await res.text());
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

const scope = JSON.parse(readFileSync(join(root, 'data/ats/scope.json'), 'utf8'));
const codes = new Set(scope.states.map((s) => `US-${s.code}`));

// ---- Projection: equirectangular scaled at the middle latitude (km-like units) ----
const LAT0 = 36.5;
const LON0 = -116.5;
const K = 111.32; // km per degree of latitude
const COS = Math.cos((LAT0 * Math.PI) / 180);
export const project = ([lon, lat]) => [Math.round((lon - LON0) * COS * K * 10) / 10, Math.round(-(lat - LAT0) * K * 10) / 10];

// ---- Geometry helpers -------------------------------------------------------------
function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const polysOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
const inPolys = (p, polys) => polys.some((poly) => pointInRing(p, poly[0]) && !poly.slice(1).some((h) => pointInRing(p, h)));

function simplify(points, tol) {
  if (points.length < 3) return points;
  const sq = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  const segDist = (p, a, b) => {
    const l = sq(a, b);
    if (!l) return sq(p, a);
    let t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l;
    t = Math.max(0, Math.min(1, t));
    return sq(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
  };
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let max = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = segDist(points[i], points[s], points[e]);
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol * tol) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  return points.filter((_, i) => keep[i]);
}

// ---- Layers ---------------------------------------------------------------------------
const statesGeo = await ne('ne_10m_admin_1_states_provinces');
const inScope = statesGeo.features.filter((f) => codes.has(f.properties.iso_3166_2));
if (inScope.length !== codes.size) throw new Error(`found ${inScope.length} of ${codes.size} states`);
const scopePolys = inScope.flatMap((f) => polysOf(f.geometry));
// Neighbouring land drawn faintly for context (other US states, Mexico border region).
const neighbours = statesGeo.features.filter((f) => !codes.has(f.properties.iso_3166_2) && ['USA', 'MEX'].includes(f.properties.adm0_a3) && f.properties.longitude > -126 && f.properties.longitude < -100 && f.properties.latitude > 25 && f.properties.latitude < 50);

const ring = (r) => simplify(r.map(project), 1.5);
const states = inScope.map((f) => ({ code: f.properties.iso_3166_2.slice(3), name: f.properties.name, rings: polysOf(f.geometry).map((p) => ring(p[0])) }));
const context = neighbours.map((f) => ({ name: f.properties.name, rings: polysOf(f.geometry).map((p) => ring(p[0])) }));

const roadsGeo = await ne('ne_10m_roads');
const levelOf = (p) => (p.level === 'Interstate' ? 'I' : p.level === 'Federal' ? 'US' : p.level === 'State' ? 'S' : 'O');
const roads = [];
for (const f of roadsGeo.features) {
  if (f.properties.sov_a3 !== 'USA') continue;
  const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const line of lines) {
    // Keep the runs of the line that lie in the states in scope (plus one point either
    // side, so roads visibly leave the map like on the in-game map).
    let run = [];
    const flush = () => { if (run.length > 1) roads.push({ level: levelOf(f.properties), ref: f.properties.name ?? null, pts: simplify(run.map(project), 0.6) }); run = []; };
    line.forEach((p, i) => {
      if (inPolys(p, scopePolys)) {
        if (!run.length && i > 0) run.push(line[i - 1]);
        run.push(p);
      } else if (run.length) {
        run.push(p);
        flush();
      }
    });
    flush();
  }
}

const lakesGeo = await ne('ne_10m_lakes');
const lakes = lakesGeo.features
  .filter((f) => polysOf(f.geometry).some((poly) => poly[0].some((p) => inPolys(p, scopePolys))))
  .map((f) => ({ name: f.properties.name, rings: polysOf(f.geometry).map((p) => simplify(p[0].map(project), 0.8)) }));

// Cities from the game data, projected the same way.
const { cities } = JSON.parse(readFileSync(join(root, 'data/ats/cities.json'), 'utf8'));
const cityPts = cities.filter((c) => c.coordinates).map((c) => ({ id: c.id, name: c.name, state: c.state, depots: c.depots.length, xy: project([c.coordinates.lon, c.coordinates.lat]) }));

// Bounds of the states in scope.
const all = states.flatMap((s) => s.rings.flat());
const bounds = [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1]))];

mkdirSync(join(root, 'data/map'), { recursive: true });
const out = {
  meta: {
    description: 'Base layers of the Freight World map, drawn in our own style (no game files). Coordinates are projected x/y in kilometres (equirectangular at 36.5°N, origin 116.5°W 36.5°N). Roads are real-world highways of the states in scope; the in-game road network may differ, and a few local roads are missing at this scale (e.g. AZ-95 through Lake Havasu City), where routes join the nearest road with a short straight link.',
    source: 'Natural Earth 1:10m (roads, admin-1 states, lakes)',
    sourceUrl: 'https://www.naturalearthdata.com',
    licence: 'Public domain',
    generator: 'scripts/map/build-map.mjs',
    projection: { type: 'equirectangular', lat0: LAT0, lon0: LON0, kmPerDegree: K },
    built: new Date().toISOString().slice(0, 10),
  },
  bounds,
  states,
  context,
  lakes,
  roads,
  cities: cityPts,
};
writeFileSync(join(root, 'data/map/ats-map.json'), `${JSON.stringify(out)}\n`);
const pts = roads.reduce((n, r) => n + r.pts.length, 0);
console.log(JSON.stringify({ states: states.length, context: context.length, lakes: lakes.length, roads: roads.length, roadPoints: pts, cities: cityPts.length, kb: Math.round(JSON.stringify(out).length / 1024), bounds }));
