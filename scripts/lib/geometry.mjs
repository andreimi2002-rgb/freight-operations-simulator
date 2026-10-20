// Small geometry helpers shared by the data scripts and the engine tests.
// Coordinates are [lon, lat] in degrees.

// Douglas-Peucker simplification of a ring or line (tolerance in degrees).
export function simplify(points, tolerance) {
  if (points.length <= 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxDist = 0, index = -1;
    for (let i = a + 1; i < b; i += 1) {
      const d = distanceToSegment(points[i], points[a], points[b]);
      if (d > maxDist) { maxDist = d; index = i; }
    }
    if (maxDist > tolerance && index > 0) { keep[index] = 1; stack.push([a, index], [index, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

function distanceToSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (!dx && !dy) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export const ringBox = ring => ring.reduce((box, [x, y]) => [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
export const boxesTouch = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
export const expandBox = (box, d) => [box[0] - d, box[1] - d, box[2] + d, box[3] + d];
export const round = (n, digits) => Math.round(n * 10 ** digits) / 10 ** digits;

// Distance in metres from a point to the nearest edge of any ring (equirectangular approximation, fine below ~100 km).
export function distanceToRingsM([lon, lat], rings) {
  const k = Math.cos(lat * Math.PI / 180);
  const toM = ([x, y]) => [(x - lon) * 111320 * k, (y - lat) * 110540];
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 1; i < ring.length; i += 1) {
      const [ax, ay] = toM(ring[i - 1]), [bx, by] = toM(ring[i]);
      const dx = bx - ax, dy = by - ay;
      const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return best;
}
