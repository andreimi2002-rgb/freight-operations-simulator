import test from 'node:test';
import assert from 'node:assert/strict';
import {CARGO, EQUIPMENT, ROUTES, generateMission, validateMission} from '../src/mission-engine.mjs';

const fixedNow = new Date('2026-10-19T09:00:00.000Z');
const stableRandom = () => 0.42;

for (const world of ['ATS', 'ETS2']) {
  test(`${world} generated missions satisfy cargo/equipment and numeric invariants`, () => {
    for (const cargoId of Object.keys(CARGO)) {
      const mission = generateMission({world, cargoId, region:'any', operatingStyle:'realistic', random:stableRandom, now:fixedNow});
      assert.deepEqual(validateMission(mission), []);
      assert.ok((mission.cargo.gameReference?.equipmentIds ?? mission.cargo.equipmentIds).includes(mission.equipment.id));
      assert.ok(mission.weightKg <= EQUIPMENT[mission.equipment.id].samplePayloadLimitKg);
      assert.ok(mission.weightKg >= mission.cargo.weightKg[0]);
      assert.ok(mission.distance.value > 0);
      assert.ok(mission.travel.drivingHours > 0);
      assert.ok(mission.travel.deadline > mission.createdAt);
      assert.equal(mission.distance.unit, world === 'ATS' ? 'mi' : 'km');
      assert.equal(mission.fuel.unit, world === 'ATS' ? 'gal US' : 'L');
      assert.equal(mission.route.status, 'illustrative');
      if (mission.cargo.gameReference) assert.ok(mission.cargo.gameReference.id);
      assert.match(mission.carrier.status, /game-reference-only/);
    }
  });
}

test('catalog contains only ATS and ETS2 routes for this milestone', () => {
  assert.ok(ROUTES.length > 0);
  assert.deepEqual([...new Set(ROUTES.map(route => route.world))].sort(), ['ATS','ETS2']);
});

test('route region mismatch fails clearly instead of silently changing the selection', () => {
  assert.throws(() => generateMission({world:'ATS', region:'north', random:stableRandom, now:fixedNow}), /No sample routes/);
});

test('invalid cargo and future logistics mode are rejected', () => {
  assert.throws(() => generateMission({world:'ATS', cargoId:'unknown', random:stableRandom, now:fixedNow}), /Unknown cargo/);
  assert.throws(() => generateMission({world:'REAL', random:stableRandom, now:fixedNow}), /Unknown transport world/);
});

