import type { MapPoint } from '../../../../packages/core/src/regional-map.ts';

export interface Anchor {
  position: MapPoint;
  yaw: number;
}

export function distance([x, z]: MapPoint, [px, pz]: MapPoint): number {
  return Math.hypot(x - px, z - pz);
}

export function rounded([x, z]: MapPoint): MapPoint {
  return [Math.round(x), Math.round(z)];
}

export function curve(a: Anchor, b: Anchor, sampleMetres: number): MapPoint[] {
  const [ax, az] = a.position;
  const [bx, bz] = b.position;
  const length = distance(a.position, b.position);
  const steps = Math.min(48, Math.max(4, Math.ceil(length / sampleMetres)));
  const tangent = (node: Anchor): MapPoint => {
    const x = Math.cos(node.yaw);
    const z = Math.sin(node.yaw);
    const sign = x * (bx - ax) + z * (bz - az) < 0 ? -1 : 1;
    return [sign * x * length, sign * z * length];
  };
  const [tx, tz] = tangent(a);
  const [ux, uz] = tangent(b);
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    const square = t * t;
    const cube = square * t;
    const start = 2 * cube - 3 * square + 1;
    const end = 1 - start;
    return [
      start * ax + end * bx + (cube - 2 * square + t) * tx + (cube - square) * ux,
      start * az + end * bz + (cube - 2 * square + t) * tz + (cube - square) * uz,
    ];
  });
}
