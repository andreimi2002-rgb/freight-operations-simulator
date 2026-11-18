import type { DataSource, Snapshot } from './types.ts';

/** A snapshot that says "no game data": every value unknown. */
export function emptySnapshot(source: DataSource, ts: number): Snapshot {
  return {
    v: 1,
    source,
    ts,
    sdkActive: false,
    game: { id: null, version: null, pluginRevision: null, timeScale: null, timeAbsMin: null, restStopMin: null, paused: false },
    truck: {
      brand: null, name: null, licensePlate: null, speedKmh: null, cruiseControlOn: false, cruiseControlKmh: null,
      engineRpm: null, engineRpmMax: null, gear: null, gearsForward: null, fuelL: null, fuelCapacityL: null,
      fuelAvgLPerKm: null, fuelRangeKm: null, adblueL: null, adblueCapacityL: null, odometerKm: null,
      engineOn: false, electricOn: false, parkingBrake: false, engineBrake: false, oilTempC: null, waterTempC: null,
      oilPressurePsi: null, airPressurePsi: null, batteryVoltage: null,
      wear: { engine: null, transmission: null, cabin: null, chassis: null, wheels: null },
      warnings: {
        fuel: false, adblue: false, airPressure: false, airPressureEmergency: false, oilPressure: false,
        waterTemperature: false, batteryVoltage: false,
      },
      lights: { parking: false, lowBeam: false, highBeam: false, beacon: false, hazard: false, blinkerLeft: false, blinkerRight: false },
    },
    trailers: [],
    job: null,
    navigation: { distanceKm: null, timeMin: null, speedLimitKmh: null },
    position: null,
  };
}

/** Age-based staleness, the same rule everywhere. */
export function isStale(snap: Snapshot | null, now: number, afterMs = 3000): boolean {
  return !snap || now - snap.ts > afterMs;
}
