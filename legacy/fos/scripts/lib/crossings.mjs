// Groups OSM border-control elements into crossings (pure; tested).
const R = 6371000;
const rad = d => d * Math.PI / 180;
export function distanceM(a, b) {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Public place name of a crossing (never a company): the local name, else the English one.
const nameOf = tags => String(tags["name"] || tags["name:en"] || tags["int_name"] || "").replace(/\s+/g, " ").trim() || null;

// points: [{ id, lat, lon, tags }] -> [{ lat, lon, name, osm: [ids] }], single-linkage within `radiusM`.
export function clusterCrossings(points, radiusM = 500) {
  const parent = points.map((_, i) => i);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (Math.abs(points[i].lat - points[j].lat) > 0.01) continue; // quick reject (~1 km)
      if (distanceM(points[i], points[j]) <= radiusM) parent[find(i)] = find(j);
    }
  }
  const groups = new Map();
  points.forEach((p, i) => { const root = find(i); groups.set(root, [...(groups.get(root) || []), p]); });
  return [...groups.values()].map(members => {
    const names = members.map(m => nameOf(m.tags)).filter(Boolean);
    const counts = names.reduce((acc, n) => acc.set(n, (acc.get(n) || 0) + 1), new Map());
    const name = [...counts].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0]?.[0] ?? null;
    const lat = members.reduce((s, m) => s + m.lat, 0) / members.length;
    const lon = members.reduce((s, m) => s + m.lon, 0) / members.length;
    return { lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5, name, osm: members.map(m => m.id).sort() };
  }).sort((a, b) => a.lat - b.lat || a.lon - b.lon);
}
