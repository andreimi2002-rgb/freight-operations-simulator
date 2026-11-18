import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { BridgeMode } from '@trucksim/core';

export const BRIDGE_VERSION = '0.1.0';
export const REPO_ROOT = resolve(import.meta.dirname, '../../..');

export interface Config {
  host: string;
  port: number;
  token: string;
  mode: BridgeMode;
  replay: string | null;
  replaySpeed: number;
  record: boolean;
  allowedOrigins: string[];
  varDir: string;
  recordingsDir: string;
  webDist: string;
  dataDir: string;
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return null;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : 'true';
}

/** Persistent pairing token in var/bridge.json (created on first run). */
function loadToken(varDir: string): string {
  if (process.env.TRUCKSIM_TOKEN) return process.env.TRUCKSIM_TOKEN;
  mkdirSync(varDir, { recursive: true });
  const file = join(varDir, 'bridge.json');
  if (existsSync(file)) {
    const data = JSON.parse(readFileSync(file, 'utf8')) as { token?: string };
    if (data.token) return data.token;
  }
  const token = randomBytes(18).toString('base64url');
  writeFileSync(file, JSON.stringify({ token, createdAt: new Date().toISOString() }, null, 2));
  return token;
}

export function loadConfig(): Config {
  const varDir = join(REPO_ROOT, 'var');
  const modeArg = (arg('mode') ?? process.env.TRUCKSIM_MODE ?? 'live') as BridgeMode;
  const mode: BridgeMode = ['live', 'demo', 'replay'].includes(modeArg) ? modeArg : 'live';
  return {
    host: process.env.HOST ?? '0.0.0.0',
    port: Number(arg('port') ?? process.env.PORT ?? 8787),
    token: loadToken(varDir),
    mode,
    replay: arg('file'),
    replaySpeed: Number(arg('speed') ?? 1) || 1,
    record: (process.env.TRUCKSIM_RECORD ?? 'on') !== 'off' && arg('no-record') === null,
    allowedOrigins: (process.env.TRUCKSIM_ORIGINS ??
      'https://freight-operations-simulator.netlify.app,http://localhost:5173,http://127.0.0.1:5173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    varDir,
    recordingsDir: join(REPO_ROOT, 'recordings'),
    webDist: join(REPO_ROOT, 'apps/web/dist'),
    dataDir: join(REPO_ROOT, 'data'),
  };
}
