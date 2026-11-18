import { useSyncExternalStore } from 'react';

export type ConnectionMode = 'demo' | 'bridge';
export type Theme = 'auto' | 'dark' | 'light' | 'night';
export type UnitPref = 'auto' | 'metric' | 'imperial';

export interface Settings {
  connection: ConnectionMode;
  bridgeUrl: string;
  token: string;
  units: UnitPref;
  theme: Theme;
  voiceReplies: boolean;
  voiceAlerts: boolean;
  keepAwake: boolean;
  mapHeadingUp: boolean;
  map3d: boolean;
}

const KEY = 'trucksim.settings.v1';

/** When the app is served by the bridge itself, it is the default bridge. */
function servedByBridge(): boolean {
  return !/netlify\.app$/.test(location.hostname) && location.port !== '5173';
}

const defaults: Settings = {
  connection: servedByBridge() ? 'bridge' : 'demo',
  bridgeUrl: servedByBridge() ? location.origin : '',
  token: '',
  units: 'auto',
  theme: 'dark',
  voiceReplies: true,
  voiceAlerts: true,
  keepAwake: true,
  mapHeadingUp: true,
  map3d: true,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* private mode or blocked storage: use defaults */
  }
  return { ...defaults };
}

let current = load();
const listeners = new Set<() => void>();

/** Pairing link: #pair=<base64url of {"url","token"}>. The hash never reaches a server. */
function applyPairingFromHash(): void {
  const m = /[#&]pair=([\w-]+)/.exec(location.hash);
  if (!m) return;
  try {
    const json = atob(m[1]!.replace(/-/g, '+').replace(/_/g, '/'));
    const p = JSON.parse(json) as { url?: string; token?: string };
    if (p.url && p.token) {
      current = { ...current, connection: 'bridge', bridgeUrl: p.url.replace(/\/$/, ''), token: p.token };
      save();
    }
  } catch {
    /* ignore malformed links */
  }
  history.replaceState(null, '', location.pathname + location.search);
}
applyPairingFromHash();

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage may be unavailable */
  }
}

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  save();
  for (const l of listeners) l();
}

export function subscribeSettings(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
