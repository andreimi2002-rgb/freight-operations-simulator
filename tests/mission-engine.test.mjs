import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CARGO, EQUIPMENT, WORLD_MODES, generateMission, validateMission} from '../src/mission-engine.mjs';
import {COMPANY_DIRECTORY, FREIGHT_LANES, NETWORK_SOURCES} from '../src/data/freight-network.mjs';

const cityCatalog = JSON.parse(readFileSync(new URL('../src/data/geonames-cities.json', import.meta.url), 'utf8'));

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

test('specific cargo and trailer selection stays compatible', () => {
  const mission = generateMission({world:'ATS', origin, destination, route, cargoId:'apples', equipmentId:'reefer', random:stableRandom, now:fixedNow});
  assert.equal(mission.cargo.id, 'apples');
  assert.equal(mission.equipment.id, 'reefer');
  assert.ok(mission.cargo.varietyExamples.includes('Gala'));
  assert.throws(() => generateMission({world:'ATS', origin, destination, route, cargoId:'apples', equipmentId:'grainHopper', random:stableRandom, now:fixedNow}), /not listed as a planning match/);
  const filteredDraw = generateMission({world:'ATS', origin, destination, route, cargoId:'random', equipmentId:'multiTemperatureReefer', random:stableRandom, now:fixedNow});
  assert.ok(filteredDraw.cargo.equipmentIds.includes('multiTemperatureReefer'));
  assert.equal(filteredDraw.equipment.id, 'multiTemperatureReefer');
});

test('all cargo equipment references and freight corridor cargo references resolve', () => {
  for (const cargo of Object.values(CARGO)) {
    assert.ok(cargo.equipmentIds.length > 0, `${cargo.id} has at least one suggested trailer`);
    for (const equipmentId of cargo.equipmentIds) assert.ok(EQUIPMENT[equipmentId], `${cargo.id} references ${equipmentId}`);
  }
  for (const equipmentId of Object.keys(EQUIPMENT)) {
    assert.ok(Object.values(CARGO).some(cargo => cargo.equipmentIds.includes(equipmentId)), `${equipmentId} is selectable for at least one cargo`);
  }
  for (const lane of FREIGHT_LANES) {
    assert.ok(WORLD_MODES[lane.world], `${lane.id} belongs to a supported world`);
    assert.ok(lane.cargoIds.length > 0, `${lane.id} has a cargo profile`);
    for (const cargoId of lane.cargoIds) assert.ok(CARGO[cargoId], `${lane.id} references ${cargoId}`);
    for (const endpoint of [lane.origin, lane.destination]) {
      assert.ok(cityCatalog.cities.some(city =>
        city.name === endpoint.city && city.countryCode === endpoint.countryCode && city.worlds.includes(lane.world)),
      `${lane.id} endpoint ${endpoint.city} exists in the sourced city catalog`);
    }
    for (const sourceId of lane.sourceIds) assert.ok(NETWORK_SOURCES[sourceId], `${lane.id} references ${sourceId}`);
    for (const companyId of lane.companyIds) assert.ok(COMPANY_DIRECTORY.some(company => company.id === companyId), `${lane.id} references ${companyId}`);
  }
});

test('company search directory only contains sourced HTTPS official links', () => {
  assert.ok(COMPANY_DIRECTORY.length >= 20);
  for (const company of COMPANY_DIRECTORY) {
    assert.match(company.website, /^https:\/\//);
    assert.ok(company.query.length > 3);
    assert.ok(company.worlds.some(world => WORLD_MODES[world]));
  }
});
