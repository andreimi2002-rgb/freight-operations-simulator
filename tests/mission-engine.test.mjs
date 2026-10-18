import test from 'node:test';
import assert from 'node:assert/strict';
import {CARGO, EQUIPMENT, WORLD_MODES, generateMission, validateMission} from '../src/mission-engine.mjs';

const origin = {id:'place-a', name:'Seattle', address:'Seattle, WA, USA', lat:47.6062, lon:-122.3321, sourceName:'Geoapify', retrievedAt:'2026-10-19T09:00:00.000Z'};
const destination = {id:'place-b', name:'Spokane', address:'Spokane, WA, USA', lat:47.6588, lon:-117.4260, sourceName:'Geoapify', retrievedAt:'2026-10-19T09:00:00.000Z'};
const route = {distanceMeters:450000, durationSeconds:18000, provider:'Geoapify Routing API', profile:'truck', sourceUrl:'https://apidocs.geoapify.com/docs/routing/', retrievedAt:'2026-10-19T09:00:00.000Z'};
const fixedNow = new Date('2026-10-19T09:00:00.000Z');
const stableRandom = () => 0.42;

for (const world of Object.keys(WORLD_MODES)) {
  test(`${world} scenarios retain real sourced endpoints and route data`, () => {
    for (const cargoId of Object.keys(CARGO)) {
      const mission = generateMission({world, origin, destination, route, cargoId, random:stableRandom, now:fixedNow});
      assert.deepEqual(validateMission(mission), []);
      assert.equal(mission.origin.id, origin.id);
      assert.equal(mission.destination.id, destination.id);
      assert.equal(mission.route.distanceMeters, route.distanceMeters);
      assert.ok(CARGO[mission.cargo.id].equipmentIds.includes(mission.equipment.id));
      assert.ok(EQUIPMENT[mission.equipment.id]);
      assert.equal(mission.isSimulated, true);
      assert.equal(mission.route.unit, world === 'ATS' ? 'mi' : 'km');
      assert.equal(mission.cargo.status, 'generated-planning-scenario');
    }
  });
}

test('only ATS and ETS2 modes are supported at this stage', () => {
  assert.deepEqual(Object.keys(WORLD_MODES).sort(), ['ATS','ETS2']);
});

test('unknown cargo, missing route, and future modes are rejected', () => {
  assert.throws(() => generateMission({world:'ATS', origin, destination, route, cargoId:'unknown', random:stableRandom, now:fixedNow}), /Unknown cargo/);
  assert.throws(() => generateMission({world:'ATS', origin, destination, cargoId:'dryGoods', random:stableRandom, now:fixedNow}), /Search for a real origin/);
  assert.throws(() => generateMission({world:'REAL', origin, destination, route, random:stableRandom, now:fixedNow}), /Unknown transport world/);
});
