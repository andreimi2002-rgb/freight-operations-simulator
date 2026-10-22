// Shortest paths on the map's road layer (projected x/y in km), for drawing a job's route.
// The graph joins road vertices that lie within SNAP_KM of each other, so separate road
// pieces that meet become connected. Pure; used in the browser and in the tests.

export const SNAP_KM = 2;
export const END_SNAP_KM = 12;

export function buildRoadGraph(roads) {
  const nodes = [];
  const cell = new Map();
  const key = (x, y) => `${Math.floor(x / SNAP_KM)},${Math.floor(y / SNAP_KM)}`;
  const nodeAt = ([x, y]) => {
    const cx = Math.floor(x / SNAP_KM);
    const cy = Math.floor(y / SNAP_KM);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const i of cell.get(`${cx + dx},${cy + dy}`) ?? []) {
        const n = nodes[i];
        if ((n.x - x) ** 2 + (n.y - y) ** 2 <= SNAP_KM * SNAP_KM) return i;
      }
    }
    nodes.push({ x, y, edges: [] });
    const k = key(x, y);
    if (!cell.has(k)) cell.set(k, []);
    cell.get(k).push(nodes.length - 1);
    return nodes.length - 1;
  };
  roads.forEach((r, ri) => {
    let prev = null;
    for (const p of r.pts) {
      const i = nodeAt(p);
      if (prev !== null && prev !== i) {
        const a = nodes[prev];
        const b = nodes[i];
        const w = Math.hypot(a.x - b.x, a.y - b.y);
        a.edges.push([i, w, ri]);
        b.edges.push([prev, w, ri]);
      }
      prev = i;
    }
  });
  // Road ends that stop short of another road (gaps in the source data) are joined to the
  // nearest node of a different road within END_SNAP_KM.
  const ends = new Set();
  roads.forEach((r) => { ends.add(nodeAt(r.pts[0])); ends.add(nodeAt(r.pts[r.pts.length - 1])); });
  for (const i of ends) {
    const n = nodes[i];
    const own = new Set(n.edges.map((e) => e[2]));
    let best = -1;
    let bd = END_SNAP_KM * END_SNAP_KM;
    const cx = Math.floor(n.x / SNAP_KM);
    const cy = Math.floor(n.y / SNAP_KM);
    const R = Math.ceil(END_SNAP_KM / SNAP_KM);
    for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
      for (const j of cell.get(`${cx + dx},${cy + dy}`) ?? []) {
        if (j === i) continue;
        const m = nodes[j];
        if (m.edges.every((e) => own.has(e[2]))) continue;
        const d = (m.x - n.x) ** 2 + (m.y - n.y) ** 2;
        if (d < bd) { bd = d; best = j; }
      }
    }
    if (best >= 0) {
      const w = Math.sqrt(bd);
      n.edges.push([best, w, -1]);
      nodes[best].edges.push([i, w, -1]);
    }
  }
  return { nodes, cell };
}

/** Nearest graph node to a point. */
export function nearestNode(graph, [x, y]) {
  let best = -1;
  let bd = Infinity;
  graph.nodes.forEach((n, i) => {
    if (!n.edges.length) return;
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  return { node: best, km: Math.sqrt(bd) };
}

/** Dijkstra with a binary heap. Returns { km, points: [[x,y]], refs: [roadIndex] } or null. */
export function shortestPath(graph, from, to) {
  const n = graph.nodes.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const via = new Int32Array(n).fill(-1);
  const heap = [[0, from]];
  dist[from] = 0;
  const push = (item) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, u] = pop();
    if (u === to) break;
    if (d > dist[u]) continue;
    for (const [v, w, ri] of graph.nodes[u].edges) {
      const nd = d + w;
      if (nd < dist[v]) { dist[v] = nd; prev[v] = u; via[v] = ri; push([nd, v]); }
    }
  }
  if (!Number.isFinite(dist[to])) return null;
  const points = [];
  const refs = new Set();
  for (let u = to; u !== -1; u = prev[u]) {
    points.push([graph.nodes[u].x, graph.nodes[u].y]);
    if (via[u] >= 0) refs.add(via[u]);
  }
  return { km: dist[to], points: points.reverse(), roads: [...refs] };
}

/** Route between two map points (city positions): path plus the short links to the road. */
export function routeBetween(graph, a, b) {
  const s = nearestNode(graph, a);
  const t = nearestNode(graph, b);
  if (s.node < 0 || t.node < 0) return null;
  const path = shortestPath(graph, s.node, t.node);
  if (!path) return null;
  return { km: path.km + s.km + t.km, points: [a, ...path.points, b], roads: path.roads };
}
