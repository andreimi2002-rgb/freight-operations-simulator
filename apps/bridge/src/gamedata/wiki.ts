import { gzipSync } from 'node:zlib';
import { WikiIndex, wikiFromGameData, type GameId, type WikiData } from '@trucksim/core';
import { loadGameData, refreshGameData } from './store.ts';

/**
 * Encyclopedia per game for the bridge (copilot tools) and the app (served
 * over the API). Uses data extracted from the local installation when there
 * is any; for ATS it falls back to the bundled Truck Simulator Wiki data.
 */
export class WikiProvider {
  private readonly atsWiki: WikiData | null;
  private readonly built = new Map<GameId, { data: WikiData; index: WikiIndex; gz: Buffer }>();
  status: Record<GameId, { source: 'game' | 'wiki' | null; cities: number; generatedAt: string | null; error: string | null }> = {
    ets2: { source: null, cities: 0, generatedAt: null, error: null },
    ats: { source: null, cities: 0, generatedAt: null, error: null },
  };

  constructor(atsWiki: WikiData | null) {
    this.atsWiki = atsWiki;
    for (const g of ['ets2', 'ats'] as GameId[]) this.build(g);
  }

  private build(game: GameId): void {
    const gd = loadGameData(game);
    let data: WikiData | null = null;
    if (gd) data = wikiFromGameData(gd, game === 'ats' ? this.atsWiki : null);
    else if (game === 'ats' && this.atsWiki) data = { ...this.atsWiki, game: 'ats', origin: 'wiki' };
    if (!data) {
      this.built.delete(game);
      this.status[game] = { ...this.status[game], source: null, cities: 0, generatedAt: null };
      return;
    }
    this.built.set(game, { data, index: new WikiIndex(data), gz: gzipSync(JSON.stringify(data)) });
    this.status[game] = { source: data.origin ?? 'wiki', cities: data.cities.length, generatedAt: gd?.meta.generatedAt ?? null, error: this.status[game].error };
  }

  /** Re-extracts when the game changed (update or new DLC). Runs in the background at startup. */
  async refresh(force = false): Promise<void> {
    const results = await refreshGameData({ force });
    for (const r of results) {
      this.status[r.game].error = r.error && r.error !== 'game not installed' ? r.error : null;
      if (r.extracted) {
        console.log(`[gamedata] ${r.game}: ${r.data?.cities.length ?? 0} cities, ${r.data?.companies.length ?? 0} companies, ${r.data?.cargo.length ?? 0} cargo (${r.ms} ms)`);
        for (const w of r.warnings) console.warn(`[gamedata] ${r.game}: ${w}`);
      }
      if (r.error && r.error !== 'game not installed') console.warn(`[gamedata] ${r.game}: ${r.error}`);
      this.build(r.game);
    }
  }

  index(game: GameId | null): WikiIndex | null {
    return this.built.get(game ?? 'ets2')?.index ?? null;
  }

  /** Gzipped JSON of the encyclopedia for a game, for the API. */
  gzipped(game: GameId): Buffer | null {
    return this.built.get(game)?.gz ?? null;
  }
}
