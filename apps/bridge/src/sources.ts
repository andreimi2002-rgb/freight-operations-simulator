import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import { DemoSimulator, emptySnapshot, type GameEvent, type Snapshot } from '@trucksim/core';
import { normalize, SdkEventDetector } from './normalize.ts';
import { parseScs, SUPPORTED_REVISION, type RawScs } from './scs-layout.ts';
import { SharedMemoryReader } from './shm.ts';
import { loadRegionalMap } from './map/regional.ts';

export interface ScsSample {
  time: string;
  sdkActive: boolean;
  paused: boolean;
  onJob: boolean;
  jobFinished: boolean;
  jobDelivered: boolean;
  jobCancelled: boolean;
}

export type Emit = (snap: Snapshot, events: GameEvent[], scs?: ScsSample) => void;

export interface TelemetrySource {
  readonly kind: 'live' | 'demo' | 'replay';
  start(emit: Emit): void;
  stop(): void;
  /** For status reporting. */
  info(): { pluginDetected: boolean; detail: string | null };
}

const POLL_MS = 50;
const STALE_MS = 3000;
const REOPEN_MS = 10_000;

export function liveSampleState(raw: Pick<RawScs, 'paused' | 'sdkActive'>, unchangedMs: number) {
  const paused = raw.sdkActive && raw.paused;
  return {
    available: raw.sdkActive && (paused || unchangedMs < STALE_MS),
    reopen: !paused && unchangedMs > REOPEN_MS,
  };
}

/** Live telemetry from the plugin's shared memory. */
export class LiveSource implements TelemetrySource {
  readonly kind = 'live' as const;
  private readonly shm = new SharedMemoryReader();
  private readonly sdkEvents = new SdkEventDetector();
  private timer: NodeJS.Timeout | null = null;
  private lastTime: bigint | null = null;
  private lastChange = 0;
  private lastOpenTry = 0;
  private lastOfflineEmit = 0;
  private revisionWarned = false;
  private error: string | null = null;

  start(emit: Emit): void {
    const tick = async () => {
      const now = Date.now();
      try {
        if (!this.shm.isOpen) {
          if (now - this.lastOpenTry > 1000) {
            this.lastOpenTry = now;
            await this.shm.open();
          }
          if (!this.shm.isOpen) {
            if (now - this.lastOfflineEmit > 1000) {
              this.lastOfflineEmit = now;
              emit(emptySnapshot('live', now), []);
            }
            return;
          }
        }
        const buf = this.shm.read();
        if (!buf) return;
        const raw = parseScs(buf);
        if (raw.revision && raw.revision !== SUPPORTED_REVISION && !this.revisionWarned) {
          this.revisionWarned = true;
          console.warn(`[live] plugin revision ${raw.revision}, the bridge was written for ${SUPPORTED_REVISION}; values may be wrong.`);
        }
        if (raw.time !== this.lastTime) {
          this.lastTime = raw.time;
          this.lastChange = now;
        }
        if (raw.sdkActive && raw.paused) this.lastChange = now;
        const state = liveSampleState(raw, now - this.lastChange);
        const scs: ScsSample = {
          time: raw.time.toString(),
          sdkActive: raw.sdkActive,
          paused: raw.paused,
          onJob: raw.onJob,
          jobFinished: raw.jobFinished,
          jobDelivered: raw.jobDelivered,
          jobCancelled: raw.jobCancelled,
        };
        // The mapping stays alive while we hold it, even after the game exits:
        // when nothing changes for a while, release it and look again.
        if (state.reopen) {
          this.shm.close();
          this.sdkEvents.reset();
          this.lastTime = null;
          emit(emptySnapshot('live', now), [], scs);
          return;
        }
        const snap = normalize(raw, now, state.available);
        const events = state.available ? this.sdkEvents.next(raw, snap) : [];
        this.error = null;
        emit(snap, events, scs);
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err);
      }
    };
    this.timer = setInterval(() => void tick(), POLL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.shm.close();
  }

  info() {
    return { pluginDetected: this.shm.isOpen, detail: this.error };
  }
}

export class DemoSource implements TelemetrySource {
  readonly kind = 'demo' as const;
  private timer: NodeJS.Timeout | null = null;

  start(emit: Emit): void {
    let map: ReturnType<typeof loadRegionalMap> = null;
    try {
      map = loadRegionalMap();
    } catch (error) {
      console.warn('[demo map]', error);
    }
    const sim = new DemoSimulator(undefined, map?.demoRoute, map?.demoDestination);
    this.timer = setInterval(() => {
      const { snapshot, events } = sim.tick(Date.now());
      emit(snapshot, events);
    }, 100);
  }
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  info() {
    return { pluginDetected: false, detail: 'demo' };
  }
}

interface RecordedLine {
  t: number;
  s?: Snapshot;
  e?: GameEvent[];
}

/** Replays a recording (JSONL, optionally gzipped) at its original pace, in a loop. */
export class ReplaySource implements TelemetrySource {
  readonly kind = 'replay' as const;
  private lines: RecordedLine[] = [];
  private stopped = false;
  private timer: NodeJS.Timeout | null = null;

  private readonly file: string;
  private readonly speed: number;

  constructor(file: string, speed = 1) {
    this.file = file;
    this.speed = speed;
  }

  async load(): Promise<number> {
    const input = createReadStream(this.file);
    const stream = this.file.endsWith('.gz') ? input.pipe(createGunzip()) : input;
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    const lines: RecordedLine[] = [];
    for await (const line of rl) {
      if (!line.trim()) continue;
      const parsed = JSON.parse(line) as RecordedLine & { header?: unknown };
      if ('header' in parsed) continue;
      lines.push(parsed);
    }
    this.lines = lines;
    return lines.length;
  }

  start(emit: Emit): void {
    if (this.lines.length === 0) {
      emit(emptySnapshot('replay', Date.now()), []);
      return;
    }
    let i = 0;
    let loopStart = Date.now();
    const step = () => {
      if (this.stopped) return;
      const line = this.lines[i]!;
      const now = Date.now();
      if (line.s) emit({ ...line.s, source: 'replay', ts: now }, (line.e ?? []).map((e) => ({ ...e, ts: now })));
      else if (line.e?.length) emit(emptySnapshot('replay', now), line.e);
      i += 1;
      if (i >= this.lines.length) {
        i = 0;
        loopStart = Date.now() + 2000;
      }
      const due = loopStart + this.lines[i]!.t / this.speed;
      this.timer = setTimeout(step, Math.max(0, due - Date.now()));
    };
    step();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  info() {
    return { pluginDetected: false, detail: this.file };
  }
}
