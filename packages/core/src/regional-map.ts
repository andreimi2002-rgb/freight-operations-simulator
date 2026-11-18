/** ETS2 world coordinates in metres, using the same X/Z axes as telemetry. */
export type MapPoint = [x: number, z: number];

export interface RouteTurn {
  index: number;
  direction: 'left' | 'right';
}

export interface RoutePlan {
  points: MapPoint[];
  turns: RouteTurn[];
}

export interface UpcomingTurn {
  direction: RouteTurn['direction'];
  mapMetres: number;
}

export interface MapCity {
  id: string;
  name: string;
  /** Game country id, e.g. "romania". */
  country: string;
  position: MapPoint;
}

export interface RegionalMap {
  roads: MapPoint[][];
  junctions?: MapPoint[][];
  cities: MapCity[];
  /** Connected road geometry for a simulated drive in the region. */
  demoRoute: MapPoint[] | null;
  demoTurns?: RouteTurn[];
  demoDestination?: 'ruse';
}

export function nearbyCity(cities: MapCity[], position: { x: number; z: number }) {
  let nearest: MapCity | undefined;
  let best = 4500;
  for (const city of cities) {
    const distance = Math.hypot(city.position[0] - position.x, city.position[1] - position.z);
    if (distance >= best) continue;
    nearest = city;
    best = distance;
  }
  return nearest ? { id: nearest.id, city: nearest.name, country: nearest.country, mapMetres: Math.round(best) } : null;
}

export function nextRouteTurn(
  plan: RoutePlan,
  position: { x: number; z: number; headingDeg: number },
): UpcomingTurn | null {
  if (!plan.turns.length) return null;
  const heading = position.headingDeg * Math.PI / 180;
  const hx = Math.sin(heading);
  const hz = -Math.cos(heading);
  let travelled = 0;
  let routePosition: number | null = null;
  let score = Infinity;
  const distances = [0];
  for (let i = 1; i < plan.points.length; i++) {
    const [ax, az] = plan.points[i - 1]!;
    const [bx, bz] = plan.points[i]!;
    const dx = bx - ax;
    const dz = bz - az;
    const length = Math.hypot(dx, dz);
    if (length) {
      const facing = (dx * hx + dz * hz) / length;
      const offset = Math.max(0, Math.min(length, ((position.x - ax) * dx + (position.z - az) * dz) / length));
      const gap = Math.hypot(position.x - ax - offset * dx / length, position.z - az - offset * dz / length);
      const candidate = gap + 10 * (1 - facing);
      if (facing > 0.2 && gap <= 35 && candidate < score) {
        score = candidate;
        routePosition = travelled + offset;
      }
    }
    travelled += length;
    distances.push(travelled);
  }
  if (routePosition === null) return null;
  for (const turn of plan.turns) {
    const remaining = (distances[turn.index] ?? -1) - routePosition;
    if (remaining >= -4 && remaining <= 1500) {
      return { direction: turn.direction, mapMetres: Math.max(0, Math.round(remaining)) };
    }
  }
  return null;
}
