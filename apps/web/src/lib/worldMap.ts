import { useEffect, useMemo, useState } from 'react';
import type { MapCity, MapPoint, RegionalMap } from '../../../../packages/core/src/regional-map.ts';
import { bridgeHttp } from './telemetry';

/**
 * The whole ETS2 map, loaded by area from the bridge: the 8 km tiles around
 * the truck (5 x 5, about 40 x 40 km), or a simplified Europe-wide layer for
 * the overview. Tiles are cached for the session.
 */

interface WorldInfo {
  state: 'missing' | 'building' | 'ready' | 'error';
  error?: string;
  meta: { tileSize: number; bounds: [number, number, number, number]; tiles: string[]; cities: MapCity[]; sectors: number } | null;
}

interface TileData {
  roads: number[][];
  major: number[];
  junctions: number[][];
}

export type WorldMapStatus = 'off' | 'loading' | 'building' | 'ready' | 'error';

const RADIUS_TILES = 2;
const tileCache = new Map<string, Promise<TileData | null>>();
let overviewCache: Promise<MapPoint[][] | null> | null = null;

const toPoints = (flat: number[]): MapPoint[] => {
  const out: MapPoint[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i]!, flat[i + 1]!]);
  return out;
};

function fetchTile(key: string): Promise<TileData | null> {
  let p = tileCache.get(key);
  if (!p) {
    p = bridgeHttp(`/api/map/ets2/tile/${key}`)
      .then((r) => (r.ok ? (r.json() as Promise<TileData>) : null))
      .catch(() => null);
    tileCache.set(key, p);
    void p.then((t) => { if (!t) tileCache.delete(key); });
  }
  return p;
}

function fetchOverview(): Promise<MapPoint[][] | null> {
  overviewCache ??= bridgeHttp('/api/map/ets2/overview')
    .then((r) => (r.ok ? (r.json() as Promise<{ roads: number[][] }>) : null))
    .then((d) => (d ? d.roads.map(toPoints) : null))
    .catch(() => null)
    .then((v) => { if (!v) overviewCache = null; return v; });
  return overviewCache;
}

/** Clears cached map data (after the bridge rebuilt the map, or on a new connection). */
export function resetWorldCache(): void {
  tileCache.clear();
  overviewCache = null;
}

export function useWorldMap(
  enabled: boolean,
  center: { x: number; z: number } | null,
  overview: boolean,
  connectionKey: string,
): { map: RegionalMap | null; status: WorldMapStatus; error: string | null; info: WorldInfo['meta'] } {
  const [info, setInfo] = useState<WorldInfo | null>(null);
  const [map, setMap] = useState<RegionalMap | null>(null);
  const [error, setError] = useState<string | null>(null);

  // World status; polled while the bridge builds the map.
  useEffect(() => {
    setInfo(null);
    setMap(null);
    if (!enabled) return;
    resetWorldCache();
    let alive = true;
    let timer = 0;
    const poll = async () => {
      try {
        const r = await bridgeHttp('/api/map/ets2/world');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const w = (await r.json()) as WorldInfo;
        if (!alive) return;
        setInfo(w);
        setError(w.state === 'error' || w.state === 'missing' ? (w.error ?? null) : null);
        if (w.state === 'building') timer = window.setTimeout(() => void poll(), 4000);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Bridge-ul nu răspunde.');
        timer = window.setTimeout(() => void poll(), 8000);
      }
    };
    void poll();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [enabled, connectionKey]);

  const meta = info?.state === 'ready' ? info.meta : null;
  const size = meta?.tileSize ?? 8192;
  const tx = center ? Math.floor(center.x / size) : null;
  const tz = center ? Math.floor(center.z / size) : null;
  const wantOverview = overview || tx === null;

  // Only the tile the truck is in matters for reloading, not every metre.
  const keys = useMemo(() => {
    if (!meta || wantOverview || tx === null || tz === null) return [];
    const have = new Set(meta.tiles);
    const out: string[] = [];
    for (let i = -RADIUS_TILES; i <= RADIUS_TILES; i++) {
      for (let j = -RADIUS_TILES; j <= RADIUS_TILES; j++) {
        const k = `${tx + i}_${tz + j}`;
        if (have.has(k)) out.push(k);
      }
    }
    return out;
  }, [meta, wantOverview, tx, tz]);

  useEffect(() => {
    if (!meta) return;
    let alive = true;
    if (wantOverview) {
      void fetchOverview().then((roads) => {
        if (alive && roads) setMap({ roads, junctions: [], cities: meta.cities, demoRoute: null });
      });
    } else {
      void Promise.all(keys.map(fetchTile)).then((tiles) => {
        if (!alive) return;
        const roads: MapPoint[][] = [];
        const junctions: MapPoint[][] = [];
        for (const t of tiles) {
          if (!t) continue;
          for (const r of t.roads) roads.push(toPoints(r));
          for (const j of t.junctions) junctions.push(toPoints(j));
        }
        setMap({ roads, junctions, cities: meta.cities, demoRoute: null });
      });
    }
    return () => {
      alive = false;
    };
  }, [meta, wantOverview, keys.join(',')]);

  const status: WorldMapStatus = !enabled ? 'off'
    : info?.state === 'building' ? 'building'
    : info?.state === 'error' || info?.state === 'missing' || (error && !info) ? 'error'
    : map ? 'ready' : 'loading';
  return { map: enabled ? map : null, status, error, info: meta };
}
