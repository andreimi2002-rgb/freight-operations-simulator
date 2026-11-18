import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize as normPath, resolve, sep } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import type { BridgeMode, GameId, ServerMessage } from '@trucksim/core';
import type { WikiProvider } from './gamedata/wiki.ts';
import { loadRegionalMap, regionalMapGzip, routeToCity } from './map/regional.ts';
import { worldMeta, worldNearbyCity, worldOverview, worldRouteToCity, worldStatus, worldTile } from './map/world.ts';
import { nearbyCity, nextRouteTurn } from '../../../packages/core/src/regional-map.ts';
import type { CoDriver, ChatTurn } from './ai.ts';
import { BRIDGE_VERSION, type Config } from './config.ts';
import type { Hub } from './hub.ts';
import type { Recorder } from './recorder.ts';
import type { TripStore } from './store.ts';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

interface Deps {
  config: Config;
  hub: Hub;
  store: TripStore;
  recorder: Recorder;
  ai: CoDriver;
  wiki: WikiProvider;
  /** 6-digit code shown in the bridge window, new on every start. */
  pairCode: string;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage, limit = 64 * 1024): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error('Body too large');
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

export function startServer(deps: Deps): { close: () => void } {
  const { config, hub, store, recorder, ai, wiki } = deps;
  const clients = new Set<WebSocket>();
  const pairFailures = new Map<string, { count: number; since: number }>();

  const aiInfo = () => ({ provider: ai.provider, model: ai.model });

  function cors(req: IncomingMessage, res: ServerResponse): void {
    const origin = req.headers.origin;
    if (origin && config.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      // Chrome's Private Network Access: a public page reaching a LAN/Tailscale address.
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
  }

  function authorized(req: IncomingMessage): boolean {
    const h = req.headers.authorization ?? '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    return token !== '' && safeEqual(token, config.token);
  }

  async function api(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const path = url.pathname;
    if (path === '/api/health') {
      return json(res, 200, { ok: true, app: 'trucksim-bridge', version: BRIDGE_VERSION, mode: hub.mode });
    }
    // Pairing with the 6-digit code shown in the bridge window: for the iPhone
    // home-screen app, which does not share storage with Safari.
    if (req.method === 'POST' && path === '/api/pair') {
      const ip = req.socket.remoteAddress ?? '?';
      const now = Date.now();
      const f = pairFailures.get(ip);
      if (f && f.count >= 5 && now - f.since < 60_000) {
        return json(res, 429, { error: 'Prea multe încercări. Așteaptă un minut.' });
      }
      const body = (await readBody(req, 1024)) as { code?: unknown };
      const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : '';
      if (code.length === 6 && safeEqual(code, deps.pairCode)) {
        pairFailures.delete(ip);
        console.log(`[pair] device paired (${ip})`);
        return json(res, 200, { token: config.token });
      }
      pairFailures.set(ip, f && now - f.since < 60_000 ? { count: f.count + 1, since: f.since } : { count: 1, since: now });
      return json(res, 403, { error: 'Cod greșit. Uită-te în fereastra TruckSim de pe PC.' });
    }
    if (!authorized(req)) return json(res, 401, { error: 'unauthorized', hint: 'Pair the app with the token printed by the bridge.' });

    if (req.method === 'GET' && path === '/api/status') return json(res, 200, hub.status(clients.size, aiInfo()));
    if (req.method === 'GET' && path === '/api/snapshot') return json(res, 200, { snapshot: hub.snapshot, activeTrip: hub.activeTrip, events: hub.recentEvents });
    if (req.method === 'GET' && path === '/api/trips') {
      const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') ?? 100) || 100));
      return json(res, 200, { trips: store.list(limit, { includeDemo: url.searchParams.get('demo') === '1' }) });
    }
    const tripMatch = /^\/api\/trips\/([\w.-]+)$/.exec(path);
    if (tripMatch) {
      const id = tripMatch[1]!;
      if (req.method === 'GET') {
        const trip = store.get(id);
        return trip ? json(res, 200, { trip }) : json(res, 404, { error: 'not found' });
      }
      if (req.method === 'DELETE') return json(res, store.delete(id) ? 200 : 404, { deleted: id });
    }
    if (req.method === 'GET' && path === '/api/gamedata') return json(res, 200, wiki.status);
    if (req.method === 'POST' && path === '/api/gamedata/refresh') {
      await wiki.refresh(true);
      return json(res, 200, wiki.status);
    }
    const gd = /^\/api\/gamedata\/(ets2|ats)$/.exec(path);
    if (req.method === 'GET' && gd) {
      const body = wiki.gzipped(gd[1] as GameId);
      if (!body) return json(res, 404, { error: 'no data for this game' });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Encoding': 'gzip', 'Cache-Control': 'no-cache' });
      res.end(body);
      return;
    }
    if (req.method === 'GET' && path === '/api/map/ets2/route') {
      const snapshot = hub.snapshot;
      const destinationId = snapshot?.job?.destinationCityId ?? null;
      const position = snapshot?.position;
      if (snapshot?.source !== 'live' || !snapshot.sdkActive || snapshot.game.id !== 'ets2' || !destinationId || !position) {
        return json(res, 200, { destinationId, points: null, turns: [] });
      }
      try {
        // Whole-map router when ready; the regional (RO/BG) one while it builds.
        const start: [number, number] = [position.x, position.z];
        const plan = worldMeta()
          ? worldRouteToCity(destinationId, start, position.headingDeg)
          : routeToCity(destinationId, start, position.headingDeg);
        return json(res, 200, { destinationId, points: plan?.points ?? null, turns: plan?.turns ?? [], network: worldMeta() ? 'europe' : 'ro-bg' });
      } catch (error) {
        console.warn('[map route]', error);
        return json(res, 503, { error: 'ETS2 regional routing unavailable' });
      }
    }
    if (req.method === 'GET' && path === '/api/map/ets2/world') {
      const m = worldMeta();
      const st = worldStatus();
      return json(res, 200, {
        state: st.state,
        ...(st.state === 'error' ? { error: st.error } : st.state === 'missing' ? { error: st.reason } : {}),
        meta: m ? { tileSize: m.tileSize, bounds: m.bounds, tiles: m.tiles, cities: m.cities, counts: m.counts, sectors: m.sectors, builtAt: m.builtAt } : null,
      });
    }
    if (req.method === 'GET' && path === '/api/map/ets2/overview') {
      const body = worldOverview();
      if (!body) return json(res, 503, { error: 'map not ready' });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Encoding': 'gzip', 'Cache-Control': 'no-cache' });
      res.end(body);
      return;
    }
    const tileMatch = /^\/api\/map\/ets2\/tile\/(-?\d+_-?\d+)$/.exec(path);
    if (req.method === 'GET' && tileMatch) {
      const body = worldTile(tileMatch[1]!);
      if (!body) return json(res, 404, { error: 'no such tile' });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Encoding': 'gzip', 'Cache-Control': 'no-cache' });
      res.end(body);
      return;
    }
    if (req.method === 'GET' && path === '/api/map/ets2/ro-bg') {
      try {
        const body = regionalMapGzip();
        if (!body) return json(res, 404, { error: 'ETS2 installation unavailable' });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Encoding': 'gzip', 'Cache-Control': 'no-store' });
        res.end(body);
      } catch (err) {
        console.warn('[map]', err);
        return json(res, 503, { error: 'ETS2 regional map unavailable' });
      }
      return;
    }
    if (req.method === 'GET' && path === '/api/recordings') return json(res, 200, { recordings: recorder.list(), current: recorder.current });
    if (req.method === 'POST' && path === '/api/mode') {
      const body = (await readBody(req)) as { mode?: BridgeMode; file?: string; speed?: number };
      const mode = body.mode;
      if (mode !== 'live' && mode !== 'demo' && mode !== 'replay') return json(res, 400, { error: 'mode must be live, demo or replay' });
      let replayPath: string | undefined;
      if (mode === 'replay') {
        const name = body.file ?? '';
        // Only files inside recordings/, by name.
        if (!/^[\w.-]+\.jsonl(\.gz)?$/.test(name)) return json(res, 400, { error: 'invalid recording name' });
        replayPath = join(config.recordingsDir, name);
        if (!existsSync(replayPath)) {
          const sample = join(config.recordingsDir, 'samples', name);
          if (!existsSync(sample)) return json(res, 404, { error: 'recording not found' });
          replayPath = sample;
        }
      }
      await hub.setMode(mode, { replayPath, replayName: body.file, speed: body.speed });
      broadcast({ type: 'status', data: hub.status(clients.size, aiInfo()) });
      return json(res, 200, hub.status(clients.size, aiInfo()));
    }
    if (req.method === 'GET' && path === '/api/ai/config') return json(res, 200, ai.info());
    if (req.method === 'POST' && path === '/api/ai/config') {
      const body = (await readBody(req)) as { provider?: unknown; apiKey?: unknown; model?: unknown };
      const provider = body.provider === 'gemini' || body.provider === 'claude' || body.provider === 'local' ? body.provider : null;
      if (!provider) return json(res, 400, { error: 'provider must be gemini, claude or local' });
      const apiKey = body.apiKey === null ? null : typeof body.apiKey === 'string' ? body.apiKey.slice(0, 300) : undefined;
      const model = typeof body.model === 'string' ? body.model : undefined;
      const result = await ai.configure({ provider, apiKey, model });
      if (!result.ok) return json(res, 400, { error: result.error, ...ai.info() });
      console.log(`[ai] ${ai.provider}${ai.model ? ` (${ai.model})` : ''} configured from the app`);
      broadcast({ type: 'status', data: hub.status(clients.size, aiInfo()) });
      return json(res, 200, ai.info());
    }
    if (req.method === 'POST' && path === '/api/ai/chat') {
      const body = (await readBody(req)) as { question?: unknown; history?: unknown };
      const question = typeof body.question === 'string' ? body.question.slice(0, 1000).trim() : '';
      if (!question) return json(res, 400, { error: 'question required' });
      const history: ChatTurn[] = Array.isArray(body.history)
        ? (body.history as ChatTurn[])
            .filter((t) => (t?.role === 'user' || t?.role === 'assistant') && typeof t.text === 'string')
            .slice(-10)
            .map((t) => ({ role: t.role, text: t.text.slice(0, 2000) }))
        : [];
      const reply = await ai.ask(question, history, () => {
        const snapshot = hub.snapshot;
        const position = snapshot?.position;
        return {
          snapshot,
          now: Date.now(),
          trips: (n) => store.list(n, { includeDemo: hub.mode !== 'live' }),
          // The encyclopedia of the game being played (ETS2 when unknown).
          wiki: wiki.index(snapshot?.sdkActive ? snapshot.game.id : null),
          location: () => {
            if (snapshot?.game.id !== 'ets2' || !position) return null;
            try {
              const near = worldNearbyCity(position);
              if (near) return near;
              const map = loadRegionalMap();
              return map ? nearbyCity(map.cities, position) : null;
            } catch {
              return null;
            }
          },
          nextTurn: () => {
            if (snapshot?.game.id !== 'ets2' || !position) return null;
            try {
              if (snapshot.source === 'demo' && snapshot.demoRoute === 'regional') {
                const map = loadRegionalMap();
                return map?.demoRoute && map.demoTurns ? nextRouteTurn({ points: map.demoRoute, turns: map.demoTurns }, position) : null;
              }
              const destinationId = snapshot.job?.destinationCityId;
              if (!destinationId) return null;
              const start: [number, number] = [position.x, position.z];
              const plan = worldMeta()
                ? worldRouteToCity(destinationId, start, position.headingDeg)
                : routeToCity(destinationId, start, position.headingDeg);
              return plan ? nextRouteTurn(plan, position) : null;
            } catch {
              return null;
            }
          },
        };
      });
      return json(res, 200, reply);
    }
    return json(res, 404, { error: 'not found' });
  }

  function serveStatic(req: IncomingMessage, res: ServerResponse, url: URL): void {
    if (!existsSync(config.webDist)) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('TruckSim bridge is running. Build the web app (npm run build) to serve it from here.');
      return;
    }
    const root = resolve(config.webDist);
    let file = resolve(join(root, normPath(decodeURIComponent(url.pathname))));
    if (!file.startsWith(root + sep) && file !== root) {
      res.writeHead(403).end();
      return;
    }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
    const ext = extname(file);
    const immutable = file.includes(`${sep}assets${sep}`);
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    createReadStream(file).pipe(res);
  }

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://bridge.local');
    cors(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      api(req, res, url).catch((err: unknown) => {
        console.error('[api]', err);
        if (!res.headersSent) json(res, 500, { error: 'internal error' });
      });
      return;
    }
    serveStatic(req, res, url);
  });

  // WebSocket: the first message must be {type:"auth", token}. Tokens stay out of URLs.
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
  wss.on('connection', (ws, req) => {
    const origin = req.headers.origin;
    const host = req.headers.host ?? '';
    const sameOrigin = origin ? new URL(origin).host === host : true;
    if (origin && !sameOrigin && !config.allowedOrigins.includes(origin)) {
      ws.close(4003, 'origin not allowed');
      return;
    }
    let authed = false;
    const timer = setTimeout(() => !authed && ws.close(4001, 'auth timeout'), 5000);
    ws.on('message', (data) => {
      if (authed) return; // clients only send auth; everything else is REST
      try {
        const msg = JSON.parse(String(data)) as { type?: string; token?: string };
        if (msg.type === 'auth' && typeof msg.token === 'string' && safeEqual(msg.token, config.token)) {
          authed = true;
          clearTimeout(timer);
          clients.add(ws);
          send(ws, { type: 'hello', bridgeVersion: BRIDGE_VERSION, mode: hub.mode, source: hub.snapshot?.source ?? null });
          send(ws, { type: 'status', data: hub.status(clients.size, aiInfo()) });
          if (hub.snapshot) send(ws, { type: 'snapshot', data: hub.snapshot });
        } else {
          ws.close(4001, 'bad token');
        }
      } catch {
        ws.close(4000, 'bad message');
      }
    });
    ws.on('close', () => {
      clearTimeout(timer);
      clients.delete(ws);
    });
  });

  function send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }
  function broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const ws of clients) if (ws.readyState === ws.OPEN && ws.bufferedAmount < 1_000_000) ws.send(data);
  }

  hub.on('snapshot', (s) => broadcast({ type: 'snapshot', data: s }));
  hub.on('event', (e) => broadcast({ type: 'event', data: e }));
  const statusTimer = setInterval(() => broadcast({ type: 'status', data: hub.status(clients.size, aiInfo()) }), 5000);

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\nPort ${config.port} is already in use (another bridge?). Start with --port <n> or PORT=<n>.`);
      process.exit(1);
    }
    throw err;
  });
  wss.on('error', () => undefined); // reported by the HTTP server above
  server.listen(config.port, config.host);

  return {
    close: () => {
      clearInterval(statusTimer);
      for (const ws of clients) ws.close(1001, 'bridge stopping');
      wss.close();
      server.close();
    },
  };
}
