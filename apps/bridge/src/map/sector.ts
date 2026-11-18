import type { GdCity } from '../../../../packages/core/src/gamedata.ts';
import type { MapCity, MapPoint } from '../../../../packages/core/src/regional-map.ts';
import type { GameFs } from '../scs/vfs.ts';
import { curve, rounded } from './geometry.ts';
import { placePrefab, readPrefabModels } from './prefab.ts';
import { readRoadDirections, type MapEdge } from './route.ts';

/**
 * ETS2 map sector reader (.base files, version 907), shared by the regional
 * importer and the whole-map importer. Items are found by scanning and are only
 * kept when they agree with the node table (each item must be linked from its
 * nodes), so a false match cannot produce a road.
 * Format knowledge: public documentation of the SCS map format (TruckLib,
 * truckermudgeon/maps); no code from those projects is used.
 */

const SECTOR_VERSION = 907;
const NODE_BYTES = 56;
const ITEM_START = 20;
const ITEM_FLAGS = 52;
const CITY_ITEM_BYTES = 81;
const ROAD_ITEM_BYTES = 269;
const ROAD_START_NODE = 249;
const ROAD_END_NODE = 257;
const ROAD_LENGTH = 265;
const ROAD = 3;
const PREFAB = 4;
const CITY = 12;
const HIDDEN_OR_SECRET_ROAD = 0x02010000;

export const SECTOR_PATTERN = /^sec([+-]\d{4})([+-]\d{4})\.base$/;

export interface MapNode {
  position: MapPoint;
  yaw: number;
  backward: bigint;
  forward: bigint;
  flags: number;
}

export interface MapRoad {
  uid: bigint;
  start: bigint;
  end: bigint;
  points: MapPoint[];
  length: number;
  /** Drivable lanes, both directions together (0 when the road look is unknown). */
  lanes: number;
}

export type MapLabel = MapCity & { area: number };

export interface ParsedSectors {
  nodes: Map<bigint, MapNode>;
  roads: Map<bigint, MapRoad>;
  /** Drivable lines inside prefabs (junctions, ramps, roundabouts), per prefab item. */
  junctions: Map<bigint, MapPoint[][]>;
  /** Directed, drivable connections: road sides and prefab lane links. */
  edges: MapEdge[];
  labels: Map<string, MapLabel>;
  sectors: number;
  /** Prefab coverage diagnostics. */
  stats: { prefabs: number; noDescriptor: number; notPlaced: number; noLinks: number; missingModels: Map<string, number>; roads: Record<string, number> };
}

export interface SectorFilter {
  /** Keep items touching these country ids (node flags); all when undefined. */
  countryIds?: Set<number>;
  /** Keep city labels for these cities; all known cities when undefined. */
  city?: (city: GdCity) => boolean;
}

function nodeSection(buffer: Buffer): { start: number; count: number } {
  let section: { start: number; count: number } | undefined;
  // The variable-sized item section is followed by the node count, the packed
  // node records, and a counted array of 64-bit visibility references.
  for (let offset = ITEM_START; offset + 8 <= buffer.length; offset++) {
    const count = buffer.readUInt32LE(offset);
    const start = offset + 4;
    const end = start + count * NODE_BYTES;
    if (count <= (section?.count ?? -1) || end + 4 > buffer.length) continue;
    if (end + 4 + 8 * buffer.readUInt32LE(end) !== buffer.length) continue;
    let valid = true;
    for (let node = start; node < end; node += NODE_BYTES) {
      const w = buffer.readFloatLE(node + 20);
      const x = buffer.readFloatLE(node + 24);
      const y = buffer.readFloatLE(node + 28);
      const z = buffer.readFloatLE(node + 32);
      if (buffer.readBigUInt64LE(node) === 0n || !(Math.abs(w * w + x * x + y * y + z * z - 1) < 0.03)) {
        valid = false;
        break;
      }
    }
    if (valid) section = { start, count };
  }
  if (!section || (!section.count && buffer.readUInt32LE(16))) throw new Error('No valid sector node table');
  return section;
}

/** SCS "token" ids (up to 12 chars of [0-9a-z_]) packed into 64 bits. */
export function token(value: bigint): string {
  const alphabet = '\0' + '0123456789abcdefghijklmnopqrstuvwxyz_';
  let result = '';
  while (value) {
    result += alphabet[Number(value % 38n)];
    value /= 38n;
  }
  return result;
}

export function countryIdOf(fs: GameFs, country: string): number | null {
  const id = fs.readText(`def/country/${country}.sui`)?.match(/\bcountry_id:\s*(\d+)/)?.[1];
  return id ? Number(id) : null;
}

/** Map sector file names ("sec+0012-0003.base") of the installed map, base game and DLCs. */
export function listSectors(fs: GameFs): string[] {
  return fs.list('map/europe').filter((name) => SECTOR_PATTERN.test(name));
}

export function parseSectors(fs: GameFs, names: string[], cities: GdCity[], filter: SectorFilter = {}): ParsedSectors {
  const { countryIds } = filter;
  const inCountry = (flags: number, shift: 8 | 16) => !countryIds || countryIds.has((flags >>> shift) & 255);
  const cityById = new Map(cities.map((city) => [city.id, city]));
  const nodes = new Map<bigint, MapNode>();
  const sectors: Array<{ buffer: Buffer; end: number }> = [];
  for (const name of names) {
    const path = `map/europe/${name}`;
    const buffer = fs.provider(path)?.archive.read(path);
    if (!buffer || buffer.length < 28 || buffer.readUInt32LE(0) !== SECTOR_VERSION) {
      throw new Error(`Unsupported ETS2 map sector: ${name}`);
    }
    const { start, count } = nodeSection(buffer);
    for (let offset = start; offset < start + count * NODE_BYTES; offset += NODE_BYTES) {
      nodes.set(buffer.readBigUInt64LE(offset), {
        position: [buffer.readInt32LE(offset + 8) / 256, buffer.readInt32LE(offset + 16) / 256],
        yaw: 2 * Math.atan2(-buffer.readFloatLE(offset + 28), buffer.readFloatLE(offset + 20)) - Math.PI / 2,
        backward: buffer.readBigUInt64LE(offset + 36),
        forward: buffer.readBigUInt64LE(offset + 44),
        flags: buffer.readUInt32LE(offset + 52),
      });
    }
    sectors.push({ buffer, end: start - 4 });
  }

  const roads = new Map<bigint, MapRoad>();
  const junctions = new Map<bigint, MapPoint[][]>();
  const edges: MapEdge[] = [];
  const readPrefab = readPrefabModels(fs);
  const roadDirections = readRoadDirections(fs);
  const labels = new Map<string, MapLabel>();
  const stats: ParsedSectors['stats'] = { prefabs: 0, noDescriptor: 0, notPlaced: 0, noLinks: 0, missingModels: new Map(), roads: {} };
  const count = (k: string) => { stats.roads[k] = (stats.roads[k] ?? 0) + 1; };
  for (const { buffer, end } of sectors) {
    for (let offset = ITEM_START; offset + CITY_ITEM_BYTES <= end; offset++) {
      const kind = buffer.readUInt32LE(offset);
      if (kind !== ROAD && kind !== CITY && kind !== PREFAB) continue;
      const uid = buffer.readBigUInt64LE(offset + 4);
      const flags = buffer.readUInt32LE(offset + ITEM_FLAGS);
      if (kind === PREFAB && !(flags & 0x00020020)) {
        const partCount = buffer.readUInt32LE(offset + 73);
        const countOffset = offset + 77 + partCount * 8;
        if (!uid || countOffset + 4 > end) continue;
        const count = buffer.readUInt32LE(countOffset);
        const firstNode = countOffset + 4;
        const connections = firstNode + count * 8;
        if (!count || count > 16 || connections + 4 > end) continue;
        const originOffset = connections + 12 + buffer.readUInt32LE(connections) * 8;
        if (originOffset + 2 > end) continue;
        const ids = Array.from({ length: count }, (_, index) => buffer.readBigUInt64LE(firstNode + index * 8));
        const anchors = ids.map((id) => nodes.get(id));
        if (!anchors.every((node): node is MapNode => node !== undefined && (node.backward === uid || node.forward === uid))) continue;
        if (!anchors.some((node) => inCountry(node.flags, 8) || inCountry(node.flags, 16))) continue;
        if (junctions.has(uid)) continue;
        stats.prefabs++;
        const model = token(buffer.readBigUInt64LE(offset + 57));
        const descriptor = readPrefab(model);
        if (!descriptor) {
          stats.noDescriptor++;
          stats.missingModels.set(model, (stats.missingModels.get(model) ?? 0) + 1);
          continue;
        }
        const placed = placePrefab(descriptor, buffer.readUInt16LE(originOffset), anchors);
        if (!placed) { stats.notPlaced++; continue; }
        if (!placed.links.length) stats.noLinks++;
        junctions.set(uid, placed.lines);
        for (const { from, to, points } of placed.links) edges.push({ item: uid, from: ids[from]!, to: ids[to]!, points, junction: true });
      }
      if (kind === ROAD && offset + ROAD_ITEM_BYTES <= end) {
        const start = buffer.readBigUInt64LE(offset + ROAD_START_NODE);
        const finish = buffer.readBigUInt64LE(offset + ROAD_END_NODE);
        const a = nodes.get(start);
        const b = nodes.get(finish);
        if (!uid || a?.forward !== uid || b?.backward !== uid || roads.has(uid)) continue;
        if (flags & HIDDEN_OR_SECRET_ROAD) { count(`flag_${(flags & HIDDEN_OR_SECRET_ROAD).toString(16)}`); continue; }
        if (!inCountry(a.flags, 8) && !inCountry(b.flags, 16)) continue;
        const length = buffer.readFloatLE(offset + ROAD_LENGTH);
        if (!(length > 0 && length <= 2000)) { count(length > 2000 ? 'over2km' : 'badLength'); continue; }
        count('kept');
        const points = curve(a, b, 20).map(rounded);
        const directions = roadDirections.get(token(buffer.readBigUInt64LE(offset + 61)));
        roads.set(uid, { uid, start, end: finish, points, length, lanes: directions?.lanes ?? 0 });
        if (!directions) count('unknownLook');
        // The 64-bit fields at +69/+77 are per-side overrides; a side with an
        // override is still drivable (skipping them split 18% of the network off).
        if (directions?.forward) edges.push({ item: uid, from: start, to: finish, points });
        if (directions?.backward) edges.push({ item: uid, from: finish, to: start, points: points.slice().reverse() });
      }
      if (kind === CITY && !(flags & 1)) {
        const node = nodes.get(buffer.readBigUInt64LE(offset + 73));
        if (!node || (node.forward !== uid && node.backward !== uid)) continue;
        const city = cityById.get(token(buffer.readBigUInt64LE(offset + 57)));
        if (!city || (filter.city && !filter.city(city))) continue;
        const area = buffer.readFloatLE(offset + 65) * buffer.readFloatLE(offset + 69);
        if (!(area > 0) || area <= (labels.get(city.id)?.area ?? 0)) continue;
        labels.set(city.id, { id: city.id, name: city.nameRo ?? city.name, country: city.country ?? '', position: node.position, area });
      }
    }
  }
  return { nodes, roads, junctions, edges, labels, sectors: sectors.length, stats };
}
