import { randomUUID } from 'node:crypto';
import { createWriteStream, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createGzip, type Gzip } from 'node:zlib';
import type { GameEvent, Snapshot } from '@trucksim/core';
import type { ScsSample } from './sources.ts';

const SAMPLE_MS = 500;
const INACTIVE_GRACE_MS = 60_000;

/**
 * Records live sessions to recordings/<date>_<game>.jsonl.gz: one snapshot
 * every 500 ms plus every gameplay event. Recordings feed replay mode and
 * regression tests. Audio is never recorded.
 */
export class Recorder {
  private gzip: Gzip | null = null;
  private file: string | null = null;
  private startedAt = 0;
  private lastSample = 0;
  private lastActive = 0;
  private lastState: string | null = null;

  private readonly dir: string;
  private readonly enabled: boolean;

  constructor(dir: string, enabled: boolean) {
    this.dir = dir;
    this.enabled = enabled;
    if (enabled) mkdirSync(dir, { recursive: true });
  }

  get current(): string | null {
    return this.file;
  }

  /** Feed only source events (from the SDK), not derived ones. */
  push(snap: Snapshot, sourceEvents: GameEvent[], scs?: ScsSample): void {
    if (!this.enabled || snap.source !== 'live') return;
    if (snap.sdkActive) this.lastActive = snap.ts;
    if (!this.gzip) {
      if (!snap.sdkActive) return;
      this.open(snap);
    }
    const state = JSON.stringify([
      snap.sdkActive, snap.game.paused, snap.game.id, snap.job !== null,
      scs?.sdkActive, scs?.paused, scs?.onJob, scs?.jobFinished, scs?.jobDelivered, scs?.jobCancelled,
    ]);
    const due = snap.ts - this.lastSample >= SAMPLE_MS;
    if (due || state !== this.lastState || sourceEvents.length) {
      this.lastSample = snap.ts;
      this.lastState = state;
      this.write({ t: snap.ts - this.startedAt, s: snap, scs, ...(sourceEvents.length ? { e: sourceEvents } : {}) });
    }
    if (snap.ts - this.lastActive >= INACTIVE_GRACE_MS) this.close();
  }

  private open(snap: Snapshot): void {
    const d = new Date(snap.ts);
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    const name = `${stamp}_${snap.game.id ?? 'game'}_${randomUUID()}.jsonl.gz`;
    this.file = name;
    this.startedAt = snap.ts;
    this.lastSample = 0;
    this.lastState = null;
    this.gzip = createGzip();
    this.gzip.pipe(createWriteStream(join(this.dir, name)));
    this.gzip.write(`${JSON.stringify({ header: { format: 'trucksim-recording', v: 1, startedAt: snap.ts, game: snap.game.id } })}\n`);
    console.log(`[recorder] recording to recordings/${name}`);
  }

  private write(line: unknown): void {
    this.gzip?.write(`${JSON.stringify(line)}\n`);
  }

  close(): void {
    if (!this.gzip) return;
    this.gzip.end();
    this.gzip = null;
    console.log(`[recorder] closed ${this.file}`);
    this.file = null;
  }

  list(): Array<{ name: string; bytes: number; modified: number }> {
    try {
      return readdirSync(this.dir)
        .filter((f) => f.endsWith('.jsonl') || f.endsWith('.jsonl.gz'))
        .map((name) => {
          const st = statSync(join(this.dir, name));
          return { name, bytes: st.size, modified: st.mtimeMs };
        })
        .sort((a, b) => b.modified - a.modified);
    } catch {
      return [];
    }
  }
}
