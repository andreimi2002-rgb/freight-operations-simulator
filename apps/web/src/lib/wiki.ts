import { useEffect, useState } from 'react';
import { WikiIndex, type WikiData, type WikiGame } from '@trucksim/core';
import { bridgeHttp, getTelemetryState, useTelemetry } from './telemetry';

/**
 * Encyclopedia per game. With the bridge connected it comes from the PC
 * (extracted from the installed games: complete, with your DLCs). Without
 * it, only the bundled ATS data (Truck Simulator Wiki) is available.
 */

const cache = new Map<string, Promise<WikiIndex | null>>();

function bundledAts(): Promise<WikiIndex> {
  return Promise.all([
    import('@data/ats/cities.json'),
    import('@data/ats/companies.json'),
    import('@data/ats/cargo.json'),
    import('@data/ats/trucks.json'),
    import('@data/ats/trailers.json'),
  ]).then(([cities, companies, cargo, trucks, trailers]) => {
    const data = {
      game: 'ats',
      origin: 'wiki',
      meta: cities.default.meta,
      cities: cities.default.cities,
      companies: companies.default.companies,
      cargo: cargo.default.cargo,
      trucks: trucks.default.trucks,
      trailers: trailers.default.trailers,
    } as unknown as WikiData;
    return new WikiIndex(data);
  });
}

async function fromBridge(game: WikiGame): Promise<WikiIndex | null> {
  try {
    const res = await bridgeHttp(`/api/gamedata/${game}`);
    if (!res.ok) return null;
    return new WikiIndex((await res.json()) as WikiData);
  } catch {
    return null;
  }
}

export function loadWiki(game: WikiGame): Promise<WikiIndex | null> {
  const viaBridge = getTelemetryState().link === 'connected';
  const key = `${game}:${viaBridge ? 'bridge' : 'local'}`;
  let p = cache.get(key);
  if (!p) {
    p = viaBridge
      ? fromBridge(game).then((w) => w ?? (game === 'ats' ? bundledAts() : null))
      : game === 'ats' ? bundledAts() : Promise.resolve(null);
    cache.set(key, p);
  }
  return p;
}

/** The game the player is driving, or ETS2 by default. */
export function currentGame(): WikiGame {
  const s = getTelemetryState().snapshot;
  return s?.sdkActive && s.game.id ? s.game.id : 'ets2';
}

export function useWiki(game: WikiGame): { wiki: WikiIndex | null; loading: boolean } {
  const t = useTelemetry();
  const viaBridge = t.link === 'connected';
  const [state, setState] = useState<{ key: string; wiki: WikiIndex | null } | null>(null);
  const key = `${game}:${viaBridge ? 'bridge' : 'local'}`;
  useEffect(() => {
    let alive = true;
    void loadWiki(game).then((w) => alive && setState({ key, wiki: w }));
    return () => {
      alive = false;
    };
  }, [game, key]);
  return { wiki: state?.key === key ? state.wiki : null, loading: state?.key !== key };
}
