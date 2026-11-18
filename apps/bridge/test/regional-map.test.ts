import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { DemoSimulator } from '@trucksim/core';
import { nearbyCity, nextRouteTurn, type RegionalMap } from '../../../packages/core/src/regional-map.ts';
import { findInstall } from '../src/gamedata/store.ts';
import { regionalMapGzip, routeToCity } from '../src/map/regional.ts';

const install = findInstall('ets2');
const hasDlc = install !== null && existsSync(join(install, 'dlc_balkan_e.scs'));

test('extracts roads and visible city labels from the installed ETS2 regional DLC', {
  skip: hasDlc ? false : 'Road to the Black Sea not installed',
}, () => {
  const gzip = regionalMapGzip();
  assert.ok(gzip);
  const map = JSON.parse(gunzipSync(gzip).toString()) as RegionalMap;
  assert.ok(map.roads.length > 1000);
  assert.ok(map.roads.every((road) => road.length >= 2 && road.flat().every(Number.isFinite)));
  assert.equal(map.cities.find((city) => city.id === 'brasov')?.country, 'romania');
  assert.equal(map.cities.find((city) => city.id === 'ruse')?.country, 'bulgaria');
  assert.ok(map.junctions && map.junctions.length > 1000);
  assert.ok(map.demoRoute && map.demoRoute.length > 2);
  assert.equal(map.demoDestination, 'ruse');
  const nearCity = (id: string, [x, z]: [number, number]) => {
    const city = map.cities.find((candidate) => candidate.id === id);
    return city && Math.hypot(x - city.position[0], z - city.position[1]) <= 350;
  };
  assert.ok(nearCity('brasov', map.demoRoute[0]!));
  assert.ok(map.demoRoute.some((point) => nearCity('bucuresti', point)));
  assert.ok(nearCity('ruse', map.demoRoute.at(-1)!));
  const roadEdges = new Set([...map.roads, ...map.junctions].flatMap((road) => road.slice(1).flatMap((point, i) => [
    JSON.stringify([road[i], point]), JSON.stringify([point, road[i]]),
  ])));
  assert.ok(map.demoRoute.slice(1).every((point, i) =>
    roadEdges.has(JSON.stringify([map.demoRoute![i], point])),
  ), 'Each demo segment exists in the extracted road network');
  const simulator = new DemoSimulator(0, map.demoRoute, map.demoDestination);
  const first = simulator.tick(1000).snapshot;
  const second = simulator.tick(2000).snapshot;
  assert.equal(first.demoRoute, 'regional');
  assert.equal(first.source, 'demo');
  assert.equal(first.navigation.speedLimitKmh, null);
  assert.deepEqual([first.position?.x, first.position?.z], map.demoRoute[0]);
  assert.notDeepEqual(second.position, first.position);
  assert.equal(first.job?.destinationCity, 'Ruse');
  let delivered = 0;
  for (let ts = 3000; ts <= 3_000_000; ts += 1000) {
    const { events, snapshot } = simulator.tick(ts);
    delivered += events.filter((event) => event.type === 'job.delivered').length;
    if (!snapshot.job) {
      assert.ok(nearCity('ruse', [snapshot.position!.x, snapshot.position!.z]));
      break;
    }
  }
  assert.equal(delivered, 1);
  const roadStart: [number, number] = [57_843, 23_938];
  const planned = routeToCity('ruse', roadStart, 254);
  assert.ok(planned && planned.points.length > 2);
  assert.ok(Math.hypot(planned.points[0]![0] - roadStart[0], planned.points[0]![1] - roadStart[1]) <= 45);
  assert.ok(nearCity('ruse', planned.points.at(-1)!));
  assert.equal(nearbyCity(map.cities, { x: roadStart[0], z: roadStart[1] })?.id, 'brasov');
  const left = { points: [[0, 150], [0, 0], [-100, 0]], turns: [{ index: 1, direction: 'left' }] } as const;
  const testPlan = { points: left.points.map(([x, z]): [number, number] => [x, z]), turns: [...left.turns] };
  assert.deepEqual(nextRouteTurn(testPlan, { x: 0, z: 100, headingDeg: 0 }), { direction: 'left', mapMetres: 100 });
  assert.deepEqual(nextRouteTurn(testPlan, { x: 0, z: 25, headingDeg: 0 }), { direction: 'left', mapMetres: 25 });
  assert.equal(nextRouteTurn(testPlan, { x: -30, z: 0, headingDeg: 270 }), null);
  assert.equal(routeToCity('unknown', roadStart, 254), null);
  assert.equal(routeToCity('ruse', [0, 0], 254), null);
  assert.equal(regionalMapGzip(), gzip);
});
