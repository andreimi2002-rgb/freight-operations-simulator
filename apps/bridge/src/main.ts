import { randomInt } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import type { WikiData } from '@trucksim/core';
import { CoDriver } from './ai.ts';
import { WikiProvider } from './gamedata/wiki.ts';
import { startWorld } from './map/world.ts';
import { BRIDGE_VERSION, loadConfig } from './config.ts';
import { Hub } from './hub.ts';
import { Recorder } from './recorder.ts';
import { startServer } from './server.ts';
import { TripStore } from './store.ts';

const config = loadConfig();

/** Truck Simulator Wiki data for ATS (bundled, CC BY-SA 4.0). */
function loadAtsWiki(): WikiData | null {
  try {
    const read = (f: string) => JSON.parse(readFileSync(join(config.dataDir, 'ats', f), 'utf8'));
    const cities = read('cities.json');
    const data: WikiData = {
      meta: cities.meta,
      cities: cities.cities,
      companies: read('companies.json').companies,
      cargo: read('cargo.json').cargo,
      trucks: read('trucks.json').trucks,
      trailers: read('trailers.json').trailers,
    };
    return data;
  } catch (err) {
    console.warn('[wiki] could not load data/ats:', err instanceof Error ? err.message : err);
    return null;
  }
}

function lanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

const store = new TripStore(join(config.varDir, 'trips.sqlite'));
const recorder = new Recorder(config.recordingsDir, config.record);
const hub = new Hub(store, recorder);
const ai = new CoDriver({ varDir: config.varDir });
const wiki = new WikiProvider(loadAtsWiki());
// Extract game data from the installed games in the background (fast when nothing changed).
void wiki.refresh().catch((err: unknown) => console.warn('[gamedata]', err));
// The whole ETS2 map: loaded from the cache, or built in a worker thread when the game changed.
try {
  startWorld();
} catch (err) {
  console.warn('[world]', err instanceof Error ? err.message : err);
}

let replayPath: string | undefined;
if (config.mode === 'replay') {
  const name = config.replay;
  if (!name) {
    console.error('Replay mode needs --file <recording name or path>.');
    process.exit(1);
  }
  replayPath = [name, join(config.recordingsDir, name), join(config.recordingsDir, 'samples', name)].find((p) => existsSync(p));
  if (!replayPath) {
    console.error(`Recording not found: ${name}`);
    process.exit(1);
  }
}

await hub.setMode(config.mode, { replayPath, replayName: config.replay ?? undefined, speed: config.replaySpeed });
const pairCode = String(randomInt(0, 1_000_000)).padStart(6, '0');
const server = startServer({ config, hub, store, recorder, ai, wiki, pairCode });

/** Link that pairs the app in one tap: the token travels in the #hash, which browsers never send to servers. */
function pairLink(appBase: string, bridgeUrl: string): string {
  const code = Buffer.from(JSON.stringify({ url: bridgeUrl, token: config.token })).toString('base64url');
  return `${appBase}/#pair=${code}`;
}

const lan = lanAddresses();
const publicUrl = process.env.TRUCKSIM_PUBLIC_URL?.replace(/\/$/, '');
console.log(`
TruckSim bridge ${BRIDGE_VERSION}  ·  mode: ${config.mode}  ·  AI: ${ai.provider === 'local' ? 'local rules (set a key in Settings > Copilot AI)' : `${ai.provider} (${ai.model})`}
  Local:     http://localhost:${config.port}
${lan.map((ip) => `  Network:   http://${ip}:${config.port}`).join('\n')}
  Token:     ${config.token}
  Recording: ${config.record ? 'on (recordings/)' : 'off'}

Pair a device on the same Wi-Fi (no microphone over plain HTTP):
${lan.map((ip) => `  ${pairLink(`http://${ip}:${config.port}`, `http://${ip}:${config.port}`)}`).join('\n')}
${publicUrl
  ? `Pair over HTTPS (Tailscale):\n  ${pairLink(publicUrl, publicUrl)}\n  ${pairLink('https://freight-operations-simulator.netlify.app', publicUrl)}`
  : 'For HTTPS (microphone, Netlify app): run "tailscale serve --bg ' + config.port + '" and set TRUCKSIM_PUBLIC_URL. See docs/SETUP.md.'}

  ┌──────────────────────────────────────────┐
  │  COD DE IMPERECHERE PENTRU TELEFON:      │
  │                                          │
  │              ${pairCode.slice(0, 3)} ${pairCode.slice(3)}                     │
  │                                          │
  │  Il introduci in aplicatie daca iti cere │
  │  (se schimba la fiecare pornire).        │
  └──────────────────────────────────────────┘
`);

hub.on('event', (e) => {
  if (e.type.startsWith('game.') || e.type.startsWith('job.')) console.log(`[event] ${e.type}${e.gameId ? ` (${e.gameId})` : ''}`);
});

function shutdown(): void {
  console.log('Stopping bridge...');
  server.close();
  hub.stop();
  store.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
