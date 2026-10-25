#!/usr/bin/env node
// States a route crosses between every pair of cities, on the roads of our map
// (data/map/ats-map.json, Natural Earth). A job needs the map DLC of every state it drives
// through, not only the states of its two ends (e.g. California → Washington crosses Oregon).
//
// For each pair: shortest path on the map's road graph (the same one that draws a job's
// route), then the length of the path inside each state polygon. A state counts when at
// least MIN_KM of the route lies in it, so a road running along a border does not add the
// neighbour. Only the states other than the two ends are stored ("via").
//
//   node scripts/map/route-states.mjs   → data/ats/route-states.json
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { buildRoadGraph, routeBetween } from '../../src/engine/roadgraph.mjs';
import { statesCrossed } from '../../src/engine/route-states.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const map = JSON.parse(readFileSync(join(root, 'data/map/ats-map.json'), 'utf8'));
const graph = buildRoadGraph(map.roads);
const cities = [...map.cities].sort((a, b) => a.id.localeCompare(b.id));

const via = {};
const noRoute = [];
let counted = 0;
for (let i = 0; i < cities.length; i++) {
  for (let j = i + 1; j < cities.length; j++) {
    const a = cities[i];
    const b = cities[j];
    const route = routeBetween(graph, a.xy, b.xy);
    if (!route) { noRoute.push(`${a.id}|${b.id}`); continue; }
    counted++;
    const crossed = statesCrossed(route.points, map.states).filter((s) => s !== a.state && s !== b.state);
    if (crossed.length) via[`${a.id}|${b.id}`] = crossed;
  }
}

writeFileSync(join(root, 'data/ats/route-states.json'), `${JSON.stringify({
  meta: {
    description: 'States crossed by the route between two cities, besides the states of the two cities, on the roads of the Freight World map. Key "a|b" with the two city ids in alphabetical order (the same both ways); pairs that cross no other state are left out. Computed, not game data: the in-game road network may differ.',
    method: 'shortest path on the road graph of data/map/ats-map.json, cut into pieces of at most 2 km; a state counts when at least 5 km of the path lie inside it',
    source: 'Natural Earth 1:10m roads and admin-1 states (public domain), via data/map/ats-map.json',
    generator: 'scripts/map/route-states.mjs',
    computed: new Date().toISOString().slice(0, 10),
  },
  noRoute,
  via,
}, null, 2)}\n`);
console.log(JSON.stringify({ pairs: counted, withVia: Object.keys(via).length, noRoute: noRoute.length }));
