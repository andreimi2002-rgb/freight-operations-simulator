import { makeEvent, type GameEvent, type GameId, type JobState, type Snapshot } from '@trucksim/core';
import type { RawScs } from './scs-layout.ts';

const MS_TO_KMH = 3.6;

function gameId(n: number): GameId | null {
  return n === 1 ? 'ets2' : n === 2 ? 'ats' : null;
}

/** Empty strings and non-finite numbers become null. */
const s = (v: string): string | null => (v.trim() === '' ? null : v);
const n = (v: number): number | null => (Number.isFinite(v) ? v : null);
/** A capacity of 0 means "not configured" (e.g. no AdBlue tank), so null. */
const pos = (v: number): number | null => (Number.isFinite(v) && v > 0 ? v : null);

export function normalize(raw: RawScs, ts: number, active: boolean): Snapshot {
  const id = gameId(raw.game);
  const hasJob = raw.onJob || (raw.cargoId !== '' && raw.cityDstId !== '');
  const job: JobState | null = hasJob
    ? {
        cargo: s(raw.cargo),
        cargoId: s(raw.cargoId),
        cargoMassKg: pos(raw.cargoMass),
        cargoDamage: n(raw.cargoDamage),
        cargoLoaded: raw.isCargoLoaded,
        sourceCity: s(raw.citySrc),
        sourceCityId: s(raw.citySrcId),
        sourceCompany: s(raw.compSrc),
        sourceCompanyId: s(raw.compSrcId),
        destinationCity: s(raw.cityDst),
        destinationCityId: s(raw.cityDstId),
        destinationCompany: s(raw.compDst),
        destinationCompanyId: s(raw.compDstId),
        income: raw.jobIncome > 0 ? raw.jobIncome : null,
        // 0xFFFFFFFF is used for jobs without a deadline.
        deadlineAbsMin: raw.timeAbsDelivery > 0 && raw.timeAbsDelivery < 0xffffffff ? raw.timeAbsDelivery : null,
        plannedDistanceKm: pos(raw.plannedDistanceKm),
        market: s(raw.jobMarket),
        specialTransport: raw.specialJob,
      }
    : null;

  const hasPosition = raw.coordinateX !== 0 || raw.coordinateZ !== 0;
  const routeKm = raw.routeDistance > 0 ? raw.routeDistance / 1000 : null;

  return {
    v: 1,
    source: 'live',
    ts,
    sdkActive: active && raw.sdkActive,
    game: {
      id,
      version: raw.versionMajor || raw.versionMinor ? `${raw.versionMajor}.${raw.versionMinor}` : null,
      pluginRevision: raw.revision || null,
      timeScale: pos(raw.scale),
      timeAbsMin: raw.timeAbs > 0 ? raw.timeAbs : null,
      restStopMin: Number.isFinite(raw.restStop) && raw.restStop !== 0 ? raw.restStop : null,
      paused: raw.paused,
    },
    truck: {
      brand: s(raw.truckBrand),
      name: s(raw.truckName),
      licensePlate: s(raw.truckLicensePlate),
      speedKmh: n(Math.abs(raw.speed) * MS_TO_KMH),
      cruiseControlOn: raw.cruiseControl,
      cruiseControlKmh: raw.cruiseControl ? n(raw.cruiseControlSpeed * MS_TO_KMH) : null,
      engineRpm: n(raw.engineRpm),
      engineRpmMax: pos(raw.engineRpmMax),
      gear: raw.gearDashboard,
      gearsForward: pos(raw.gears),
      fuelL: n(raw.fuel),
      fuelCapacityL: pos(raw.fuelCapacity),
      fuelAvgLPerKm: pos(raw.fuelAvgConsumption),
      fuelRangeKm: n(raw.fuelRange),
      adblueL: pos(raw.adblueCapacity) === null ? null : n(raw.adblue),
      adblueCapacityL: pos(raw.adblueCapacity),
      odometerKm: pos(raw.odometer),
      engineOn: raw.engineEnabled,
      electricOn: raw.electricEnabled,
      parkingBrake: raw.parkBrake,
      engineBrake: raw.motorBrake,
      oilTempC: n(raw.oilTemperature),
      waterTempC: n(raw.waterTemperature),
      oilPressurePsi: n(raw.oilPressure),
      airPressurePsi: n(raw.airPressure),
      batteryVoltage: n(raw.batteryVoltage),
      wear: {
        engine: n(raw.wearEngine),
        transmission: n(raw.wearTransmission),
        cabin: n(raw.wearCabin),
        chassis: n(raw.wearChassis),
        wheels: n(raw.wearWheels),
      },
      warnings: {
        fuel: raw.fuelWarning,
        adblue: raw.adblueWarning,
        airPressure: raw.airPressureWarning,
        airPressureEmergency: raw.airPressureEmergency,
        oilPressure: raw.oilPressureWarning,
        waterTemperature: raw.waterTemperatureWarning,
        batteryVoltage: raw.batteryVoltageWarning,
      },
      lights: {
        parking: raw.lightsParking,
        lowBeam: raw.lightsBeamLow,
        highBeam: raw.lightsBeamHigh,
        beacon: raw.lightsBeacon,
        hazard: raw.lightsHazard,
        blinkerLeft: raw.blinkerLeftOn,
        blinkerRight: raw.blinkerRightOn,
      },
    },
    trailers: raw.trailers.map((t) => ({
      attached: t.attached,
      name: s(t.name),
      brand: s(t.brand),
      bodyType: s(t.bodyType),
      licensePlate: s(t.licensePlate),
      cargoDamage: n(t.cargoDamage),
      wear: { chassis: n(t.wearChassis), wheels: n(t.wearWheels), body: n(t.wearBody) },
    })),
    job,
    navigation: {
      distanceKm: routeKm,
      timeMin: routeKm !== null && raw.routeTime > 0 ? raw.routeTime / 60 : null,
      speedLimitKmh: raw.speedLimit > 0 ? raw.speedLimit * MS_TO_KMH : null,
    },
    position: hasPosition
      ? {
          x: raw.coordinateX,
          y: raw.coordinateY,
          z: raw.coordinateZ,
          // SDK heading: 0..1, 0 = north, counter-clockwise. Ours: degrees clockwise.
          headingDeg: (((1 - raw.rotationX) * 360) % 360 + 360) % 360,
          pitchDeg: raw.rotationY * 360,
          rollDeg: raw.rotationZ * 360,
        }
      : null,
  };
}

/**
 * Turns the plugin's gameplay event flags into events. The plugin raises a
 * flag when the event happens and clears it a few seconds later, so only
 * rising edges count.
 */
export class SdkEventDetector {
  private prev: RawScs | null = null;

  reset(): void {
    this.prev = null;
  }

  next(raw: RawScs, snap: Snapshot): GameEvent[] {
    const p = this.prev;
    this.prev = raw;
    if (!p) return [];
    const rose = (k: 'jobDelivered' | 'jobCancelled' | 'fined' | 'tollgate' | 'ferry' | 'train' | 'refuelPayed') => raw[k] && !p[k];
    const out: GameEvent[] = [];
    if (rose('jobDelivered')) {
      out.push(makeEvent('job.delivered', snap, {
        amount: raw.jobDeliveredRevenue,
        details: {
          xp: raw.jobDeliveredEarnedXp,
          cargoDamage: raw.jobDeliveredCargoDamage,
          distanceKm: raw.jobDeliveredDistanceKm,
          autoParked: raw.jobDeliveredAutoparkUsed,
          deliveryTimeMin: raw.jobDeliveredDeliveryTime,
        },
      }));
    }
    if (rose('jobCancelled')) out.push(makeEvent('job.cancelled', snap, { amount: raw.jobCancelledPenalty }));
    if (rose('fined')) out.push(makeEvent('fine', snap, { amount: raw.fineAmount, details: { offence: raw.fineOffence || null } }));
    if (rose('tollgate')) out.push(makeEvent('tollgate', snap, { amount: raw.tollgatePayAmount }));
    if (rose('ferry')) out.push(makeEvent('ferry', snap, { amount: raw.ferryPayAmount, details: { from: raw.ferrySourceName || null, to: raw.ferryTargetName || null } }));
    if (rose('train')) out.push(makeEvent('train', snap, { amount: raw.trainPayAmount, details: { from: raw.trainSourceName || null, to: raw.trainTargetName || null } }));
    if (rose('refuelPayed')) out.push(makeEvent('refuel', snap, { details: { litres: Math.round(raw.refuelAmount) } }));
    return out;
  }
}
