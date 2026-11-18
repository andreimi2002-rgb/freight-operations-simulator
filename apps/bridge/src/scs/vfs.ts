import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { openArchive, type Archive } from './hashfs.ts';

/**
 * The game's virtual file system: all .scs archives of an installation
 * mounted on top of each other, later archives overriding earlier ones
 * (base, then def, then DLCs, like the game).
 */

function loadOrder(name: string): number {
  if (name === 'core.scs') return 0;
  if (name === 'base.scs') return 1;
  if (name.startsWith('base_')) return 2;
  if (name === 'def.scs') return 3;
  if (name === 'locale.scs') return 4;
  if (name.startsWith('dlc_')) return 5;
  return 6;
}

export interface MountedArchive {
  archive: Archive;
  /** "dlc_balkan_e" for DLC archives, null for the base game. */
  dlc: string | null;
  mtimeMs: number;
}

export class GameFs {
  readonly root: string;
  readonly archives: MountedArchive[] = [];
  readonly errors: string[] = [];

  constructor(root: string) {
    this.root = root;
    const names = readdirSync(root).filter((f) => f.toLowerCase().endsWith('.scs'));
    names.sort((a, b) => loadOrder(a) - loadOrder(b) || a.localeCompare(b));
    for (const name of names) {
      const path = join(root, name);
      try {
        const st = statSync(path);
        const archive = openArchive(path, st.size);
        this.archives.push({ archive, dlc: name.startsWith('dlc_') ? name.replace(/\.scs$/i, '') : null, mtimeMs: st.mtimeMs });
      } catch (err) {
        this.errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  /** Newest archive modification time: changes after a game update or a new DLC. */
  get stamp(): number {
    return Math.max(0, ...this.archives.map((a) => a.mtimeMs));
  }

  /** Text of the topmost archive that has the file. */
  readText(path: string): string | null {
    for (let i = this.archives.length - 1; i >= 0; i--) {
      const buf = this.archives[i]!.archive.read(path);
      if (buf) return buf.toString('utf8');
    }
    return null;
  }

  /** Which archive provides a file (topmost). */
  provider(path: string): MountedArchive | null {
    for (let i = this.archives.length - 1; i >= 0; i--) {
      if (this.archives[i]!.archive.has(path)) return this.archives[i]!;
    }
    return null;
  }

  /** Union of directory listings across archives. Directories end with "/". */
  list(path: string): string[] {
    const set = new Set<string>();
    for (const a of this.archives) for (const n of a.archive.list(path) ?? []) set.add(n);
    return [...set].sort();
  }

  /** Listing per archive, to know which DLC adds which entry. */
  listWithSource(path: string): Array<{ name: string; dlc: string | null }> {
    const out: Array<{ name: string; dlc: string | null }> = [];
    for (const a of this.archives) for (const n of a.archive.list(path) ?? []) out.push({ name: n, dlc: a.dlc });
    return out;
  }

  close(): void {
    for (const a of this.archives) a.archive.close();
  }
}
