import type { MapPoint } from '../../../../packages/core/src/regional-map.ts';
import { parseSii, sii } from '../scs/sii.ts';
import type { GameFs } from '../scs/vfs.ts';
import { curve as sampleCurve, distance, rounded, type Anchor } from './geometry.ts';

interface Connection {
  from: number;
  to: number;
  points: MapPoint[];
}

interface Descriptor {
  anchors: Anchor[];
  lines: [MapPoint, MapPoint][];
  ports: Array<{ position: MapPoint; anchor: number }>;
  links: Connection[];
}

// PPD v25 header and record layout, cross-checked against the installed DLC.
function parseDescriptor(buffer: Buffer): Descriptor | null {
  if (buffer.length < 92 || buffer.readUInt32LE(0) !== 25) return null;
  const nodeCount = buffer.readUInt32LE(4);
  const pointCount = buffer.readUInt32LE(32);
  const nodeOffset = buffer.readUInt32LE(48);
  const pointOffset = buffer.readUInt32LE(76);
  const curveCount = buffer.readUInt32LE(8);
  const curveOffset = buffer.readUInt32LE(52);
  const nodeBytes = 104;
  const pointBytes = 48;
  if (!nodeCount || nodeOffset < 92 || nodeOffset + nodeCount * nodeBytes > buffer.length) return null;
  if (!pointCount || pointOffset < 92 || pointOffset + pointCount * pointBytes > buffer.length) return null;

  const laneIndices = (offset: number) => Array.from({ length: 8 }, (_, lane) => buffer.readInt32LE(offset + lane * 4))
    .filter((lane) => lane >= 0 && lane < curveCount);
  const anchors = Array.from({ length: nodeCount }, (_, index) => {
    const offset = nodeOffset + index * nodeBytes;
    return {
      position: [buffer.readFloatLE(offset + 16), buffer.readFloatLE(offset + 24)] as MapPoint,
      yaw: Math.atan2(buffer.readFloatLE(offset + 36), buffer.readFloatLE(offset + 28)),
      inputs: laneIndices(offset + 40),
      outputs: laneIndices(offset + 72),
    };
  });
  const points = Array.from({ length: pointCount }, (_, index) => {
    const offset = pointOffset + index * pointBytes;
    return {
      position: [buffer.readFloatLE(offset + 8), buffer.readFloatLE(offset + 16)] as MapPoint,
      road: (buffer[offset + 1]! & 0x0f) !== 13
        && (pointCount <= nodeCount + 1 || !(buffer[offset + 5]! & 2)),
      port: (buffer[offset + 5]! & 5) ? buffer[offset + 4]! & 0x7f : 0,
      neighbors: Array.from({ length: Math.min(buffer.readUInt32LE(offset + 44), 6) },
        (_, i) => buffer.readInt32LE(offset + 20 + i * 4)),
    };
  });
  const lines: Descriptor['lines'] = [];
  const seen = new Set<string>();
  for (let index = 0; index < points.length; index++) {
    const point = points[index]!;
    if (!point.road || !point.position.every(Number.isFinite)) continue;
    for (const neighbor of point.neighbors) {
      const other = points[neighbor];
      if (!other?.road || neighbor === index || !other.position.every(Number.isFinite)) continue;
      const key = `${Math.min(index, neighbor)}:${Math.max(index, neighbor)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push([point.position, other.position]);
    }
  }
  const ports = points.flatMap((point) => {
    if (!point.road || !point.port || (point.port & (point.port - 1)) !== 0) return [];
    const anchor = Math.log2(point.port);
    return anchor < anchors.length ? [{ position: point.position, anchor }] : [];
  });
  const links: Descriptor['links'] = [];
  const curveBytes = 132;
  if (curveCount && curveOffset >= 92 && curveOffset + curveCount * curveBytes <= buffer.length) {
    const exits = new Map<number, number>();
    for (const [index, anchor] of anchors.entries()) {
      for (const lane of anchor.outputs) exits.set(lane, index);
    }
    for (const [index, anchor] of anchors.entries()) {
      const pending = [...anchor.inputs];
      const previous = new Map<number, number | null>(pending.map((input) => [input, null]));
      const found = new Set<number>();
      for (let i = 0; i < pending.length; i++) {
        const curve = pending[i]!;
        const exit = exits.get(curve);
        if (exit !== undefined) {
          if (exit === index || found.has(exit)) continue;
          const indices: number[] = [];
          for (let id: number | null = curve; id !== null; id = previous.get(id) ?? null) indices.push(id);
          const points: MapPoint[] = [];
          const position = (offset: number): MapPoint => [buffer.readFloatLE(offset), buffer.readFloatLE(offset + 8)];
          const yaw = (offset: number) => 2 * Math.atan2(-buffer.readFloatLE(offset + 8), buffer.readFloatLE(offset)) - Math.PI / 2;
          let valid = true;
          for (const id of indices.reverse()) {
            const offset = curveOffset + id * curveBytes;
            const a = { position: position(offset + 16), yaw: yaw(offset + 40) };
            const b = { position: position(offset + 28), yaw: yaw(offset + 56) };
            if (![...a.position, ...b.position, a.yaw, b.yaw].every(Number.isFinite)
              || (points.length && distance(points.at(-1)!, a.position) > 2)) {
              valid = false;
              break;
            }
            points.push(...sampleCurve(a, b, 3));
          }
          if (!valid || !points.length || distance(points[0]!, anchor.position) > 25
            || distance(points.at(-1)!, anchors[exit]!.position) > 25) continue;
          found.add(exit);
          links.push({ from: index, to: exit, points });
          continue;
        }
        const offset = curveOffset + curve * curveBytes;
        const count = Math.min(buffer.readUInt32LE(offset + 108), 4);
        for (let next = 0; next < count; next++) {
          const target = buffer.readInt32LE(offset + 76 + next * 4);
          if (target < 0 || target >= curveCount || previous.has(target)) continue;
          previous.set(target, curve);
          pending.push(target);
        }
      }
    }
  }
  return { anchors, lines, ports, links };
}

export function readPrefabModels(fs: GameFs) {
  const descriptions = new Map<string, string>();
  for (const name of fs.list('def/world')) {
    if (!/^prefab(?:\.[^.]+)*\.sii$/.test(name)) continue;
    const path = `def/world/${name}`;
    const text = fs.readText(path);
    if (!text) continue;
    for (const unit of parseSii(path, text, (include) => fs.readText(include))) {
      if (unit.className !== 'prefab_model') continue;
      const descriptor = sii.str(unit, 'prefab_desc');
      if (descriptor) descriptions.set(unit.name.slice('prefab.'.length), descriptor.replace(/^\//, ''));
    }
  }
  const cache = new Map<string, Descriptor | null>();
  return (model: string): Descriptor | null => {
    const path = descriptions.get(model);
    if (!path) return null;
    if (!cache.has(path)) {
      const data = fs.provider(path)?.archive.read(path);
      cache.set(path, data ? parseDescriptor(data) : null);
    }
    return cache.get(path) ?? null;
  };
}

export function placePrefab(descriptor: Descriptor, originIndex: number, world: Anchor[]): {
  lines: MapPoint[][];
  links: Connection[];
} | null {
  const local = descriptor.anchors[originIndex];
  const origin = world[0];
  if (!origin || !local || world.length !== descriptor.anchors.length) return null;
  const angle = origin.yaw - local.yaw;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const place = ([x, z]: MapPoint): MapPoint => {
    const dx = x - local.position[0];
    const dz = z - local.position[1];
    return [origin.position[0] + dx * cos - dz * sin, origin.position[1] + dx * sin + dz * cos];
  };
  const anchors = descriptor.anchors.map((anchor) => place(anchor.position));
  const nodeIndices = anchors.map((anchor) => world.findIndex((node) => distance(anchor, node.position) <= 2));
  if (nodeIndices.includes(-1) || new Set(nodeIndices).size !== world.length) return null;
  const lines = descriptor.lines.map((line) => line.map((point): MapPoint => {
    const position = place(point);
    const anchor = world.find((node) => distance(node.position, position) < 0.75);
    return rounded(anchor?.position ?? position);
  }));
  // A map point at an explicit prefab port can be laterally offset from the
  // road's centreline. Join only that port to its declared world anchor.
  for (const port of descriptor.ports) {
    const anchor = anchors[port.anchor]!;
    const worldNode = world.find((node) => distance(node.position, anchor) <= 2);
    const position = place(port.position);
    if (worldNode && distance(position, worldNode.position) <= 25) {
      lines.push([rounded(position), rounded(worldNode.position)]);
    }
  }
  return {
    lines: lines.filter(([a, b]) => a && b && (a[0] !== b[0] || a[1] !== b[1])),
    links: descriptor.links.map(({ from, to, points }) => {
      const start = nodeIndices[from]!;
      const end = nodeIndices[to]!;
      return { from: start, to: end, points: [
        rounded(world[start]!.position), ...points.map((point) => rounded(place(point))), rounded(world[end]!.position),
      ] };
    }),
  };
}
