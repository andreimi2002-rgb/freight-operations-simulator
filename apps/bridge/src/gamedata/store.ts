import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GAMEDATA_EXTRACTOR_VERSION, type GameData, type GameId } from '@trucksim/core';
import { REPO_ROOT } from '../config.ts';
import { extractGameData } from './extract.ts';

/**
 * Finds ETS2/ATS on this PC, extracts their game data when it is missing or
 * the game changed (update, new DLC), and keeps it in data/generated/
 * (git-ignored: the data belongs to SCS Software and stays on this PC).
 */

const OUT_DIR = join(REPO_ROOT, 'data', 'generated');
const FOLDERS: Record<GameId, string> = { ets2: 'Euro Truck Simulator 2', ats: 'American Truck Simulator' };

function steamLibraries(): string[] {
  const roots = new Set<string>(['C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam']);
  for (const steam of [...roots]) {
    const vdf = join(steam, 'steamapps', 'libraryfolders.vdf');
    if (!existsSync(vdf)) continue;
    for (const m of readFileSync(vdf, 'utf8').matchAll(/"path"\s+"([^"]+)"/g)) roots.add(m[1]!.replace(/\\\\/g, '\\'));
  }
  return [...roots];
}

export function findInstall(game: GameId): string | null {
  const env = process.env[game === 'ets2' ? 'TRUCKSIM_ETS2_DIR' : 'TRUCKSIM_ATS_DIR'];
  const candidates = [...(env ? [env] : []), ...steamLibraries().map((l) => join(l, 'steamapps', 'common', FOLDERS[game]))];
  return candidates.find((d) => existsSync(join(d, 'def.scs'))) ?? null;
}

function newestArchive(dir: string): number {
  let t = 0;
  for (const f of readdirSync(dir)) if (f.toLowerCase().endsWith('.scs')) t = Math.max(t, statSync(join(dir, f)).mtimeMs);
  return t;
}

const cache = new Map<GameId, GameData>();

export function loadGameData(game: GameId): GameData | null {
  const hit = cache.get(game);
  if (hit) return hit;
  const file = join(OUT_DIR, `${game}.json`);
  if (!existsSync(file)) return null;
  try {
    const data = JSON.parse(readFileSync(file, 'utf8')) as GameData;
    cache.set(game, data);
    return data;
  } catch {
    return null;
  }
}

export interface RefreshResult {
  game: GameId;
  data: GameData | null;
  warnings: string[];
  error: string | null;
  ms: number;
  extracted: boolean;
}

export async function refreshGameData(opts: { force?: boolean; only?: GameId } = {}): Promise<RefreshResult[]> {
  const out: RefreshResult[] = [];
  for (const game of (opts.only ? [opts.only] : ['ets2', 'ats']) as GameId[]) {
    const t = Date.now();
    const dir = findInstall(game);
    if (!dir) {
      out.push({ game, data: null, warnings: [], error: 'game not installed', ms: 0, extracted: false });
      continue;
    }
    const existing = loadGameData(game);
    const stamp = newestArchive(dir);
    if (!opts.force && existing && existing.meta.archivesStamp >= stamp && existing.meta.extractorVersion === GAMEDATA_EXTRACTOR_VERSION) {
      out.push({ game, data: existing, warnings: [], error: null, ms: 0, extracted: false });
      continue;
    }
    try {
      // Let the event loop breathe between games when called from the bridge.
      await new Promise((r) => setImmediate(r));
      const { data, warnings } = extractGameData(game, dir);
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(join(OUT_DIR, `${game}.json`), JSON.stringify(data));
      cache.set(game, data);
      out.push({ game, data, warnings, error: null, ms: Date.now() - t, extracted: true });
    } catch (err) {
      out.push({ game, data: existing, warnings: [], error: err instanceof Error ? err.message : String(err), ms: Date.now() - t, extracted: false });
    }
  }
  return out;
}
