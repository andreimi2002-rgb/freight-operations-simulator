import type { GameEvent, Snapshot, Trip, TripPoint } from './types.ts';

const PATH_MIN_DISTANCE_M = 150;
const PATH_MAX_POINTS = 4000;

function tripId(snap: Snapshot): string {
  return `${snap.game.id ?? 'game'}-${snap.ts.toString(36)}`;
}

/**
 * Builds trip records (one per job) from the snapshot and event stream.
 * A delivery is recorded exactly once: the first `job.delivered` or
 * `job.cancelled` closes the trip and later duplicates are ignored.
 */
export class TripTracker {
  private trip: Trip | null = null;
  private startOdometer: number | null = null;
  private lastFuel: number | null = null;
  private fuelUsed = 0;
  private lastPoint: TripPoint | null = null;

  private readonly onFinish: (trip: Trip) => void;
  private readonly onUpdate: ((trip: Trip) => void) | undefined;

  constructor(onFinish: (trip: Trip) => void, onUpdate?: (trip: Trip) => void) {
    this.onFinish = onFinish;
    this.onUpdate = onUpdate;
  }

  get active(): Trip | null {
    return this.trip;
  }

  /** Feed every snapshot, then the events produced for it. */
  update(snap: Snapshot, events: GameEvent[]): void {
    for (const ev of events) this.handleEvent(snap, ev);
    const t = this.trip;
    if (!t || !snap.sdkActive) return;

    if (snap.game.id && t.gameId && snap.game.id !== t.gameId) {
      this.finish(snap, 'abandoned');
      return;
    }

    const odo = snap.truck.odometerKm;
    if (odo !== null) {
      this.startOdometer ??= odo;
      t.drivenKm = Math.max(0, odo - this.startOdometer);
    }
    const fuel = snap.truck.fuelL;
    if (fuel !== null) {
      if (this.lastFuel !== null && fuel < this.lastFuel) this.fuelUsed += this.lastFuel - fuel;
      this.lastFuel = fuel;
      t.fuelUsedL = this.fuelUsed;
    }
    const speed = snap.truck.speedKmh;
    if (speed !== null) t.maxSpeedKmh = Math.max(t.maxSpeedKmh ?? 0, speed);
    if (snap.job?.cargoDamage != null) t.cargoDamage = snap.job.cargoDamage;

    const p = snap.position;
    if (p) {
      const lp = this.lastPoint;
      if (!lp || Math.hypot(p.x - lp.x, p.z - lp.z) >= PATH_MIN_DISTANCE_M) {
        const point = { x: Math.round(p.x), z: Math.round(p.z), ts: snap.ts };
        this.lastPoint = point;
        t.path.push(point);
        if (t.path.length > PATH_MAX_POINTS) t.path = t.path.filter((_, i) => i % 2 === 0);
      }
    }
    this.onUpdate?.(t);
  }

  private handleEvent(snap: Snapshot, ev: GameEvent): void {
    switch (ev.type) {
      case 'job.started':
        if (this.trip) this.finish(snap, 'abandoned');
        this.start(snap);
        break;
      case 'job.delivered':
        if (this.trip) {
          this.trip.revenue = ev.amount ?? null;
          const d = ev.details ?? {};
          if (typeof d.xp === 'number') this.trip.xp = d.xp;
          if (typeof d.cargoDamage === 'number') this.trip.cargoDamage = d.cargoDamage;
          if (typeof d.autoParked === 'boolean') this.trip.autoParked = d.autoParked;
          if (typeof d.distanceKm === 'number' && d.distanceKm > 0) this.trip.drivenKm = d.distanceKm;
          this.trip.events.push(ev);
          this.finish(snap, 'delivered');
        }
        break;
      case 'job.cancelled':
        if (this.trip) {
          this.trip.revenue = ev.amount != null ? -Math.abs(ev.amount) : null;
          this.trip.events.push(ev);
          this.finish(snap, 'cancelled');
        }
        break;
      case 'fine':
        if (this.trip) {
          this.trip.fines += ev.amount ?? 0;
          this.trip.events.push(ev);
        }
        break;
      case 'tollgate':
        if (this.trip) {
          this.trip.tolls += ev.amount ?? 0;
          this.trip.events.push(ev);
        }
        break;
      case 'ferry':
      case 'train':
      case 'refuel':
        this.trip?.events.push(ev);
        break;
      default:
        break;
    }
  }

  private start(snap: Snapshot): void {
    const j = snap.job;
    this.startOdometer = snap.truck.odometerKm;
    this.lastFuel = snap.truck.fuelL;
    this.fuelUsed = 0;
    this.lastPoint = null;
    this.trip = {
      id: tripId(snap),
      gameId: snap.game.id,
      status: 'active',
      startedAt: snap.ts,
      endedAt: null,
      startGameMin: snap.game.timeAbsMin,
      endGameMin: null,
      cargo: j?.cargo ?? null,
      cargoId: j?.cargoId ?? null,
      cargoMassKg: j?.cargoMassKg ?? null,
      sourceCity: j?.sourceCity ?? null,
      sourceCityId: j?.sourceCityId ?? null,
      sourceCompany: j?.sourceCompany ?? null,
      sourceCompanyId: j?.sourceCompanyId ?? null,
      destinationCity: j?.destinationCity ?? null,
      destinationCityId: j?.destinationCityId ?? null,
      destinationCompany: j?.destinationCompany ?? null,
      destinationCompanyId: j?.destinationCompanyId ?? null,
      plannedDistanceKm: j?.plannedDistanceKm ?? null,
      drivenKm: 0,
      fuelUsedL: 0,
      income: j?.income ?? null,
      revenue: null,
      xp: null,
      cargoDamage: j?.cargoDamage ?? null,
      autoParked: null,
      fines: 0,
      tolls: 0,
      maxSpeedKmh: null,
      truck: [snap.truck.brand, snap.truck.name].filter(Boolean).join(' ') || null,
      events: [],
      path: [],
      source: snap.source,
    };
  }

  private finish(snap: Snapshot, status: Trip['status']): void {
    const t = this.trip;
    if (!t) return;
    t.status = status;
    t.endedAt = snap.ts;
    t.endGameMin = snap.game.timeAbsMin;
    this.trip = null;
    this.onFinish(t);
  }
}
