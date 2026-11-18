import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { MapCity, MapPoint } from '../../../../packages/core/src/regional-map.ts';
import { extractGameData } from '../gamedata/extract.ts';
import { loadGameData } from '../gamedata/store.ts';
import { GameFs } from '../scs/vfs.ts';
import { listSectors, parseSectors } from './sector.ts';

/**
 * Builds the whole ETS2 map (every installed sector, base game and DLCs) into
 * files the bridge serves by area:
 *   meta.json            bounds, tile list, all city labels
 *   overview.json.gz     simplified multi-lane roads for the zoomed-out view
 *   tiles/<x>_<z>.json.gz full-detail roads and junction lines per 8 km tile
 *   router.bin           compact directed graph for routing
 * Runs in a worker thread; the files stay on this PC (data/generated, git-ignored).
 */

export const WORLD_FORMAT = 1;
export const TILE_SIZE = 8192;
/** Roads with at least this many drivable lanes (both directions) go into the overview. */
const OVERVIEW_MIN_LANES = 4;

export interface WorldMeta {
  format: number;
  game: 'ets2';
  builtAt: string;
  buildMs: number;
  archivesStamp: number;
  sectors: number;
  tileSize: number;
  bounds: [minX: number, minZ: number, maxX: number, maxZ: number];
  tiles: string[];
  cities: MapCity[];
  counts: { roads: number; junctions: number; edges: number; graphNodes: number };
}

/** Flat integer polyline: [x0, z0, x1, z1, ...] in metres. */
export type FlatLine = number[];

export interface WorldTile {
  key: string;
  roads: FlatLine[];
  /** Index into roads of the multi-lane ones (drawn wider). */
  major: number[];
  junctions: FlatLine[];
}

export function tileKey(x: number, z: number): string {
  return `${Math.floor(x / TILE_SIZE)}_${Math.floor(z / TILE_SIZE)}`;
}

/** Douglas-Peucker simplification. */
export function simplify(points: MapPoint[], tolerance: number): MapPoint[] {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, az] = points[a]!;
    const [bx, bz] = points[b]!;
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, pz] = points[i]!;
      const d = len ? Math.abs(dz * px - dx * pz + bx * az - bz * ax) / len : Math.hypot(px - ax, pz - az);
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > tolerance && at > 0) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const flat = (points: MapPoint[]): FlatLine => points.flatMap(([x, z]) => [Math.round(x), Math.round(z)]);

export function newestArchive(dir: string): number {
  let t = 0;
  for (const f of readdirSync(dir)) if (f.toLowerCase().endsWith('.scs')) t = Math.max(t, statSync(join(dir, f)).mtimeMs);
  return t;
}

export function buildWorldFiles(install: string, outDir: string, log: (msg: string) => void = () => undefined): WorldMeta {
  const t0 = Date.now();
  const gd = loadGameData('ets2') ?? extractGameData('ets2', install).data;
  const fs = new GameFs(install);
  let parsed;
  try {
    parsed = parseSectors(fs, listSectors(fs), gd.cities);
  } finally {
    fs.close();
  }
  log(`parsed ${parsed.sectors} sectors in ${Date.now() - t0} ms`);

  // --- Tiles and overview -------------------------------------------------
  const tiles = new Map<string, WorldTile>();
  const tileFor = (p: MapPoint) => {
    const key = tileKey(p[0], p[1]);
    let t = tiles.get(key);
    if (!t) tiles.set(key, (t = { key, roads: [], major: [], junctions: [] }));
    return t;
  };
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  const overview: FlatLine[] = [];
  for (const road of parsed.roads.values()) {
    const pts = simplify(road.points, 0.75);
    const mid = pts[Math.floor(pts.length / 2)]!;
    const t = tileFor(mid);
    if (road.lanes >= OVERVIEW_MIN_LANES) t.major.push(t.roads.length);
    t.roads.push(flat(pts));
    for (const [x, z] of pts) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    if (road.lanes >= OVERVIEW_MIN_LANES) overview.push(flat(simplify(road.points, 40)));
  }
  for (const lines of parsed.junctions.values()) {
    for (const line of lines) tileFor(line[0]!).junctions.push(flat(line));
  }

  // --- Routing graph --------------------------------------------------------
  const nodeIndex = new Map<bigint, number>();
  const nodePos: number[] = [];
  const indexOf = (id: bigint, p: MapPoint) => {
    let i = nodeIndex.get(id);
    if (i === undefined) {
      i = nodeIndex.size;
      nodeIndex.set(id, i);
      nodePos.push(p[0], p[1]);
    }
    return i;
  };
  const itemIndex = new Map<bigint, number>();
  const E = parsed.edges.length;
  const from = new Int32Array(E);
  const to = new Int32Array(E);
  const item = new Int32Array(E);
  const cost = new Float32Array(E);
  const junction = new Uint8Array(E);
  const ptsOffset = new Int32Array(E + 1);
  const pts: number[] = [];
  parsed.edges.forEach((e, i) => {
    from[i] = indexOf(e.from, e.points[0]!);
    to[i] = indexOf(e.to, e.points.at(-1)!);
    let it = itemIndex.get(e.item);
    if (it === undefined) itemIndex.set(e.item, (it = itemIndex.size));
    item[i] = it;
    let metres = 0;
    for (let k = 1; k < e.points.length; k++) metres += Math.hypot(e.points[k]![0] - e.points[k - 1]![0], e.points[k]![1] - e.points[k - 1]![1]);
    cost[i] = metres;
    junction[i] = e.junction ? 1 : 0;
    ptsOffset[i] = pts.length;
    for (const [x, z] of simplify(e.points, 0.75)) pts.push(x, z);
  });
  ptsOffset[E] = pts.length;
  const router = encodeRouter({ nodePos: Float64Array.from(nodePos), from, to, item, cost, junction, ptsOffset, pts: Float32Array.from(pts) });
  log(`graph: ${nodeIndex.size} nodes, ${E} edges`);

  // --- Write ----------------------------------------------------------------
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, 'tiles'), { recursive: true });
  for (const t of tiles.values()) writeFileSync(join(outDir, 'tiles', `${t.key}.json.gz`), gzipSync(JSON.stringify(t)));
  writeFileSync(join(outDir, 'overview.json.gz'), gzipSync(JSON.stringify({ roads: overview })));
  writeFileSync(join(outDir, 'router.bin'), router);
  const meta: WorldMeta = {
    format: WORLD_FORMAT,
    game: 'ets2',
    builtAt: new Date().toISOString(),
    buildMs: Date.now() - t0,
    archivesStamp: newestArchive(install),
    sectors: parsed.sectors,
    tileSize: TILE_SIZE,
    bounds: [Math.floor(minX), Math.floor(minZ), Math.ceil(maxX), Math.ceil(maxZ)],
    tiles: [...tiles.keys()].sort(),
    cities: [...parsed.labels.values()].map(({ area: _a, ...c }) => c),
    counts: { roads: parsed.roads.size, junctions: parsed.junctions.size, edges: E, graphNodes: nodeIndex.size },
  };
  writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta));
  return meta;
}

// --- Router binary: JSON header + 4-byte aligned typed arrays ----------------

export interface RouterArrays {
  nodePos: Float64Array;
  from: Int32Array;
  to: Int32Array;
  item: Int32Array;
  cost: Float32Array;
  junction: Uint8Array;
  ptsOffset: Int32Array;
  pts: Float32Array;
}

const FIELDS = ['nodePos', 'from', 'to', 'item', 'cost', 'junction', 'ptsOffset', 'pts'] as const;

function encodeRouter(a: RouterArrays): Buffer {
  const parts: Buffer[] = [];
  const header: Record<string, number> = {};
  for (const f of FIELDS) {
    const arr = a[f];
    header[f] = arr.length;
    const b = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    parts.push(b, Buffer.alloc((8 - (b.length % 8)) % 8));
  }
  const h = Buffer.from(JSON.stringify(header));
  const hl = Buffer.alloc(4);
  hl.writeUInt32LE(h.length);
  const pad = Buffer.alloc((8 - ((4 + h.length) % 8)) % 8);
  return Buffer.concat([hl, h, pad, ...parts]);
}

export function decodeRouter(buf: Buffer): RouterArrays {
  const hl = buf.readUInt32LE(0);
  const header = JSON.parse(buf.toString('utf8', 4, 4 + hl)) as Record<string, number>;
  let off = 4 + hl + ((8 - ((4 + hl) % 8)) % 8);
  const copy = new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
  const take = <T>(Ctor: { new (b: ArrayBuffer, o: number, n: number): T; BYTES_PER_ELEMENT: number }, n: number): T => {
    const out = new Ctor(copy.buffer as ArrayBuffer, off, n);
    off += n * Ctor.BYTES_PER_ELEMENT;
    off += (8 - (off % 8)) % 8;
    return out;
  };
  return {
    nodePos: take(Float64Array, header.nodePos!),
    from: take(Int32Array, header.from!),
    to: take(Int32Array, header.to!),
    item: take(Int32Array, header.item!),
    cost: take(Float32Array, header.cost!),
    junction: take(Uint8Array, header.junction!),
    ptsOffset: take(Int32Array, header.ptsOffset!),
    pts: take(Float32Array, header.pts!),
  };
}
