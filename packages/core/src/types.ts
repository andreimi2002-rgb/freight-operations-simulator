/**
 * Common telemetry model for ATS and ETS2.
 *
 * Rules (from the master plan):
 * - Unknown values are `null`, never 0.
 * - Every snapshot carries its source and timestamp; the client decides
 *   whether it is stale.
 * - Units are SI-ish and game-independent: km/h, litres, km, °C, kg.
 *   Display units (mph, gallons, lb) are a UI concern.
 */

export type GameId = 'ets2' | 'ats';

/** Where a snapshot came from. Shown on every screen. */
export type DataSource = 'live' | 'replay' | 'demo';

/** Confidence levels used for derived or matched information. */
export type Confidence = 'confirmed' | 'derived' | 'probable' | 'unknown';

export interface GameInfo {
  id: GameId | null;
  /** Game version from the SDK, e.g. "1.53". */
  version: string | null;
  /** Telemetry plugin revision (RenCloud scs-sdk-plugin). */
  pluginRevision: number | null;
  /** Time scale of the world (19 in ETS2, 20 in ATS for normal roads). */
  timeScale: number | null;
  /** In-game time, minutes since the start of the game world (day 0 = Monday 00:00). */
  timeAbsMin: number | null;
  /** In-game minutes until the driver must rest (sleep); null when fatigue is off or unknown. */
  restStopMin: number | null;
  paused: boolean;
}

export interface Wear {
  engine: number | null;
  transmission: number | null;
  cabin: number | null;
  chassis: number | null;
  wheels: number | null;
}

export interface TruckWarnings {
  fuel: boolean;
  adblue: boolean;
  airPressure: boolean;
  airPressureEmergency: boolean;
  oilPressure: boolean;
  waterTemperature: boolean;
  batteryVoltage: boolean;
}

export interface TruckState {
  brand: string | null;
  name: string | null;
  licensePlate: string | null;
  speedKmh: number | null;
  cruiseControlOn: boolean;
  cruiseControlKmh: number | null;
  engineRpm: number | null;
  engineRpmMax: number | null;
  /** Gear as shown on the dashboard: >0 forward, <0 reverse, 0 neutral. */
  gear: number | null;
  gearsForward: number | null;
  fuelL: number | null;
  fuelCapacityL: number | null;
  /** Average consumption in litres per km. */
  fuelAvgLPerKm: number | null;
  /** Range estimated by the game, km. */
  fuelRangeKm: number | null;
  adblueL: number | null;
  adblueCapacityL: number | null;
  odometerKm: number | null;
  engineOn: boolean;
  electricOn: boolean;
  parkingBrake: boolean;
  engineBrake: boolean;
  oilTempC: number | null;
  waterTempC: number | null;
  oilPressurePsi: number | null;
  airPressurePsi: number | null;
  batteryVoltage: number | null;
  wear: Wear;
  warnings: TruckWarnings;
  lights: {
    parking: boolean;
    lowBeam: boolean;
    highBeam: boolean;
    beacon: boolean;
    hazard: boolean;
    blinkerLeft: boolean;
    blinkerRight: boolean;
  };
}

export interface TrailerState {
  attached: boolean;
  name: string | null;
  brand: string | null;
  bodyType: string | null;
  licensePlate: string | null;
  cargoDamage: number | null;
  wear: { chassis: number | null; wheels: number | null; body: number | null };
}

export interface JobState {
  cargo: string | null;
  cargoId: string | null;
  cargoMassKg: number | null;
  cargoDamage: number | null;
  cargoLoaded: boolean;
  sourceCity: string | null;
  sourceCityId: string | null;
  sourceCompany: string | null;
  sourceCompanyId: string | null;
  destinationCity: string | null;
  destinationCityId: string | null;
  destinationCompany: string | null;
  destinationCompanyId: string | null;
  /** Payment in game currency (EUR for ETS2, USD for ATS). */
  income: number | null;
  /** Absolute game minute of the delivery deadline; null for jobs without one. */
  deadlineAbsMin: number | null;
  plannedDistanceKm: number | null;
  /** cargo_market, quick_job, freight_market, external_contracts, external_market. */
  market: string | null;
  specialTransport: boolean;
}

export interface NavigationState {
  /** Distance left on the in-game GPS route, km, as the in-game GPS shows it. */
  distanceKm: number | null;
  /**
   * Time left on the in-game GPS route, in game minutes (SDK navigation.time / 60).
   * To validate against the in-game GPS on a live run: see docs/VALIDATION.md.
   */
  timeMin: number | null;
  speedLimitKmh: number | null;
}

export interface Position {
  /** World coordinates in metres. x = east, z = south, y = up. */
  x: number;
  y: number;
  z: number;
  /** Heading in degrees, 0 = north, clockwise. */
  headingDeg: number;
  pitchDeg: number;
  rollDeg: number;
}

export interface Snapshot {
  v: 1;
  source: DataSource;
  /** Wall-clock time the snapshot was taken (epoch ms). */
  ts: number;
  /** True when the game is running and the SDK delivers data. */
  sdkActive: boolean;
  game: GameInfo;
  truck: TruckState;
  trailers: TrailerState[];
  /** null when there is no active job. */
  job: JobState | null;
  navigation: NavigationState;
  position: Position | null;
}

/** Gameplay events: from SDK event flags or derived from snapshot changes. */
export type GameEventType =
  | 'game.connected'
  | 'game.disconnected'
  | 'game.switched'
  | 'job.started'
  | 'job.delivered'
  | 'job.cancelled'
  | 'fine'
  | 'tollgate'
  | 'ferry'
  | 'train'
  | 'refuel'
  | 'warning.fuel'
  | 'warning.rest'
  | 'speeding';

export interface GameEvent {
  id: string;
  type: GameEventType;
  ts: number;
  gameId: GameId | null;
  /** Game time when it happened, minutes. */
  gameTimeMin: number | null;
  /** Amount of money involved (fine, toll, revenue), game currency. */
  amount?: number | null;
  /** Short machine-readable details (offence, ferry route, xp...). */
  details?: Record<string, string | number | boolean | null>;
}

export interface TripPoint {
  x: number;
  z: number;
  ts: number;
}

export interface Trip {
  id: string;
  gameId: GameId | null;
  status: 'active' | 'delivered' | 'cancelled' | 'abandoned';
  startedAt: number;
  endedAt: number | null;
  startGameMin: number | null;
  endGameMin: number | null;
  cargo: string | null;
  cargoId: string | null;
  cargoMassKg: number | null;
  sourceCity: string | null;
  sourceCityId: string | null;
  sourceCompany: string | null;
  sourceCompanyId: string | null;
  destinationCity: string | null;
  destinationCityId: string | null;
  destinationCompany: string | null;
  destinationCompanyId: string | null;
  plannedDistanceKm: number | null;
  /** Odometer difference, km. */
  drivenKm: number | null;
  fuelUsedL: number | null;
  income: number | null;
  revenue: number | null;
  xp: number | null;
  cargoDamage: number | null;
  autoParked: boolean | null;
  fines: number;
  tolls: number;
  maxSpeedKmh: number | null;
  truck: string | null;
  events: GameEvent[];
  path: TripPoint[];
  source: DataSource;
}

/** Messages on the bridge WebSocket. */
export type ServerMessage =
  | { type: 'hello'; bridgeVersion: string; mode: BridgeMode; source: DataSource | null }
  | { type: 'snapshot'; data: Snapshot }
  | { type: 'event'; data: GameEvent }
  | { type: 'status'; data: BridgeStatus };

export type BridgeMode = 'live' | 'demo' | 'replay';

export interface BridgeStatus {
  mode: BridgeMode;
  /** Shared memory of the telemetry plugin is present. */
  pluginDetected: boolean;
  sdkActive: boolean;
  gameId: GameId | null;
  recording: string | null;
  replayFile: string | null;
  clients: number;
  ai: { provider: 'gemini' | 'claude' | 'local'; model: string | null };
}
