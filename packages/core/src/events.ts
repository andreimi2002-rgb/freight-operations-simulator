import type { GameEvent, GameEventType, Snapshot } from './types.ts';

let counter = 0;
export function makeEvent(
  type: GameEventType,
  snap: Pick<Snapshot, 'ts' | 'game'>,
  extra: Partial<Pick<GameEvent, 'amount' | 'details'>> = {},
): GameEvent {
  counter = (counter + 1) % 1_000_000;
  return {
    id: `${snap.ts.toString(36)}-${counter.toString(36)}`,
    type,
    ts: snap.ts,
    gameId: snap.game.id,
    gameTimeMin: snap.game.timeAbsMin,
    ...extra,
  };
}

export interface DerivedEventOptions {
  /** Fuel range (km) under which a low-fuel warning is raised once. */
  lowFuelRangeKm: number;
  /** Game minutes before the rest deadline when a warning is raised once. */
  restWarningMin: number;
  /** Tolerance over the speed limit, km/h, held for `speedingHoldMs`. */
  speedingToleranceKmh: number;
  speedingHoldMs: number;
}

export const defaultDerivedEventOptions: DerivedEventOptions = {
  lowFuelRangeKm: 120,
  restWarningMin: 90,
  speedingToleranceKmh: 8,
  speedingHoldMs: 4000,
};

/**
 * Derives events that the SDK does not flag directly by comparing
 * consecutive snapshots. SDK gameplay events (delivered, fined, toll...)
 * are produced by the source itself.
 */
export class DerivedEventDetector {
  private prev: Snapshot | null = null;
  private lowFuelRaised = false;
  private restRaised = false;
  private speedingSince: number | null = null;
  private speedingRaised = false;
  private readonly opts: DerivedEventOptions;

  constructor(opts: Partial<DerivedEventOptions> = {}) {
    this.opts = { ...defaultDerivedEventOptions, ...opts };
  }

  reset(): void {
    this.prev = null;
    this.lowFuelRaised = false;
    this.restRaised = false;
    this.speedingSince = null;
    this.speedingRaised = false;
  }

  next(snap: Snapshot): GameEvent[] {
    const out: GameEvent[] = [];
    const prev = this.prev;
    this.prev = snap;

    if (!prev || prev.sdkActive !== snap.sdkActive) {
      if (snap.sdkActive) out.push(makeEvent('game.connected', snap));
      else if (prev) out.push(makeEvent('game.disconnected', snap));
    }
    if (prev && prev.game.id && snap.game.id && prev.game.id !== snap.game.id) {
      out.push(makeEvent('game.switched', snap, { details: { from: prev.game.id, to: snap.game.id } }));
      this.lowFuelRaised = false;
      this.restRaised = false;
    }
    if (!snap.sdkActive) return out;

    // A job appears: new contract accepted (or the game was loaded with one).
    const jobKey = (s: Snapshot | null) =>
      s?.job ? `${s.job.sourceCompanyId}|${s.job.destinationCompanyId}|${s.job.cargoId}|${s.job.deadlineAbsMin}` : null;
    const pk = jobKey(prev);
    const nk = jobKey(snap);
    if (nk && nk !== pk) {
      out.push(
        makeEvent('job.started', snap, {
          amount: snap.job?.income ?? null,
          details: {
            cargo: snap.job?.cargo ?? null,
            from: snap.job?.sourceCity ?? null,
            to: snap.job?.destinationCity ?? null,
          },
        }),
      );
    }

    const range = snap.truck.fuelRangeKm;
    if (range !== null) {
      if (!this.lowFuelRaised && (range < this.opts.lowFuelRangeKm || snap.truck.warnings.fuel)) {
        this.lowFuelRaised = true;
        out.push(makeEvent('warning.fuel', snap, { details: { rangeKm: Math.round(range) } }));
      } else if (this.lowFuelRaised && range > this.opts.lowFuelRangeKm * 2) {
        this.lowFuelRaised = false;
      }
    }

    const rest = snap.game.restStopMin;
    if (rest !== null) {
      if (!this.restRaised && rest > 0 && rest <= this.opts.restWarningMin) {
        this.restRaised = true;
        out.push(makeEvent('warning.rest', snap, { details: { minutes: rest } }));
      } else if (this.restRaised && rest > this.opts.restWarningMin * 2) {
        this.restRaised = false;
      }
    }

    const speed = snap.truck.speedKmh;
    const limit = snap.navigation.speedLimitKmh;
    if (speed !== null && limit !== null && limit > 0 && speed > limit + this.opts.speedingToleranceKmh) {
      this.speedingSince ??= snap.ts;
      if (!this.speedingRaised && snap.ts - this.speedingSince >= this.opts.speedingHoldMs) {
        this.speedingRaised = true;
        out.push(makeEvent('speeding', snap, { details: { speedKmh: Math.round(speed), limitKmh: Math.round(limit) } }));
      }
    } else {
      this.speedingSince = null;
      this.speedingRaised = false;
    }

    return out;
  }
}
