import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { nearbyCity, type MapPoint, type RoutePlan } from '../../../../packages/core/src/regional-map.ts';
import { REPO_ROOT } from '../config.ts';
import { findInstall } from '../gamedata/store.ts';
import { decodeRouter, newestArchive, WORLD_FORMAT, type WorldMeta } from './world-build.ts';
import { WorldRouter } from './world-router.ts';

/**
 * The whole ETS2 map for the app and the copilot. Built once in a worker
 * thread (about 15 s), cached in data/generated/map/ets2, rebuilt only when
 * the game files change (update, new DLC).
 */

const OUT_DIR = join(REPO_ROOT, 'data', 'generated', 'map', 'ets2');

export type WorldState =
  | { state: 'missing'; reason: string }
  | { state: 'building'; since: number }
  | { state: 'ready'; meta: WorldMeta }
  | { state: 'error'; error: string };

let status: WorldState = { state: 'missing', reason: 'not started' };
let meta: WorldMeta | null = null;
let router: WorldRouter | null = null;
const tileCache = new Map<string, Buffer>();

function loadFromDisk(): boolean {
  const metaFile = join(OUT_DIR, 'meta.json');
  if (!existsSync(metaFile)) return false;
  const m = JSON.parse(readFileSync(metaFile, 'utf8')) as WorldMeta;
  if (m.format !== WORLD_FORMAT) return false;
  const t = Date.now();
  router = new WorldRouter(decodeRouter(readFileSync(join(OUT_DIR, 'router.bin'))));
  meta = m;
  tileCache.clear();
  status = { state: 'ready', meta: m };
  console.log(`[world] ETS2 map ready: ${m.sectors} sectors, ${m.tiles.length} tiles, ${m.cities.length} cities, ${m.counts.edges} edges (loaded in ${Date.now() - t} ms)`);
  return true;
}

/** Loads the cached map, or builds it in the background when missing or outdated. */
export function startWorld(opts: { force?: boolean } = {}): void {
  const install = findInstall('ets2');
  if (!install) {
    status = { state: 'missing', reason: 'ETS2 not installed' };
    return;
  }
  if (status.state === 'building') return;
  try {
    if (!opts.force && existsSync(join(OUT_DIR, 'meta.json'))) {
      const m = JSON.parse(readFileSync(join(OUT_DIR, 'meta.json'), 'utf8')) as WorldMeta;
      if (m.format === WORLD_FORMAT && m.archivesStamp >= newestArchive(install) && loadFromDisk()) return;
    }
  } catch (err) {
    console.warn('[world] cache unreadable, rebuilding:', err instanceof Error ? err.message : err);
  }
  status = { state: 'building', since: Date.now() };
  console.log('[world] building the ETS2 map from the game files (about 15 s)...');
  const worker = new Worker(new URL('./world-worker.ts', import.meta.url), {
    workerData: { install, outDir: OUT_DIR },
    resourceLimits: { maxOldGenerationSizeMb: 4096 },
  });
  worker.on('message', (msg: { type: string; msg?: string; meta?: WorldMeta; error?: string }) => {
    if (msg.type === 'log') console.log(`[world] ${msg.msg}`);
    if (msg.type === 'done') {
      try {
        loadFromDisk();
      } catch (err) {
        status = { state: 'error', error: err instanceof Error ? err.message : String(err) };
      }
    }
    if (msg.type === 'error') {
      status = { state: 'error', error: msg.error ?? 'unknown' };
      console.warn('[world] build failed:', msg.error);
    }
  });
  worker.on('error', (err) => {
    status = { state: 'error', error: err.message };
    console.warn('[world] worker error:', err.message);
  });
}

export function worldStatus(): WorldState {
  return status;
}

export function worldMeta(): WorldMeta | null {
  return meta;
}

/** Gzipped tile JSON, or null when the tile is empty or the map is not ready. */
export function worldTile(key: string): Buffer | null {
  if (!meta || !/^-?\d+_-?\d+$/.test(key) || !meta.tiles.includes(key)) return null;
  let buf = tileCache.get(key);
  if (!buf) {
    buf = readFileSync(join(OUT_DIR, 'tiles', `${key}.json.gz`));
    if (tileCache.size > 400) tileCache.clear();
    tileCache.set(key, buf);
  }
  return buf;
}

export function worldOverview(): Buffer | null {
  if (!meta) return null;
  const key = 'overview';
  let buf = tileCache.get(key);
  if (!buf) tileCache.set(key, (buf = readFileSync(join(OUT_DIR, 'overview.json.gz'))));
  return buf;
}

export function worldRouteToCity(destinationId: string, position: MapPoint, headingDeg: number): RoutePlan | null {
  const city = meta?.cities.find((c) => c.id === destinationId);
  if (!city || !router) return null;
  return router.route(position, headingDeg, city.position);
}

export function worldNearbyCity(position: { x: number; z: number }) {
  return meta ? nearbyCity(meta.cities, position) : null;
}
