import { useSyncExternalStore } from 'react';
import type { RegionalMap } from '../../../../packages/core/src/regional-map.ts';
import {
  DemoSimulator,
  DerivedEventDetector,
  isStale,
  TripTracker,
  type BridgeStatus,
  type GameEvent,
  type ServerMessage,
  type Snapshot,
  type Trip,
} from '@trucksim/core';
import { getSettings, subscribeSettings, updateSettings, type Settings } from './settings';
import { saveLocalTrip } from './localTrips';

/**
 * One store for everything live: the latest snapshot, connection state,
 * recent events and the position trail. Sources: the in-browser demo
 * simulator, or the bridge on the PC over WebSocket.
 */

export type LinkState = 'demo' | 'connecting' | 'connected' | 'unauthorized' | 'offline' | 'unconfigured';

export interface TelemetryState {
  link: LinkState;
  linkError: string | null;
  snapshot: Snapshot | null;
  status: BridgeStatus | null;
  events: GameEvent[];
  trail: Array<{ x: number; z: number }>;
  /** Bumped every time a trip finishes (so lists can refresh). */
  tripsVersion: number;
  activeTrip: Trip | null;
}

let state: TelemetryState = {
  link: 'unconfigured',
  linkError: null,
  snapshot: null,
  status: null,
  events: [],
  trail: [],
  tripsVersion: 0,
  activeTrip: null,
};

const listeners = new Set<() => void>();
const eventListeners = new Set<(e: GameEvent) => void>();

function set(patch: Partial<TelemetryState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function onGameEvent(cb: (e: GameEvent) => void): () => void {
  eventListeners.add(cb);
  return () => eventListeners.delete(cb);
}

const TRAIL_MAX = 3000;
const TRAIL_STEP_M = 25;

function pushSnapshot(snap: Snapshot, events: GameEvent[]): void {
  // A different source (live, demo, replay) or game means a different world: start a new trail.
  const prev = state.snapshot;
  const switched = prev && (prev.source !== snap.source || (prev.game.id && snap.game.id && prev.game.id !== snap.game.id));
  let trail = switched ? [] : state.trail;
  const p = snap.position;
  if (p && snap.sdkActive) {
    const last = trail[trail.length - 1];
    if (last && Math.hypot(p.x - last.x, p.z - last.z) > 5000) trail = []; // teleport (ferry, train, profile load)
    if (!last || Math.hypot(p.x - last.x, p.z - last.z) >= TRAIL_STEP_M) {
      trail = [...trail, { x: p.x, z: p.z }];
      if (trail.length > TRAIL_MAX) trail = trail.slice(-TRAIL_MAX);
    }
  }
  const evs = events.length ? [...events, ...state.events].slice(0, 60) : state.events;
  set({ snapshot: snap, trail, events: evs });
  for (const e of events) for (const l of eventListeners) l(e);
}

// --- Demo source (runs in the browser) -------------------------------------

let demoTimer: number | null = null;
let demoRequest: AbortController | null = null;
const demoDerived = new DerivedEventDetector();
const demoTrips = new TripTracker(
  (trip) => {
    saveLocalTrip(trip);
    set({ tripsVersion: state.tripsVersion + 1, activeTrip: null });
  },
  (trip) => {
    if (state.activeTrip?.id !== trip.id) set({ activeTrip: trip });
  },
);

function startDemo(): void {
  stopDemo();
  const request = new AbortController();
  demoRequest = request;
  demoDerived.reset();
  set({ link: 'demo', linkError: null, snapshot: null, status: null, trail: [], events: [] });
  const start = (map: RegionalMap | null) => {
    if (request.signal.aborted) return;
    const simulator = new DemoSimulator(undefined, map?.demoRoute, map?.demoDestination);
    const tick = () => {
      const { snapshot, events } = simulator.tick(Date.now());
      const all = [...demoDerived.next(snapshot), ...events];
      demoTrips.update(snapshot, all);
      pushSnapshot(snapshot, all);
    };
    tick();
    demoTimer = window.setInterval(tick, 100);
  };
  const settings = getSettings();
  if (settings.bridgeUrl && settings.token) void fetchRegionalMap().then(start, () => start(null));
  else start(null);
}

function stopDemo(): void {
  demoRequest?.abort();
  demoRequest = null;
  if (demoTimer !== null) window.clearInterval(demoTimer);
  demoTimer = null;
}

// --- Bridge source ---------------------------------------------------------

let ws: WebSocket | null = null;
let retry: number | null = null;
let retryDelay = 1000;
let generation = 0;

export function bridgeHttp(path: string, init: RequestInit = {}): Promise<Response> {
  const s = getSettings();
  return fetch(`${s.bridgeUrl}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json' },
  });
}

let mapFetch: { url: string; token: string; result: Promise<RegionalMap> } | null = null;

export function fetchRegionalMap(): Promise<RegionalMap> {
  const { bridgeUrl, token } = getSettings();
  if (mapFetch?.url === bridgeUrl && mapFetch.token === token) return mapFetch.result;
  const result = bridgeHttp('/api/map/ets2/ro-bg', { signal: AbortSignal.timeout(5000) })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(response.status === 404 ? 'Verifică versiunea bridge-ului și instalarea ETS2.' : `Bridge-ul a răspuns cu eroarea ${response.status}.`);
      }
      return await response.json() as RegionalMap;
    })
    .catch((error: unknown) => {
      if (mapFetch?.result === result) mapFetch = null;
      throw error;
    });
  mapFetch = { url: bridgeUrl, token, result };
  return result;
}

function wsUrl(base: string): string {
  const u = new URL(base);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = '/ws';
  return u.toString();
}

function connectBridge(s: Settings): void {
  stopBridge();
  const gen = ++generation;
  if (!s.bridgeUrl || !s.token) {
    set({ link: 'unconfigured', linkError: null, snapshot: null, status: null });
    return;
  }
  if (location.protocol === 'https:' && s.bridgeUrl.startsWith('http:')) {
    set({
      link: 'offline',
      linkError: 'Pagina e HTTPS, iar bridge-ul e HTTP: browserul blochează conexiunea. Folosește adresa HTTPS din Tailscale (vezi Setări).',
    });
    return;
  }
  set({ link: 'connecting', linkError: null });
  let url: string;
  try {
    url = wsUrl(s.bridgeUrl);
  } catch {
    set({ link: 'offline', linkError: 'Adresa bridge-ului nu este validă.' });
    return;
  }
  const sock = new WebSocket(url);
  ws = sock;
  sock.onopen = () => sock.send(JSON.stringify({ type: 'auth', token: s.token }));
  sock.onmessage = (ev) => {
    if (gen !== generation) return;
    const msg = JSON.parse(String(ev.data)) as ServerMessage;
    if (msg.type === 'hello') {
      retryDelay = 1000;
      set({ link: 'connected', linkError: null });
    } else if (msg.type === 'snapshot') pushSnapshot(msg.data, []);
    else if (msg.type === 'event') {
      set({ events: [msg.data, ...state.events].slice(0, 60) });
      for (const l of eventListeners) l(msg.data);
      if (msg.data.type === 'job.delivered' || msg.data.type === 'job.cancelled') {
        set({ tripsVersion: state.tripsVersion + 1 });
      }
    } else if (msg.type === 'status') set({ status: msg.data });
  };
  sock.onclose = (ev) => {
    if (gen !== generation) return;
    ws = null;
    if (ev.code === 4001) {
      set({ link: 'unauthorized', linkError: 'Token greșit. Copiază tokenul afișat de bridge.' });
      return;
    }
    if (ev.code === 4003) {
      set({ link: 'offline', linkError: 'Bridge-ul nu acceptă această adresă a aplicației (TRUCKSIM_ORIGINS).' });
      return;
    }
    set({ link: 'offline', linkError: state.link === 'connecting' ? 'Bridge-ul nu răspunde.' : 'Conexiune pierdută.' });
    retry = window.setTimeout(() => connectBridge(getSettings()), retryDelay);
    retryDelay = Math.min(retryDelay * 2, 10_000);
  };
}

function stopBridge(): void {
  generation++;
  if (retry !== null) window.clearTimeout(retry);
  retry = null;
  if (ws) {
    ws.onclose = null;
    ws.close();
  }
  ws = null;
}

// --- Public API ------------------------------------------------------------

let started = false;
let lastKey = '';

export function startTelemetry(): void {
  const apply = () => {
    const s = getSettings();
    const key = `${s.connection}|${s.bridgeUrl}|${s.token}`;
    if (key === lastKey) return;
    lastKey = key;
    if (s.connection === 'demo') {
      stopBridge();
      startDemo();
    } else {
      stopDemo();
      set({ snapshot: null, trail: [], events: [] });
      connectBridge(s);
    }
  };
  if (!started) {
    started = true;
    subscribeSettings(apply);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && getSettings().connection === 'bridge' && !ws) connectBridge(getSettings());
    });
  }
  apply();
}

export function reconnect(): void {
  lastKey = '';
  startTelemetry();
}

export function getTelemetryState(): TelemetryState {
  return state;
}

export function useTelemetry(): TelemetryState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

/** Freshness of the current data, for badges. */
export type Freshness = 'live' | 'demo' | 'replay' | 'stale' | 'offline' | 'nogame';

export function freshness(t: TelemetryState, now: number): Freshness {
  if (t.link === 'demo') return 'demo';
  if (t.link !== 'connected') return 'offline';
  const s = t.snapshot;
  if (!s) return 'offline';
  if (isStale(s, now)) return 'stale';
  if (!s.sdkActive) return 'nogame';
  return s.source === 'replay' ? 'replay' : s.source === 'demo' ? 'demo' : 'live';
}

export function switchToDemo(): void {
  updateSettings({ connection: 'demo' });
}
