import { gzipSync } from 'node:zlib';
import type { GdCity } from '../../../../packages/core/src/gamedata.ts';
import type { MapPoint, RegionalMap, RoutePlan } from '../../../../packages/core/src/regional-map.ts';
import { extractGameData } from '../gamedata/extract.ts';
import { findInstall, loadGameData } from '../gamedata/store.ts';
import { GameFs } from '../scs/vfs.ts';
import { describeRoute, routeBetweenCities, type MapEdge } from './route.ts';
import { countryIdOf, listSectors, parseSectors, SECTOR_PATTERN } from './sector.ts';

interface Road {
  start: bigint;
  end: bigint;
  points: MapPoint[];
  length: number;
}

function demoRoute(roads: Road[], city: MapPoint): MapPoint[] | null {
  const byNode = new Map<bigint, Road[]>();
  for (const road of roads) {
    for (const node of [road.start, road.end]) {
      const connected = byNode.get(node);
      if (connected) connected.push(road);
      else byNode.set(node, [road]);
    }
  }
  const nearCity = ([x, z]: MapPoint) => Math.hypot(x - city[0], z - city[1]) <= 1800;
  const visited = new Set<Road>();
  let best: MapPoint[] | null = null;
  let bestLength = 0;
  for (const road of roads) {
    if (visited.has(road) || !road.points.some(nearCity)) continue;
    visited.add(road);
    let length = road.length;
    const extend = (start: bigint): MapPoint[] => {
      const points: MapPoint[] = [];
      let node = start;
      while (byNode.get(node)?.length === 2) {
        const next = byNode.get(node)!.find((candidate) => !visited.has(candidate));
        if (!next) break;
        visited.add(next);
        const forward = node === next.start;
        const ordered = forward ? next.points : next.points.slice().reverse();
        points.push(...ordered.slice(1));
        length += next.length;
        node = forward ? next.end : next.start;
      }
      return points;
    };
    const before = extend(road.start);
    const after = extend(road.end);
    if (length > bestLength) {
      bestLength = length;
      best = [...before.reverse(), ...road.points, ...after];
    }
  }
  if (!best || bestLength < 300) return null;
  const distanceToCity = ([x, z]: MapPoint) => Math.hypot(x - city[0], z - city[1]);
  return distanceToCity(best[0]!) <= distanceToCity(best.at(-1)!) ? best : best.reverse();
}

function extractRegionalMap(fs: GameFs, cities: GdCity[]): { map: RegionalMap; edges: MapEdge[] } {
  const blackSea = fs.listWithSource('map/europe').flatMap(({ dlc, name }): MapPoint[] => {
    const match = dlc === 'dlc_balkan_e' && SECTOR_PATTERN.exec(name);
    return match ? [[Number(match[1]), Number(match[2])]] : [];
  });
  if (!blackSea.length) throw new Error('Road to the Black Sea map sectors unavailable');
  const neighbors = new Set<string>();
  for (const [x, z] of blackSea) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) neighbors.add(`${x + dx}:${z + dz}`);
    }
  }
  const sections = listSectors(fs).filter((name) => {
    const match = SECTOR_PATTERN.exec(name)!;
    return neighbors.has(`${Number(match[1])}:${Number(match[2])}`);
  });
  const countryIds = new Set(['romania', 'bulgaria'].map((country) => {
    const id = countryIdOf(fs, country);
    if (id === null) throw new Error(`Country definition unavailable: ${country}`);
    return id;
  }));
  const parsed = parseSectors(fs, sections, cities, {
    countryIds,
    city: (city) => city.country === 'romania' || city.country === 'bulgaria',
  });
  const { roads, edges, labels } = parsed;
  const junctions = new Map([...parsed.junctions].filter(([, lines]) => lines.length));
  if (!roads.size || new Set([...labels.values()].map((city) => city.country)).size !== 2) {
    throw new Error('ETS2 regional map data is incomplete');
  }
  const segments = [...roads.values()];
  const brasov = labels.get('brasov');
  const bucharest = labels.get('bucuresti');
  const ruse = labels.get('ruse');
  const intercity = brasov && bucharest && ruse
    ? routeBetweenCities(edges, brasov.position, bucharest.position, ruse.position)
    : null;
  const regionalDemo = intercity ? describeRoute(intercity) : null;
  return { edges, map: {
    roads: segments.map((road) => road.points),
    junctions: [...junctions.values()].flat().concat(intercity?.filter((edge) => edge.junction).map((edge) => edge.points) ?? []),
    cities: [...labels.values()].map(({ area: _area, ...city }) => city),
    demoRoute: regionalDemo?.points ?? (brasov ? demoRoute(segments, brasov.position) : null),
    ...(regionalDemo ? { demoDestination: 'ruse' as const, demoTurns: regionalDemo.turns } : {}),
  } };
}

let cachedData: ReturnType<typeof extractRegionalMap> | null = null;
let cachedMap: Buffer | null = null;

export function loadRegionalMap(): RegionalMap | null {
  if (cachedData) return cachedData.map;
  const install = findInstall('ets2');
  if (!install) return null;
  const fs = new GameFs(install);
  try {
    const data = loadGameData('ets2') ?? extractGameData('ets2', install).data;
    cachedData = extractRegionalMap(fs, data.cities);
    return cachedData.map;
  } finally {
    fs.close();
  }
}

export function routeToCity(destinationId: string, position: MapPoint, headingDeg: number): RoutePlan | null {
  const map = loadRegionalMap();
  const destination = map?.cities.find((city) => city.id === destinationId);
  if (!destination || !cachedData) return null;
  const path = routeBetweenCities(cachedData.edges, position, null, destination.position, headingDeg);
  if (!path?.length) return null;
  return describeRoute(path);
}

export function regionalMapGzip(): Buffer | null {
  if (cachedMap) return cachedMap;
  const map = loadRegionalMap();
  if (!map) return null;
  cachedMap = gzipSync(JSON.stringify(map));
  return cachedMap;
}
