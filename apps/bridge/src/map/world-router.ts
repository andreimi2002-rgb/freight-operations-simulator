import type { MapPoint, RoutePlan } from '../../../../packages/core/src/regional-map.ts';
import { describeRoute, type MapEdge } from './route.ts';
import type { RouterArrays } from './world-build.ts';

/**
 * Routing on the whole ETS2 map: A* over directed edges (road sides and prefab
 * lane links), with the same rules as the regional router: no proximity
 * shortcuts, and no turning back onto the map item you arrived on.
 */

const CELL = 256;

class MinHeap {
  private keys: number[] = [];
  private vals: number[] = [];
  get size(): number {
    return this.keys.length;
  }
  push(key: number, val: number): void {
    const k = this.keys;
    const v = this.vals;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p]! <= key) break;
      k[i] = k[p]!;
      v[i] = v[p]!;
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }
  pop(): number {
    const k = this.keys;
    const v = this.vals;
    const top = v[0]!;
    const lastK = k.pop()!;
    const lastV = v.pop()!;
    if (k.length) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= k.length) break;
        const r = l + 1;
        const c = r < k.length && k[r]! < k[l]! ? r : l;
        if (k[c]! >= lastK) break;
        k[i] = k[c]!;
        v[i] = v[c]!;
        i = c;
      }
      k[i] = lastK;
      v[i] = lastV;
    }
    return top;
  }
}

export class WorldRouter {
  private readonly a: RouterArrays;
  private readonly outStart: Int32Array;
  private readonly outEdges: Int32Array;
  /** Spatial index: cell -> edge indices whose geometry touches the cell. */
  private readonly grid = new Map<number, number[]>();

  constructor(arrays: RouterArrays) {
    this.a = arrays;
    const nodes = arrays.nodePos.length / 2;
    const E = arrays.from.length;
    const counts = new Int32Array(nodes + 1);
    for (let e = 0; e < E; e++) counts[arrays.from[e]! + 1]!++;
    for (let n = 0; n < nodes; n++) counts[n + 1]! += counts[n]!;
    this.outStart = counts;
    this.outEdges = new Int32Array(E);
    const fill = counts.slice(0, nodes);
    for (let e = 0; e < E; e++) this.outEdges[fill[arrays.from[e]!]!++] = e;
    for (let e = 0; e < E; e++) {
      const cells = new Set<number>();
      for (let p = arrays.ptsOffset[e]!; p < arrays.ptsOffset[e + 1]!; p += 2) cells.add(this.cell(arrays.pts[p]!, arrays.pts[p + 1]!));
      for (const c of cells) {
        const list = this.grid.get(c);
        if (list) list.push(e);
        else this.grid.set(c, [e]);
      }
    }
  }

  private cell(x: number, z: number): number {
    return (Math.floor(x / CELL) + 32768) * 65536 + (Math.floor(z / CELL) + 32768);
  }

  private edgesNear(x: number, z: number, radius: number): number[] {
    const out = new Set<number>();
    const r = Math.ceil(radius / CELL);
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
      for (const e of this.grid.get((cx + i + 32768) * 65536 + (cz + j + 32768)) ?? []) out.add(e);
    }
    return [...out];
  }

  private points(e: number): MapPoint[] {
    const out: MapPoint[] = [];
    for (let p = this.a.ptsOffset[e]!; p < this.a.ptsOffset[e + 1]!; p += 2) out.push([this.a.pts[p]!, this.a.pts[p + 1]!]);
    return out;
  }

  get stats(): { nodes: number; edges: number } {
    return { nodes: this.a.nodePos.length / 2, edges: this.a.from.length };
  }

  /**
   * Route from the truck (position + heading) to a destination point (a city).
   * Returns null when the road network does not connect them (e.g. a ferry is needed).
   */
  route(start: MapPoint, headingDeg: number | null, goal: MapPoint, goalRadius = 600): RoutePlan | null {
    const { a } = this;
    // Goal nodes: graph nodes near the destination.
    const goalNodes = new Set<number>();
    for (const radius of [goalRadius, goalRadius * 2.5]) {
      for (const e of this.edgesNear(goal[0], goal[1], radius)) {
        const n = a.to[e]!;
        if (Math.hypot(a.nodePos[2 * n]! - goal[0], a.nodePos[2 * n + 1]! - goal[1]) <= radius) goalNodes.add(n);
      }
      if (goalNodes.size) break;
    }
    if (!goalNodes.size) return null;

    // Start states: edges under the truck, facing its heading.
    const hx = headingDeg === null ? 0 : Math.sin((headingDeg * Math.PI) / 180);
    const hz = headingDeg === null ? 0 : -Math.cos((headingDeg * Math.PI) / 180);
    const starts: Array<{ e: number; seg: number; projected: MapPoint; cost: number; score: number }> = [];
    // With a heading (the truck), it is on the road: snap tightly. Without one
    // (a city centre), the nearest road can be a few hundred metres away.
    const maxGap = headingDeg === null ? 600 : 45;
    for (const e of this.edgesNear(start[0], start[1], maxGap + 15)) {
      const pts = this.points(e);
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1]!;
        const [bx, bz] = pts[i]!;
        const dx = bx - ax;
        const dz = bz - az;
        const len = Math.hypot(dx, dz);
        if (!len) continue;
        const align = headingDeg === null ? 1 : (dx * hx + dz * hz) / len;
        if (align < 0.35) continue;
        const along = Math.max(0, Math.min(len, ((start[0] - ax) * dx + (start[1] - az) * dz) / len));
        const projected: MapPoint = [ax + (dx * along) / len, az + (dz * along) / len];
        const gap = Math.hypot(start[0] - projected[0], start[1] - projected[1]);
        if (gap > maxGap) continue;
        let rest = len - along;
        for (let k = i + 1; k < pts.length; k++) rest += Math.hypot(pts[k]![0] - pts[k - 1]![0], pts[k]![1] - pts[k - 1]![1]);
        starts.push({ e, seg: i, projected, cost: rest, score: gap + 12 * (1 - align) });
      }
    }
    if (!starts.length) return null;
    starts.sort((x, y) => x.score - y.score);
    const limit = starts[0]!.score + 8;

    const E = a.from.length;
    const g = new Float64Array(E).fill(Infinity);
    const prev = new Int32Array(E).fill(-1);
    const startOf = new Map<number, (typeof starts)[number]>();
    const heap = new MinHeap();
    const h = (n: number) => Math.max(0, Math.hypot(a.nodePos[2 * n]! - goal[0], a.nodePos[2 * n + 1]! - goal[1]) - goalRadius * 2.5);
    // On the road with a heading: only the few edges that match it. From a city
    // centre: many nearby edges, since the closest ones can be dead ends (car parks).
    const chosen = headingDeg === null ? starts.slice(0, 60) : starts.filter((x) => x.score <= limit).slice(0, 12);
    for (const s of chosen) {
      const c = s.cost + 3 * s.score;
      if (c < g[s.e]!) {
        g[s.e] = c;
        startOf.set(s.e, s);
        heap.push(c + h(a.to[s.e]!), s.e);
      }
    }
    let found = -1;
    let expanded = 0;
    while (heap.size) {
      const e = heap.pop();
      if (++expanded > 2_000_000) break;
      const n = a.to[e]!;
      if (goalNodes.has(n)) { found = e; break; }
      const ge = g[e]!;
      for (let k = this.outStart[n]!; k < this.outStart[n + 1]!; k++) {
        const o = this.outEdges[k]!;
        if (a.item[o] === a.item[e]) continue;
        const c = ge + a.cost[o]!;
        if (c < g[o]!) {
          g[o] = c;
          prev[o] = e;
          heap.push(c + h(a.to[o]!), o);
        }
      }
    }
    if (found < 0) return null;
    const chain: number[] = [];
    for (let e = found; e >= 0; e = prev[e]!) chain.push(e);
    chain.reverse();
    const edges: MapEdge[] = chain.map((e, i) => {
      let points = this.points(e);
      const s = i === 0 ? startOf.get(e) : undefined;
      if (s) points = [s.projected, ...points.slice(s.seg)];
      return { item: BigInt(a.item[e]!), from: BigInt(a.from[e]!), to: BigInt(a.to[e]!), points, ...(a.junction[e] ? { junction: true as const } : {}) };
    });
    return describeRoute(edges);
  }
}
