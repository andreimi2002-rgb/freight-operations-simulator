// Splits a route by country and finds where it crosses borders (pure; tested).
// Geometry: array of lines of [lon, lat]. Borders: { countries: { XX: { polygons: [ [ring, ...holes] ] } } }
// (Natural Earth 1:10m, simplified; accurate to a few kilometres).
const R = 6371000;
const rad = d => d * Math.PI / 180;
export function haversineM(a, b) {
  const h = Math.sin(rad(b[1] - a[1]) / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Bounding boxes first, so most points are rejected quickly.
export function prepareBorders(borders) {
  const countries = Object.entries(borders.countries).map(([code, country]) => ({
    code,
    polygons: country.polygons.map(rings => {
      const box = rings[0].reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
      return { box, rings };
    }),
  }));
  return { countries };
}

export function countryAt(point, prepared, hint = null) {
  const [x, y] = point;
  const inside = country => country.polygons.some(({ box, rings }) =>
    x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3] && inRing(x, y, rings[0]) && !rings.slice(1).some(hole => inRing(x, y, hole)));
  if (hint) { const known = prepared.countries.find(c => c.code === hint); if (known && inside(known)) return hint; }
  return prepared.countries.find(inside)?.code ?? null;
}

// The point where the segment a -> b leaves country `from` (bisection, ~1 m after 30 steps on a 100 km segment).
function boundary(a, b, from, prepared) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i += 1) {
    const mid = (lo + hi) / 2;
    const p = [a[0] + (b[0] - a[0]) * mid, a[1] + (b[1] - a[1]) * mid];
    if (countryAt(p, prepared, from) === from) lo = mid; else hi = mid;
  }
  const t = (lo + hi) / 2;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

// -> { lengthM, byCountry: [{ country, lengthM }] (order of first appearance), crossings: [{ from, to, lon, lat }], unassignedM }
// Vertices outside every polygon (sea, a gap in the simplified borders) take the country of the
// previous vertex (or of the next known one at the start), so a short gap never invents a crossing.
// Long segments are subdivided (at most MAX_STEP_M apart) so that a sparse route cannot jump over a narrow country.
const MAX_STEP_M = 2000;
function densify(points) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1], b = points[i];
    const steps = Math.min(2000, Math.ceil(haversineM(a, b) / MAX_STEP_M));
    for (let k = 1; k < steps; k += 1) out.push([a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps]);
    out.push(b);
  }
  return out;
}

export function splitRoute(geometry, prepared) {
  const flat = (geometry || []).flat().filter(p => Array.isArray(p) && p.length >= 2);
  if (flat.length < 2) return null;
  const points = densify(flat);
  if (points.length < 2) return null;
  const raw = [];
  let hint = null;
  for (const p of points) { const c = countryAt(p, prepared, hint); raw.push(c); if (c) hint = c; }
  if (!raw.some(Boolean)) return null;
  const countries = [...raw];
  const firstKnown = countries.find(Boolean);
  let current = firstKnown;
  const unassigned = new Array(points.length).fill(false);
  for (let i = 0; i < countries.length; i += 1) { if (countries[i]) current = countries[i]; else { countries[i] = current; unassigned[i] = true; } }

  const lengths = new Map();
  const add = (country, m) => lengths.set(country, (lengths.get(country) || 0) + m);
  const crossings = [];
  let unassignedM = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1], b = points[i], ca = countries[i - 1], cb = countries[i];
    const seg = haversineM(a, b);
    if (unassigned[i] || unassigned[i - 1]) unassignedM += seg;
    if (ca === cb) { add(ca, seg); continue; }
    const x = boundary(a, b, ca, prepared);
    const first = haversineM(a, x);
    add(ca, first);
    add(cb, Math.max(0, seg - first));
    crossings.push({ from: ca, to: cb, lon: x[0], lat: x[1] });
  }
  const byCountry = [];
  const seen = new Set();
  for (const c of countries) if (!seen.has(c)) { seen.add(c); byCountry.push({ country: c, lengthM: lengths.get(c) || 0 }); }
  return { lengthM: [...lengths.values()].reduce((s, v) => s + v, 0), byCountry, crossings, unassignedM };
}

// Provider distance split in proportion to the geometry (the geometry is sampled, so its own
// length is slightly short). Kilometres are rounded to one decimal and corrected to add up exactly.
export function distancesByCountry(split, routeKm) {
  const total = split.byCountry.reduce((s, c) => s + c.lengthM, 0);
  if (!(total > 0) || !(routeKm > 0)) return null;
  const rows = split.byCountry.map(c => ({ code: c.country, share: c.lengthM / total, km: Math.round(c.lengthM / total * routeKm * 10) / 10 }));
  const diff = Math.round((routeKm - rows.reduce((s, r) => s + r.km, 0)) * 10) / 10;
  if (diff !== 0) { const biggest = rows.reduce((a, b) => (b.km > a.km ? b : a)); biggest.km = Math.round((biggest.km + diff) * 10) / 10; }
  return rows;
}

// The nearest known crossing of the two countries within maxKm of the point where the route crosses.
export function findCrossing(point, from, to, crossings, maxKm = 5) {
  let best = null;
  for (const c of crossings) {
    if (c.country !== from && c.country !== to) continue;
    const d = haversineM([point.lon, point.lat], [c.lon, c.lat]);
    if (d <= maxKm * 1000 && (!best || d < best.distanceM)) best = { ...c, distanceM: Math.round(d) };
  }
  return best;
}

export const borderRegime = (from, to, schengenMembers) => (schengenMembers.includes(from) && schengenMembers.includes(to) ? "internal" : "external");
