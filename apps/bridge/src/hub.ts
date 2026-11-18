import { EventEmitter } from 'node:events';
import {
  DerivedEventDetector,
  TripTracker,
  type BridgeMode,
  type BridgeStatus,
  type GameEvent,
  type Snapshot,
  type Trip,
} from '@trucksim/core';
import type { Recorder } from './recorder.ts';
import { DemoSource, LiveSource, ReplaySource, type ScsSample, type TelemetrySource } from './sources.ts';
import type { TripStore } from './store.ts';

const BROADCAST_MS = 100; // 10 Hz to clients

/**
 * Owns the active telemetry source and fans its output out: derived events,
 * trip tracking, recording, and the latest snapshot for clients.
 *
 * Emits: 'snapshot' (Snapshot, throttled), 'event' (GameEvent), 'trip' (Trip, finished).
 */
export class Hub extends EventEmitter {
  private source: TelemetrySource | null = null;
  private readonly derived = new DerivedEventDetector();
  private readonly trips: TripTracker;
  private last: Snapshot | null = null;
  private lastBroadcast = 0;
  private pending: NodeJS.Timeout | null = null;
  mode: BridgeMode = 'live';
  replayFile: string | null = null;
  readonly recentEvents: GameEvent[] = [];

  private readonly store: TripStore;
  private readonly recorder: Recorder;

  constructor(store: TripStore, recorder: Recorder) {
    super();
    this.store = store;
    this.recorder = recorder;
    this.trips = new TripTracker((trip) => {
      this.store.save(trip);
      this.emit('trip', trip);
      console.log(`[trips] ${trip.status}: ${trip.cargo ?? '?'} ${trip.sourceCity ?? '?'} -> ${trip.destinationCity ?? '?'}`);
    });
  }

  get snapshot(): Snapshot | null {
    return this.last;
  }

  get activeTrip(): Trip | null {
    return this.trips.active;
  }

  async setMode(mode: BridgeMode, opts: { replayPath?: string; replayName?: string; speed?: number } = {}): Promise<void> {
    this.source?.stop();
    this.recorder.close();
    this.derived.reset();
    this.last = null;
    let src: TelemetrySource;
    if (mode === 'demo') src = new DemoSource();
    else if (mode === 'replay') {
      if (!opts.replayPath) throw new Error('Replay needs a recording file.');
      const r = new ReplaySource(opts.replayPath, opts.speed ?? 1);
      const n = await r.load();
      console.log(`[replay] ${opts.replayName ?? opts.replayPath}: ${n} lines`);
      src = r;
    } else src = new LiveSource();
    this.mode = mode;
    this.replayFile = mode === 'replay' ? (opts.replayName ?? opts.replayPath ?? null) : null;
    this.source = src;
    src.start((snap, events, scs) => this.ingest(snap, events, scs));
  }

  private ingest(snap: Snapshot, sourceEvents: GameEvent[], scs?: ScsSample): void {
    const derived = this.derived.next(snap);
    const events = [...derived, ...sourceEvents];
    // Trips: demo and replay trips are stored too, marked by source, and hidden by default.
    this.trips.update(snap, events);
    this.recorder.push(snap, sourceEvents, scs);
    this.last = snap;
    for (const ev of events) {
      this.recentEvents.push(ev);
      if (this.recentEvents.length > 50) this.recentEvents.shift();
      this.emit('event', ev);
    }
    const now = Date.now();
    if (now - this.lastBroadcast >= BROADCAST_MS) {
      this.lastBroadcast = now;
      this.emit('snapshot', snap);
    } else if (!this.pending) {
      this.pending = setTimeout(() => {
        this.pending = null;
        this.lastBroadcast = Date.now();
        if (this.last) this.emit('snapshot', this.last);
      }, BROADCAST_MS - (now - this.lastBroadcast));
    }
  }

  status(clients: number, ai: BridgeStatus['ai']): BridgeStatus {
    const info = this.source?.info() ?? { pluginDetected: false, detail: null };
    return {
      mode: this.mode,
      pluginDetected: info.pluginDetected,
      sdkActive: this.last?.sdkActive ?? false,
      gameId: this.last?.game.id ?? null,
      recording: this.recorder.current,
      replayFile: this.replayFile,
      clients,
      ai,
    };
  }

  stop(): void {
    this.source?.stop();
    this.recorder.close();
    if (this.pending) clearTimeout(this.pending);
  }
}
