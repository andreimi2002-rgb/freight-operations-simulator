import { makeEvent } from './events.ts';
import type { MapPoint, RegionalMap } from './regional-map.ts';
import type { GameEvent, JobState, Snapshot, TruckState } from './types.ts';

/**
 * Synthetic drive used by DEMO mode, in the browser and in the bridge.
 * Everything here is invented for display purposes and is always shown
 * with a DEMO badge. The scenario follows the reference case of the plan
 * (ETS2, Brașov → Ruse, chocolate); the destination company is left
 * unknown on purpose, to exercise the "no invented data" paths.
 */

const TIME_SCALE = 19; // ETS2 normal roads
const PLANNED_KM = 341; // as the in-game GPS would show it
const WORLD_KM = PLANNED_KM / TIME_SCALE; // distance the truck actually covers in world metres
const FUEL_CAPACITY = 800;
const LITRES_PER_KM = 0.33; // per displayed km
const START_GAME_MIN = 8 * 60 + 15; // Monday 08:15

// Route shape in world metres (x east, z south), roughly heading south-south-west.
const WAYPOINTS: Array<[number, number]> = [
  [0, 0], [380, 900], [1200, 1700], [1500, 3100], [1150, 4600], [1700, 6200],
  [2900, 7300], [3400, 8900], [3100, 10400], [3600, 12100], [4800, 13300],
  [5200, 14800], [4900, 16300], [5400, 17400],
];

// Speed limit by progress (fraction of route), km/h.
const LIMITS: Array<[number, number]> = [
  [0, 50], [0.03, 90], [0.22, 60], [0.26, 90], [0.55, 50], [0.58, 90], [0.9, 60], [0.96, 40],
];

interface Segment { x0: number; z0: number; x1: number; z1: number; len: number; start: number }

function buildSegments(points: MapPoint[]): { segs: Segment[]; total: number } {
  const segs: Segment[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i]!;
    const [x1, z1] = points[i + 1]!;
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (!len) continue;
    segs.push({ x0, z0, x1, z1, len, start: total });
    total += len;
  }
  return { segs, total };
}

const schematic = buildSegments(WAYPOINTS);
// Preserve the original offline scenario's planned distance.
const k = WORLD_KM * 1000 / schematic.total;
const DEFAULT_ROUTE: MapPoint[] = WAYPOINTS.map(([x, z]) => [x * k, z * k]);
const DEFAULT_SEGMENTS = buildSegments(DEFAULT_ROUTE);

function limitAt(f: number): number {
  let l = LIMITS[0]![1];
  for (const [at, v] of LIMITS) if (f >= at) l = v;
  return l;
}

function pointAt(distM: number, { segs, total }: ReturnType<typeof buildSegments>): { x: number; z: number; headingDeg: number } {
  const d = Math.min(Math.max(distM, 0), total);
  const seg = segs.find((s) => d <= s.start + s.len) ?? segs[segs.length - 1]!;
  const t = seg.len === 0 ? 0 : (d - seg.start) / seg.len;
  const x = seg.x0 + (seg.x1 - seg.x0) * t;
  const z = seg.z0 + (seg.z1 - seg.z0) * t;
  // Heading: 0 = north (−z), clockwise.
  const headingDeg = ((Math.atan2(seg.x1 - seg.x0, -(seg.z1 - seg.z0)) * 180) / Math.PI + 360) % 360;
  return { x, z, headingDeg };
}

export interface DemoTick {
  snapshot: Snapshot;
  events: GameEvent[];
}

export class DemoSimulator {
  private distM = 0;
  private speedMs = 0;
  private lastTs: number | null = null;
  private gameMin = START_GAME_MIN;
  private fuel = FUEL_CAPACITY * 0.46;
  private odometer = 184_250;
  private phase: 'driving' | 'delivered' = 'driving';
  private phaseSince = 0;
  private tolled = false;
  private delivered = false;
  private jobActive = true;
  private wobble = 0;
  private readonly path: ReturnType<typeof buildSegments>;
  private readonly plannedKm: number;
  private readonly regional: boolean;
  private readonly regionalDestination: RegionalMap['demoDestination'];

  /** @param startFraction start part-way along the route (0..1). */
  constructor(startFraction = 0.08, roadRoute?: MapPoint[] | null, destination?: RegionalMap['demoDestination']) {
    const path = roadRoute && buildSegments(roadRoute);
    this.regional = Boolean(path && path.total > 0);
    this.regionalDestination = this.regional ? destination : undefined;
    this.path = path && path.total > 0 ? path : DEFAULT_SEGMENTS;
    this.plannedKm = this.regional ? this.path.total / 1000 * TIME_SCALE : PLANNED_KM;
    this.distM = this.path.total * startFraction;
    this.odometer += this.plannedKm * startFraction;
    this.fuel -= this.plannedKm * startFraction * LITRES_PER_KM;
    this.gameMin += ((this.distM / 22) * TIME_SCALE) / 60;
    this.speedMs = 22;
  }

  tick(now: number): DemoTick {
    const dt = this.lastTs === null ? 0 : Math.min((now - this.lastTs) / 1000, 1);
    this.lastTs = now;
    const events: GameEvent[] = [];
    const progress = this.distM / this.path.total;

    if (this.phase === 'driving') {
      const limit = limitAt(progress);
      this.wobble += dt * 0.35;
      // Mostly obeys the limit; overshoots a bit around 40% to show the speeding warning.
      const overshoot = progress > 0.38 && progress < 0.41 ? 14 : 0;
      const remainingM = this.path.total - this.distM;
      const stopFactor = Math.min(1, remainingM / 350);
      const target = ((limit - 3 + overshoot + Math.sin(this.wobble) * 2.5) / 3.6) * Math.max(stopFactor, 0.12);
      const accel = target > this.speedMs ? 0.9 : 1.6;
      this.speedMs += Math.sign(target - this.speedMs) * Math.min(Math.abs(target - this.speedMs), accel * dt);
      this.speedMs = Math.max(0, this.speedMs);
      const moved = this.speedMs * dt;
      this.distM += moved;
      const displayedKm = (moved / 1000) * TIME_SCALE;
      this.odometer += displayedKm;
      this.fuel = Math.max(0, this.fuel - displayedKm * LITRES_PER_KM);
      this.gameMin += (dt * TIME_SCALE) / 60;

      if (!this.regional && !this.tolled && progress > 0.93) {
        this.tolled = true;
        events.push(makeEvent('tollgate', this.meta(now), { amount: 12 }));
      }
      if (remainingM < 4 && !this.delivered) {
        this.delivered = true;
        this.phase = 'delivered';
        this.phaseSince = now;
        this.speedMs = 0;
        events.push(
          makeEvent('job.delivered', this.meta(now), {
            amount: 7840,
            details: { xp: 512, cargoDamage: 0.004, autoParked: false, distanceKm: this.plannedKm },
          }),
        );
        this.jobActive = false;
      }
    } else {
      this.gameMin += (dt * TIME_SCALE) / 60;
      if (now - this.phaseSince > 12_000) this.restart();
    }

    return { snapshot: this.snapshot(now), events };
  }

  private restart(): void {
    this.distM = 0;
    this.speedMs = 0;
    this.phase = 'driving';
    this.tolled = false;
    this.delivered = false;
    this.jobActive = true;
    this.fuel = FUEL_CAPACITY * 0.9;
  }

  private meta(now: number): Pick<Snapshot, 'ts' | 'game'> {
    return { ts: now, game: this.game() };
  }

  private game(): Snapshot['game'] {
    return {
      id: 'ets2',
      version: '1.53',
      pluginRevision: 12,
      timeScale: TIME_SCALE,
      timeAbsMin: Math.floor(this.gameMin),
      restStopMin: Math.max(0, Math.round(5 * 60 - (this.gameMin - START_GAME_MIN))),
      paused: false,
    };
  }

  snapshot(now: number): Snapshot {
    const progress = this.distM / this.path.total;
    const p = pointAt(this.distM, this.path);
    const speedKmh = this.speedMs * 3.6;
    const gear = speedKmh < 1 ? 0 : Math.min(12, Math.max(1, Math.round(speedKmh / 7.5)));
    const rpm = speedKmh < 1 ? 650 : 1050 + ((speedKmh % 7.5) / 7.5) * 400;
    const remainingKm = (Math.max(0, this.path.total - this.distM) / 1000) * TIME_SCALE;
    const truck: TruckState = {
      brand: 'Scania',
      name: 'S (demo)',
      licensePlate: 'BV 19 SIM',
      speedKmh,
      cruiseControlOn: speedKmh > 70,
      cruiseControlKmh: speedKmh > 70 ? limitAt(progress) - 3 : null,
      engineRpm: rpm,
      engineRpmMax: 2500,
      gear,
      gearsForward: 12,
      fuelL: this.fuel,
      fuelCapacityL: FUEL_CAPACITY,
      fuelAvgLPerKm: LITRES_PER_KM,
      fuelRangeKm: this.fuel / LITRES_PER_KM,
      adblueL: 64,
      adblueCapacityL: 80,
      odometerKm: this.odometer,
      engineOn: true,
      electricOn: true,
      parkingBrake: this.phase === 'delivered',
      engineBrake: false,
      oilTempC: 96,
      waterTempC: 88,
      oilPressurePsi: 52,
      airPressurePsi: 128,
      batteryVoltage: 27.6,
      wear: { engine: 0.012, transmission: 0.009, cabin: 0.004, chassis: 0.011, wheels: 0.021 },
      warnings: {
        fuel: this.fuel < FUEL_CAPACITY * 0.15,
        adblue: false,
        airPressure: false,
        airPressureEmergency: false,
        oilPressure: false,
        waterTemperature: false,
        batteryVoltage: false,
      },
      lights: {
        parking: true, lowBeam: true, highBeam: false, beacon: false, hazard: false,
        blinkerLeft: false, blinkerRight: false,
      },
    };
    const job: JobState | null = this.jobActive
      ? {
          cargo: 'Chocolate',
          cargoId: 'chocolate',
          cargoMassKg: 15_400,
          cargoDamage: 0.004,
          cargoLoaded: true,
          sourceCity: 'Brașov',
          sourceCityId: 'brasov',
          sourceCompany: this.regional ? null : 'Subse',
          sourceCompanyId: this.regional ? null : 'subse',
          destinationCity: this.regional && !this.regionalDestination ? 'Zona Brașov' : 'Ruse',
          destinationCityId: this.regional && !this.regionalDestination ? null : 'ruse',
          destinationCompany: null,
          destinationCompanyId: null,
          income: 7840,
          deadlineAbsMin: START_GAME_MIN + 10 * 60,
          plannedDistanceKm: this.plannedKm,
          market: 'freight_market',
          specialTransport: false,
        }
      : null;
    return {
      v: 1,
      source: 'demo',
      ...(this.regional ? { demoRoute: 'regional' as const } : {}),
      ts: now,
      sdkActive: true,
      game: this.game(),
      truck,
      trailers: [
        {
          attached: true,
          // Chocolate goes in a dry van or curtainsider in the game files.
          id: 'krone.dryliner.single_3.dryvan',
          name: 'Dry Liner',
          brand: 'Krone',
          brandId: 'krone',
          bodyType: 'dryvan',
          chainType: 'single',
          wheels: 6,
          licensePlate: null,
          cargoDamage: 0.004,
          wear: { chassis: 0.01, wheels: 0.02, body: 0.008 },
        },
      ],
      job,
      navigation: {
        distanceKm: this.jobActive ? remainingKm : null,
        timeMin: this.jobActive ? (remainingKm / 72) * 60 : null,
        speedLimitKmh: this.regional ? null : limitAt(progress),
      },
      position: { x: p.x, y: 0, z: p.z, headingDeg: p.headingDeg, pitchDeg: 0, rollDeg: 0 },
    };
  }

  /** The full demo route, for drawing it on the map. */
  static route(): Array<{ x: number; z: number }> {
    const pts: Array<{ x: number; z: number }> = [];
    for (let d = 0; d <= DEFAULT_SEGMENTS.total; d += 100) {
      const p = pointAt(d, DEFAULT_SEGMENTS);
      pts.push({ x: p.x, z: p.z });
    }
    return pts;
  }
}
