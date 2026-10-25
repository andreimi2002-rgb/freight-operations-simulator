// Map DLCs a job needs: the DLC of every state its route touches (both ends and the states
// it drives through). Pure; used by the route-states script, the generator and the tests.

export const MIN_KM = 5;
export const STEP_KM = 2; // long road segments are cut into pieces of at most this length

/** Ray-casting point-in-polygon test for one ring of [x, y] points. */
export function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** State code of a point (states: { code, rings }[]), or null outside every state. */
export function stateAt(p, states) {
  return states.find((s) => s.rings.some((r) => inRing(p, r)))?.code ?? null;
}

/**
 * States a path crosses, in order of first appearance: each segment is cut into pieces of at
 * most STEP_KM, each piece is given to the state of its midpoint, and a state counts when its
 * pieces add up to at least `minKm`.
 */
export function statesCrossed(points, states, minKm = MIN_KM) {
  const km = new Map();
  const order = [];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.ceil(len / STEP_KM));
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n;
      const s = stateAt([ax + (bx - ax) * f, ay + (by - ay) * f], states);
      if (!s) continue;
      if (!km.has(s)) { km.set(s, 0); order.push(s); }
      km.set(s, km.get(s) + len / n);
    }
  }
  return order.filter((s) => km.get(s) >= minKm);
}

/** Key of a city pair in route-states.json (alphabetical, the same both ways). */
export const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Map DLCs for a trip from city `from` to city `to`: the DLC of the two cities' states and of
 * every state in between. `stateDlc` maps a state code to its DLC id ('base' = none).
 */
export function mapDlcs(from, to, { cityState, stateDlc, via }) {
  const states = [cityState.get(from), cityState.get(to), ...(via[pairKey(from, to)] ?? [])];
  return [...new Set(states.map((s) => stateDlc[s]).filter((d) => d && d !== 'base'))].sort();
}
