import type { MapPoint, RoutePlan } from '../../../../packages/core/src/regional-map.ts';
import { parseSii, sii } from '../scs/sii.ts';
import type { GameFs } from '../scs/vfs.ts';
import { distance } from './geometry.ts';

export interface MapEdge {
  item: bigint;
  from: bigint;
  to: bigint;
  points: MapPoint[];
  junction?: true;
}

export function describeRoute(edges: MapEdge[]): RoutePlan {
  const points: MapPoint[] = [];
  const turns: RoutePlan['turns'] = [];
  for (const [i, edge] of edges.entries()) {
    const before = edges[i - 1];
    const after = edges[i + 1];
    if (edge.junction && before && after) {
      const entry = edge.points[0]!;
      const exit = edge.points.at(-1)!;
      const a = before.points.findLast((point) => distance(point, entry) >= 8);
      const b = after.points.find((point) => distance(point, exit) >= 8);
      if (a && b) {
        const dx = entry[0] - a[0];
        const dz = entry[1] - a[1];
        const ux = b[0] - exit[0];
        const uz = b[1] - exit[1];
        const angle = Math.atan2(dx * uz - dz * ux, dx * ux + dz * uz) * 180 / Math.PI;
        if (Math.abs(angle) >= 42 && Math.abs(angle) <= 135) {
          turns.push({ index: points.length - 1, direction: angle > 0 ? 'right' : 'left' });
        }
      }
    }
    points.push(...(i === 0 ? edge.points : edge.points.slice(1)));
  }
  return { points, turns };
}

export function readRoadDirections(fs: GameFs): Map<string, { forward: boolean; backward: boolean; lanes: number }> {
  const result = new Map<string, { forward: boolean; backward: boolean; lanes: number }>();
  for (const name of fs.list('def/world')) {
    if (!/^road_look(?:\.[^.]+)*\.sii$/.test(name)) continue;
    const path = `def/world/${name}`;
    const contents = fs.readText(path);
    if (!contents) continue;
    for (const unit of parseSii(path, contents, (include) => fs.readText(include))) {
      if (unit.className !== 'road_look') continue;
      const drivingLane = (lane: string) => lane.startsWith('traffic_lane.road.') || lane === 'traffic_lane.slow_road';
      const right = sii.list(unit, 'lanes_right').filter(drivingLane).length;
      const left = sii.list(unit, 'lanes_left').filter(drivingLane).length;
      result.set(unit.name.slice('road.'.length), { forward: right > 0, backward: left > 0, lanes: right + left });
    }
  }
  return result;
}

/** Uses declared road sides and directional prefab links. No proximity-based edges. */
export function routeBetweenCities(
  edges: MapEdge[], start: MapPoint, via: MapPoint | null, end: MapPoint, headingDeg?: number,
): MapEdge[] | null {
  const outgoing = new Map<bigint, Array<MapEdge & { metres: number }>>();
  const positions = new Map<bigint, MapPoint>();
  for (const edge of edges) {
    positions.set(edge.from, edge.points[0]!);
    positions.set(edge.to, edge.points.at(-1)!);
    let metres = 0;
    for (let i = 1; i < edge.points.length; i++) metres += distance(edge.points[i - 1]!, edge.points[i]!);
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    outgoing.get(edge.from)!.push({ ...edge, metres });
  }
  const near = (point: MapPoint) => [...positions].flatMap(([id, position]) => {
    const metres = distance(position, point);
    return metres <= 350 ? [{ id, metres }] : [];
  });
  const goals = new Set(near(end).map(({ id }) => id));
  const viaNodes = new Set(via ? near(via).map(({ id }) => id) : []);
  interface Step {
    id: bigint;
    cost: number;
    via: boolean;
    edge?: MapEdge;
    previous?: Step;
  }
  const best = new Map<string, Step>();
  const pending = new Map<string, Step>();
  const add = (key: string, step: Step) => {
    if (step.cost >= (best.get(key)?.cost ?? Infinity)) return;
    best.set(key, step);
    pending.set(key, step);
  };
  if (headingDeg === undefined) {
    for (const { id, metres } of near(start)) add(`${id}:0:${!via}`, { id, cost: metres, via: !via });
  } else {
    const heading = headingDeg * Math.PI / 180;
    const hx = Math.sin(heading);
    const hz = -Math.cos(heading);
    const candidates: Array<{ edge: MapEdge; score: number }> = [];
    for (const edge of edges) {
      for (let i = 1; i < edge.points.length; i++) {
        const a = edge.points[i - 1]!;
        const b = edge.points[i]!;
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const length = Math.hypot(dx, dz);
        if (!length) continue;
        const alignment = (dx * hx + dz * hz) / length;
        if (alignment < 0.35) continue;
        const along = Math.max(0, Math.min(length, ((start[0] - a[0]) * dx + (start[1] - a[1]) * dz) / length));
        const projected: MapPoint = [a[0] + dx * along / length, a[1] + dz * along / length];
        const gap = distance(start, projected);
        if (gap > 45) continue;
        candidates.push({ edge: { ...edge, points: [projected, ...edge.points.slice(i)] }, score: gap + 12 * (1 - alignment) });
      }
    }
    candidates.sort((a, b) => a.score - b.score);
    const limit = (candidates[0]?.score ?? 0) + 8;
    for (const { edge, score } of candidates.filter((candidate) => candidate.score <= limit).slice(0, 12)) {
      const metres = edge.points.slice(1).reduce((sum, point, i) => sum + distance(edge.points[i]!, point), 0);
      add(`${edge.to}:${edge.item}:${!via}`, { id: edge.to, cost: metres + 3 * score, via: !via, edge });
    }
  }
  while (pending.size) {
    let next: [string, Step] | undefined;
    for (const candidate of pending) {
      if (!next || candidate[1].cost < next[1].cost) next = candidate;
    }
    const [key, step] = next!;
    pending.delete(key);
    if (step.via && goals.has(step.id)) {
      const path: MapEdge[] = [];
      for (let cursor: Step | undefined = step; cursor?.edge; cursor = cursor.previous) path.push(cursor.edge);
      return path.reverse();
    }
    for (const edge of outgoing.get(step.id) ?? []) {
      // A port transition must leave the map item it arrived on.
      if (edge.item === step.edge?.item) continue;
      const via = step.via || viaNodes.has(edge.to);
      const cost = step.cost + edge.metres;
      const edgeKey = `${edge.to}:${edge.item}:${via}`;
      add(edgeKey, { id: edge.to, cost, via, edge, previous: step });
    }
  }
  return null;
}
