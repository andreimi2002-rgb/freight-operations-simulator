import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalize, SdkEventDetector } from '../src/normalize.ts';
import { MMF_SIZE, OFFSETS as O, parseScs } from '../src/scs-layout.ts';

function writeStr(b: Buffer, off: number, s: string): void {
  b.write(s, off, 'utf8');
}

/** A synthetic plugin memory block with known values at the documented offsets. */
function sample(): Buffer {
  const b = Buffer.alloc(MMF_SIZE);
  b[O.sdkActive] = 1;
  b.writeBigUInt64LE(123456n, O.time);
  b.writeUInt32LE(12, O.revision);
  b.writeUInt32LE(1, O.game); // ETS2
  b.writeUInt32LE(1, O.versionMajor);
  b.writeUInt32LE(18, O.versionMinor);
  b.writeUInt32LE(4000, O.timeAbs);
  b.writeUInt32LE(4600, O.timeAbsDelivery);
  b.writeUInt32LE(1, O.maxTrailerCount);
  b.writeUInt32LE(341, O.plannedDistanceKm);
  b.writeInt32LE(300, O.restStop);
  b.writeInt32LE(9, O.gearDashboard);
  b.writeFloatLE(19, O.scale);
  b.writeFloatLE(800, O.fuelCapacity);
  b.writeFloatLE(15400, O.cargoMass);
  b.writeFloatLE(25, O.speed); // m/s
  b.writeFloatLE(352.5, O.fuel);
  b.writeFloatLE(1060, O.fuelRange);
  b.writeFloatLE(184321.5, O.odometer);
  b.writeFloatLE(298000, O.routeDistance); // m
  b.writeFloatLE(14400, O.routeTime); // s
  b.writeFloatLE(25, O.speedLimit);
  b[O.isCargoLoaded] = 1;
  b[O.engineEnabled] = 1;
  b.writeDoubleLE(12345.5, O.coordinateX);
  b.writeDoubleLE(-6789.25, O.coordinateZ);
  b.writeDoubleLE(0.25, O.rotationX); // west
  writeStr(b, O.truckBrand, 'Scania');
  writeStr(b, O.cargoId, 'chocolate');
  writeStr(b, O.cargo, 'Chocolate');
  writeStr(b, O.cityDstId, 'ruse');
  writeStr(b, O.cityDst, 'Ruse');
  writeStr(b, O.citySrcId, 'brasov');
  writeStr(b, O.citySrc, 'Brașov');
  writeStr(b, O.compSrcId, 'subse');
  writeStr(b, O.compSrc, 'Subse');
  b.writeBigUInt64LE(7840n, O.jobIncome);
  b[O.onJob] = 1;
  b[O.trailerBase + 80] = 1; // trailer 0 attached
  return b;
}

test('parses the plugin layout at the documented offsets', () => {
  const r = parseScs(sample());
  assert.equal(r.revision, 12);
  assert.equal(r.game, 1);
  assert.equal(r.cargo, 'Chocolate');
  assert.equal(r.citySrc, 'Brașov');
  assert.equal(r.jobIncome, 7840);
  assert.equal(r.coordinateX, 12345.5);
  assert.equal(r.trailers.length, 1);
  assert.equal(r.trailers[0]!.attached, true);
});

test('normalizes units and keeps unknown values null', () => {
  const s = normalize(parseScs(sample()), 1000, true);
  assert.equal(s.game.id, 'ets2');
  assert.equal(s.game.version, '1.18');
  assert.equal(Math.round(s.truck.speedKmh!), 90);
  assert.equal(Math.round(s.navigation.speedLimitKmh!), 90);
  assert.equal(s.navigation.distanceKm, 298);
  assert.equal(s.navigation.timeMin, 240);
  assert.equal(s.truck.adblueCapacityL, null, 'no AdBlue tank configured: null, not 0');
  assert.equal(s.job?.destinationCompany, null, 'empty string becomes null');
  assert.equal(s.job?.deadlineAbsMin, 4600);
  assert.equal(s.position?.headingDeg, 270, 'SDK 0.25 (west, counter-clockwise) is 270° clockwise');
  assert.equal(s.truck.gear, 9);
});

test('inactive game produces sdkActive=false', () => {
  const s = normalize(parseScs(sample()), 1000, false);
  assert.equal(s.sdkActive, false);
});

test('gameplay flags become one event on the rising edge', () => {
  const det = new SdkEventDetector();
  const b = sample();
  const snap = normalize(parseScs(b), 0, true);
  assert.deepEqual(det.next(parseScs(b), snap), []);
  b[O.fined] = 1;
  b.writeBigInt64LE(450n, O.fineAmount);
  writeStr(b, O.fineOffence, 'speeding');
  const ev = det.next(parseScs(b), snap);
  assert.equal(ev.length, 1);
  assert.equal(ev[0]!.type, 'fine');
  assert.equal(ev[0]!.amount, 450);
  assert.equal(ev[0]!.details?.offence, 'speeding');
  assert.deepEqual(det.next(parseScs(b), snap), [], 'flag still set: no duplicate');
});
