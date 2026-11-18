/**
 * Layout of the shared memory written by RenCloud's scs-sdk-plugin
 * (scs-telemetry.dll, revision 12), "Local\\SCSTelemetry", 32 KiB.
 * Offsets follow scs-telemetry-common.hpp (zones start at fixed offsets).
 * Only the fields this app uses are read.
 */

export const MMF_NAME = 'Local\\SCSTelemetry';
export const MMF_SIZE = 32 * 1024;
export const SUPPORTED_REVISION = 12;

const STRING = 64;
const TRAILER_BASE = 6000;
const TRAILER_SIZE = 1560;

export interface RawTrailer {
  attached: boolean;
  cargoDamage: number;
  wearChassis: number;
  wearWheels: number;
  wearBody: number;
  id: string;
  bodyType: string;
  brand: string;
  name: string;
  licensePlate: string;
}

export interface RawScs {
  sdkActive: boolean;
  paused: boolean;
  time: bigint;
  revision: number;
  versionMajor: number;
  versionMinor: number;
  game: number; // 0 unknown, 1 ets2, 2 ats
  timeAbs: number;
  gears: number;
  timeAbsDelivery: number;
  maxTrailerCount: number;
  plannedDistanceKm: number;
  jobDeliveredDeliveryTime: number;
  restStop: number;
  gear: number;
  gearDashboard: number;
  jobDeliveredEarnedXp: number;
  scale: number;
  fuelCapacity: number;
  adblueCapacity: number;
  engineRpmMax: number;
  cargoMass: number;
  speed: number;
  engineRpm: number;
  cruiseControlSpeed: number;
  airPressure: number;
  fuel: number;
  fuelAvgConsumption: number;
  fuelRange: number;
  adblue: number;
  oilPressure: number;
  oilTemperature: number;
  waterTemperature: number;
  batteryVoltage: number;
  wearEngine: number;
  wearTransmission: number;
  wearCabin: number;
  wearChassis: number;
  wearWheels: number;
  odometer: number;
  routeDistance: number;
  routeTime: number;
  speedLimit: number;
  jobDeliveredCargoDamage: number;
  jobDeliveredDistanceKm: number;
  refuelAmount: number;
  cargoDamage: number;
  isCargoLoaded: boolean;
  specialJob: boolean;
  parkBrake: boolean;
  motorBrake: boolean;
  airPressureWarning: boolean;
  airPressureEmergency: boolean;
  fuelWarning: boolean;
  adblueWarning: boolean;
  oilPressureWarning: boolean;
  waterTemperatureWarning: boolean;
  batteryVoltageWarning: boolean;
  electricEnabled: boolean;
  engineEnabled: boolean;
  blinkerLeftOn: boolean;
  blinkerRightOn: boolean;
  lightsParking: boolean;
  lightsBeamLow: boolean;
  lightsBeamHigh: boolean;
  lightsBeacon: boolean;
  lightsHazard: boolean;
  cruiseControl: boolean;
  jobDeliveredAutoparkUsed: boolean;
  coordinateX: number;
  coordinateY: number;
  coordinateZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  truckBrand: string;
  truckName: string;
  cargoId: string;
  cargo: string;
  cityDstId: string;
  cityDst: string;
  compDstId: string;
  compDst: string;
  citySrcId: string;
  citySrc: string;
  compSrcId: string;
  compSrc: string;
  truckLicensePlate: string;
  jobMarket: string;
  fineOffence: string;
  ferrySourceName: string;
  ferryTargetName: string;
  trainSourceName: string;
  trainTargetName: string;
  jobIncome: number;
  jobCancelledPenalty: number;
  jobDeliveredRevenue: number;
  fineAmount: number;
  tollgatePayAmount: number;
  ferryPayAmount: number;
  trainPayAmount: number;
  onJob: boolean;
  jobFinished: boolean;
  jobCancelled: boolean;
  jobDelivered: boolean;
  fined: boolean;
  tollgate: boolean;
  ferry: boolean;
  train: boolean;
  refuel: boolean;
  refuelPayed: boolean;
  trailers: RawTrailer[];
}

function str(b: Buffer, off: number, len = STRING): string {
  const end = b.indexOf(0, off);
  const stop = end === -1 || end > off + len ? off + len : end;
  return b.toString('utf8', off, stop);
}
const bool = (b: Buffer, off: number) => b[off] !== 0;
const u32 = (b: Buffer, off: number) => b.readUInt32LE(off);
const i32 = (b: Buffer, off: number) => b.readInt32LE(off);
const f32 = (b: Buffer, off: number) => b.readFloatLE(off);
const f64 = (b: Buffer, off: number) => b.readDoubleLE(off);
const i64 = (b: Buffer, off: number) => Number(b.readBigInt64LE(off));
const u64n = (b: Buffer, off: number) => Number(b.readBigUInt64LE(off));

function trailer(b: Buffer, i: number): RawTrailer {
  const o = TRAILER_BASE + i * TRAILER_SIZE;
  return {
    attached: bool(b, o + 80),
    cargoDamage: f32(b, o + 152),
    wearChassis: f32(b, o + 156),
    wearWheels: f32(b, o + 160),
    wearBody: f32(b, o + 164),
    id: str(b, o + 920),
    bodyType: str(b, o + 1048),
    brand: str(b, o + 1176),
    name: str(b, o + 1240),
    licensePlate: str(b, o + 1368),
  };
}

export function parseScs(b: Buffer): RawScs {
  if (b.length < TRAILER_BASE) throw new Error(`Telemetry buffer too small: ${b.length}`);
  const maxTrailerCount = u32(b, 92);
  const trailers: RawTrailer[] = [];
  const n = Math.min(Math.max(maxTrailerCount, 1), 10);
  for (let i = 0; i < n; i++) {
    if (TRAILER_BASE + (i + 1) * TRAILER_SIZE > b.length) break;
    const t = trailer(b, i);
    if (t.attached || t.id) trailers.push(t);
  }
  return {
    sdkActive: bool(b, 0),
    paused: bool(b, 4),
    time: b.readBigUInt64LE(8),
    revision: u32(b, 40),
    versionMajor: u32(b, 44),
    versionMinor: u32(b, 48),
    game: u32(b, 52),
    timeAbs: u32(b, 64),
    gears: u32(b, 68),
    timeAbsDelivery: u32(b, 88),
    maxTrailerCount,
    plannedDistanceKm: u32(b, 100),
    jobDeliveredDeliveryTime: u32(b, 440),
    restStop: i32(b, 500),
    gear: i32(b, 504),
    gearDashboard: i32(b, 508),
    jobDeliveredEarnedXp: i32(b, 640),
    scale: f32(b, 700),
    fuelCapacity: f32(b, 704),
    adblueCapacity: f32(b, 712),
    engineRpmMax: f32(b, 740),
    cargoMass: f32(b, 748),
    speed: f32(b, 948),
    engineRpm: f32(b, 952),
    cruiseControlSpeed: f32(b, 988),
    airPressure: f32(b, 992),
    fuel: f32(b, 1000),
    fuelAvgConsumption: f32(b, 1004),
    fuelRange: f32(b, 1008),
    adblue: f32(b, 1012),
    oilPressure: f32(b, 1016),
    oilTemperature: f32(b, 1020),
    waterTemperature: f32(b, 1024),
    batteryVoltage: f32(b, 1028),
    wearEngine: f32(b, 1036),
    wearTransmission: f32(b, 1040),
    wearCabin: f32(b, 1044),
    wearChassis: f32(b, 1048),
    wearWheels: f32(b, 1052),
    odometer: f32(b, 1056),
    routeDistance: f32(b, 1060),
    routeTime: f32(b, 1064),
    speedLimit: f32(b, 1068),
    jobDeliveredCargoDamage: f32(b, 1456),
    jobDeliveredDistanceKm: f32(b, 1460),
    refuelAmount: f32(b, 1464),
    cargoDamage: f32(b, 1468),
    isCargoLoaded: bool(b, 1564),
    specialJob: bool(b, 1565),
    parkBrake: bool(b, 1566),
    motorBrake: bool(b, 1567),
    airPressureWarning: bool(b, 1568),
    airPressureEmergency: bool(b, 1569),
    fuelWarning: bool(b, 1570),
    adblueWarning: bool(b, 1571),
    oilPressureWarning: bool(b, 1572),
    waterTemperatureWarning: bool(b, 1573),
    batteryVoltageWarning: bool(b, 1574),
    electricEnabled: bool(b, 1575),
    engineEnabled: bool(b, 1576),
    blinkerLeftOn: bool(b, 1580),
    blinkerRightOn: bool(b, 1581),
    lightsParking: bool(b, 1582),
    lightsBeamLow: bool(b, 1583),
    lightsBeamHigh: bool(b, 1584),
    lightsBeacon: bool(b, 1585),
    lightsHazard: bool(b, 1588),
    cruiseControl: bool(b, 1589),
    jobDeliveredAutoparkUsed: bool(b, 1613),
    coordinateX: f64(b, 2200),
    coordinateY: f64(b, 2208),
    coordinateZ: f64(b, 2216),
    rotationX: f64(b, 2224),
    rotationY: f64(b, 2232),
    rotationZ: f64(b, 2240),
    truckBrand: str(b, 2364),
    truckName: str(b, 2492),
    cargoId: str(b, 2556),
    cargo: str(b, 2620),
    cityDstId: str(b, 2684),
    cityDst: str(b, 2748),
    compDstId: str(b, 2812),
    compDst: str(b, 2876),
    citySrcId: str(b, 2940),
    citySrc: str(b, 3004),
    compSrcId: str(b, 3068),
    compSrc: str(b, 3132),
    truckLicensePlate: str(b, 3212),
    jobMarket: str(b, 3404, 32),
    fineOffence: str(b, 3436, 32),
    ferrySourceName: str(b, 3468),
    ferryTargetName: str(b, 3532),
    trainSourceName: str(b, 3724),
    trainTargetName: str(b, 3788),
    jobIncome: u64n(b, 4000),
    jobCancelledPenalty: i64(b, 4200),
    jobDeliveredRevenue: i64(b, 4208),
    fineAmount: i64(b, 4216),
    tollgatePayAmount: i64(b, 4224),
    ferryPayAmount: i64(b, 4232),
    trainPayAmount: i64(b, 4240),
    onJob: bool(b, 4300),
    jobFinished: bool(b, 4301),
    jobCancelled: bool(b, 4302),
    jobDelivered: bool(b, 4303),
    fined: bool(b, 4304),
    tollgate: bool(b, 4305),
    ferry: bool(b, 4306),
    train: bool(b, 4307),
    refuel: bool(b, 4308),
    refuelPayed: bool(b, 4309),
    trailers,
  };
}

/** Offsets used by tests to build synthetic buffers. */
export const OFFSETS = {
  sdkActive: 0, paused: 4, time: 8, revision: 40, versionMajor: 44, versionMinor: 48, game: 52, timeAbs: 64,
  timeAbsDelivery: 88, maxTrailerCount: 92, plannedDistanceKm: 100, restStop: 500, gearDashboard: 508,
  jobDeliveredEarnedXp: 640, scale: 700, fuelCapacity: 704, cargoMass: 748, speed: 948, fuel: 1000,
  fuelRange: 1008, odometer: 1056, routeDistance: 1060, routeTime: 1064, speedLimit: 1068,
  isCargoLoaded: 1564, engineEnabled: 1576, coordinateX: 2200, coordinateZ: 2216, rotationX: 2224,
  truckBrand: 2364, cargoId: 2556, cargo: 2620, cityDstId: 2684, cityDst: 2748, compDstId: 2812, compDst: 2876,
  citySrcId: 2940, citySrc: 3004, compSrcId: 3068, compSrc: 3132, jobIncome: 4000, jobDeliveredRevenue: 4208,
  fineAmount: 4216, fineOffence: 3436, tollgatePayAmount: 4224, onJob: 4300, jobDelivered: 4303, fined: 4304, tollgate: 4305,
  trailerBase: TRAILER_BASE, trailerSize: TRAILER_SIZE,
} as const;
