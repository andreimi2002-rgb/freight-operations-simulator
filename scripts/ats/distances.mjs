#!/usr/bin/env node
// Estimated road distances between the cities in data/ats/cities.json.
//
// Method: one table request to the public OSRM demo server (car profile, OpenStreetMap data,
// ODbL) between the real-world city coordinates. ATS is built at 1:20 scale with game time
// running about 20x faster, so the distances the game shows are expected to be close to real
// road distances; this is an assumption to check against a few in-game job distances
// (calibrationFactor in meta, 1 = not calibrated yet).
//
//   node scripts/ats/distances.mjs            (uses .cache/wiki)
//   node scripts/ats/distances.mjs --refresh
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createClient } from './lib/wiki-client.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const client = createClient({ cacheDir: join(root, '.cache/wiki'), refresh: process.argv.includes('--refresh'), log: console.error });
const { cities } = JSON.parse(readFileSync(join(root, 'data/ats/cities.json'), 'utf8'));
const located = cities.filter((c) => c.coordinates);
const coords = located.map((c) => `${c.coordinates.lon.toFixed(5)},${c.coordinates.lat.toFixed(5)}`).join(';');
const url = `https://router.project-osrm.org/table/v1/driving/${coords}?annotations=distance,duration`;
const res = await client.getJson(url);
if (res.code !== 'Ok') throw new Error(`OSRM: ${res.code} ${res.message ?? ''}`);

const pairs = [];
const missing = [];
for (let i = 0; i < located.length; i++) {
  for (let j = 0; j < located.length; j++) {
    if (i === j) continue;
    const m = res.distances[i][j];
    const s = res.durations[i][j];
    if (m == null) { missing.push(`${located[i].id}→${located[j].id}`); continue; }
    pairs.push({ from: located[i].id, to: located[j].id, km: Math.round(m / 100) / 10, carMinutes: Math.round(s / 60) });
  }
}
const retrieved = new Date().toISOString().slice(0, 10);
writeFileSync(join(root, 'data/ats/distances.json'), `${JSON.stringify({
  meta: {
    description: 'Estimated road distances between cities (real-world roads). Estimate, not game data.',
    provenance: 'estimated',
    basis: 'Shortest car route between the real-world city coordinates on OpenStreetMap roads (OSRM). ATS uses a 1:20 map scale with game time about 20x faster (SCS blog, The Rescale, 2016), so in-game distances should be close to real road distances; to be checked against in-game job distances.',
    calibrationFactor: 1,
    calibrated: false,
    source: 'OSRM demo server (router.project-osrm.org), OpenStreetMap data',
    licence: 'ODbL 1.0',
    licenceUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
    attribution: '© OpenStreetMap contributors',
    retrieved,
    generator: 'scripts/ats/distances.mjs',
    count: pairs.length,
  },
  pairs,
}, null, 2)}\n`);
console.log(JSON.stringify({ cities: located.length, pairs: pairs.length, missing, network: client.stats() }));
