/**
 * The encyclopedia: search and lookups over game data. Two sources:
 * - data extracted on the PC from the player's own installation (ETS2 and ATS,
 *   complete, matching installed DLCs), served by the bridge;
 * - Truck Simulator Wiki data for ATS (data/ats, CC BY-SA 4.0), bundled with
 *   the app and used to enrich the ATS entries (landmarks, roads, facilities).
 */
import type { GameData } from './gamedata.ts';

export interface WikiMeta {
  source: string;
  sourceUrl: string;
  licence: string;
  licenceUrl: string;
  attribution: string;
  retrieved: string;
}

export type WikiGame = 'ets2' | 'ats';

export interface CityRecord {
  id: string;
  gameId: string | null;
  name: string;
  /** Country (ETS2) or state (ATS), display name. */
  state: string;
  dlc: string | null;
  population?: number | null;
  timezone?: { game: string | null; iana: string | null } | null;
  coordinates?: { lat: number; lon: number } | null;
  companyCount?: number;
  depots?: Array<{ company: string; depotGameId: string | null; type: string | null }>;
  facilities?: string[];
  facilityDetails?: string[];
  roads?: string[];
  neighbors?: string[];
  landmarks?: string[];
  truckDealers?: string[];
  wiki?: { url: string } | null;
}

export interface CompanyRecord {
  id: string;
  name: string;
  fullName: string | null;
  category: string | null;
  industry: string | null;
  defIds: string[];
  depotTypes: Array<{ gameId: string | null; type: string | null; cities: string[]; accepts: string[]; provides: string[] }>;
  wiki?: { url: string } | null;
}

export interface CargoRecord {
  id: string;
  gameId: string | null;
  name: string;
  dlc: string | null;
  weightLb: { min: number; max: number } | null;
  valuePerKm: number | null;
  flags: string[];
  hazmatClass: string | null;
  trailerTypes: string[];
  /** Mass of one cargo unit, kg (from the game files). */
  unitMassKg?: number | null;
  wiki?: { url: string } | null;
}

export interface TruckRecord {
  id: string;
  name: string;
  manufacturer: string | null;
  maxHp: number | null;
  electric: boolean;
  bodyStyles?: string[];
  transmissions?: string[];
  availability?: string | null;
  /** From the game files: engines with power, gearboxes, chassis configurations. */
  engines?: Array<{ name: string; hp: number | null; kw: number | null; torqueNm: number | null; volumeL: number | null; price: number | null; unlock: number | null }>;
  chassis?: string[];
  dlc?: string | null;
  wiki?: { url: string } | null;
}

export interface TrailerRecord {
  id: string;
  name: string;
  cargo: string[];
  /** From the game files (ownable trailers, incl. trailer DLCs). */
  brand?: string | null;
  bodies?: Array<{ name: string; volumeM3: number | null; lengthM: number | null }>;
  chassis?: string[];
  dlc?: string | null;
}

export interface WikiData {
  game?: WikiGame;
  /** 'game': extracted from the installation; 'wiki': Truck Simulator Wiki only. */
  origin?: 'game' | 'wiki';
  /** Job trailer id -> trailer definition id (see GameData.trailerAliases). */
  trailerAliases?: Record<string, string>;
  meta: WikiMeta;
  cities: CityRecord[];
  companies: CompanyRecord[];
  cargo: CargoRecord[];
  trucks: TruckRecord[];
  trailers: TrailerRecord[];
}

export type WikiKind = 'city' | 'company' | 'cargo' | 'truck' | 'trailer';

export interface WikiHit {
  kind: WikiKind;
  id: string;
  game: 'ats' | 'ets2';
  title: string;
  subtitle: string;
  score: number;
}

/** Lower-case, strip diacritics and punctuation. */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_\-./]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface IndexEntry {
  kind: WikiKind;
  id: string;
  title: string;
  subtitle: string;
  terms: string[];
}

export class WikiIndex {
  private readonly entries: IndexEntry[];
  private readonly companyByDef = new Map<string, CompanyRecord>();
  private readonly cityById = new Map<string, CityRecord>();

  readonly data: WikiData;

  constructor(data: WikiData) {
    this.data = data;
    const e: IndexEntry[] = [];
    for (const c of data.cities) {
      this.cityById.set(c.id, c);
      if (c.gameId) this.cityById.set(c.gameId, c);
      e.push({
        kind: 'city', id: c.id, title: c.name, subtitle: `Oraș · ${c.state}`,
        terms: [c.name, c.id, c.gameId ?? '', c.state, ...(c.roads ?? [])].map(fold),
      });
    }
    for (const c of data.companies) {
      for (const d of c.defIds) this.companyByDef.set(d, c);
      e.push({
        kind: 'company', id: c.id, title: c.name, subtitle: ['Companie', c.industry ?? c.category].filter(Boolean).join(' · '),
        terms: [c.name, c.fullName ?? '', c.id, ...c.defIds, c.industry ?? ''].map(fold),
      });
    }
    for (const c of data.cargo) {
      e.push({
        kind: 'cargo', id: c.id, title: c.name, subtitle: `Marfă${c.dlc ? ' · DLC' : ''}`,
        terms: [c.name, c.id, c.gameId ?? '', ...c.trailerTypes].map(fold),
      });
    }
    for (const t of data.trucks) {
      e.push({
        kind: 'truck', id: t.id, title: t.name, subtitle: `Camion · ${t.manufacturer ?? ''}`,
        terms: [t.name, t.id, t.manufacturer ?? ''].map(fold),
      });
    }
    for (const t of data.trailers) {
      e.push({
        kind: 'trailer', id: t.id, title: t.name, subtitle: ['Remorcă', t.bodies?.[0]?.name].filter(Boolean).join(' · '),
        terms: [t.name, t.id, t.brand ?? '', ...(t.bodies ?? []).map((b) => b.name)].map(fold),
      });
    }
    this.entries = e;
  }

  search(query: string, limit = 20, kinds?: WikiKind[]): WikiHit[] {
    const q = fold(query);
    if (!q) return [];
    const words = q.split(' ');
    const hits: WikiHit[] = [];
    for (const en of this.entries) {
      if (kinds && !kinds.includes(en.kind)) continue;
      let score = 0;
      for (const w of words) {
        let best = 0;
        for (const t of en.terms) {
          if (!t) continue;
          if (t === w) best = Math.max(best, 10);
          else if (t.startsWith(w)) best = Math.max(best, 6);
          else if (t.split(' ').some((p) => p.startsWith(w))) best = Math.max(best, 4);
          else if (w.length >= 3 && t.includes(w)) best = Math.max(best, 2);
        }
        if (best === 0) { score = 0; break; }
        score += best;
      }
      if (score > 0) {
        if (fold(en.title) === q) score += 20;
        hits.push({ kind: en.kind, id: en.id, game: this.data.game ?? 'ats', title: en.title, subtitle: en.subtitle, score });
      }
    }
    hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    return hits.slice(0, limit);
  }

  city(id: string): CityRecord | undefined {
    return this.cityById.get(id) ?? this.cityById.get(id.replace(/_/g, '-')) ?? this.cityById.get(id.replace(/-/g, '_'));
  }
  company(id: string): CompanyRecord | undefined {
    return this.data.companies.find((c) => c.id === id);
  }
  /** Telemetry company ids are depot definition ids (e.g. "ai_car_pln" in ATS). */
  companyByGameId(gameId: string): CompanyRecord | undefined {
    return this.companyByDef.get(gameId);
  }
  cargo(id: string): CargoRecord | undefined {
    return this.data.cargo.find((c) => c.id === id || c.gameId === id) ??
      this.data.cargo.find((c) => c.id === id.replace(/_/g, '-'));
  }
  truck(id: string): TruckRecord | undefined {
    return this.data.trucks.find((t) => t.id === id);
  }
  trailer(id: string): TrailerRecord | undefined {
    return this.data.trailers.find((t) => t.id === id);
  }
  /** Telemetry trailer ids look like "krone.coolliner.single_3...": match the longest known prefix. */
  trailerByGameId(gameId: string): TrailerRecord | undefined {
    const byPrefix = (id: string) => {
      const parts = id.split('.');
      for (let n = parts.length; n >= 2; n--) {
        const hit = this.trailer(parts.slice(0, n).join('.'));
        if (hit) return hit;
      }
      return undefined;
    };
    // Company job trailers ("schw_curtain") point to a definition ("schwmuller.curtain.single_3...").
    const alias = this.data.trailerAliases?.[gameId];
    return byPrefix(gameId) ?? (alias ? byPrefix(alias) : undefined);
  }
}

// ---------------------------------------------------------------------------
// Building the encyclopedia from extracted game data
// ---------------------------------------------------------------------------

const GAME_META: WikiMeta = {
  source: 'Fișierele jocului instalat pe PC',
  sourceUrl: '',
  licence: 'conținut SCS Software',
  licenceUrl: 'https://scssoft.com',
  attribution: 'Date extrase local din instalarea ta a jocului (SCS Software); nu sunt publicate.',
  retrieved: '',
};

const slug = (s: string) => fold(s).replace(/ /g, '-');

/** "dlc_balkan_e" -> "balkan_e"; null for the base game. */
function dlcLabel(dlc: string | null): string | null {
  return dlc ? dlc.replace(/^dlc_/, '') : null;
}

/**
 * Turns extracted game data into the encyclopedia model. For ATS, Truck
 * Simulator Wiki data (when given) adds what the game files do not have:
 * landmarks, roads, facilities, depot types, wiki links.
 */
export function wikiFromGameData(gd: GameData, wiki?: WikiData | null): WikiData {
  const countryName = new Map(gd.countries.map((c) => [c.id, c.nameRo ?? c.name]));
  const wikiCity = new Map((wiki?.cities ?? []).map((c) => [c.id.replace(/-/g, '_'), c]));
  const wikiCompanyByDef = new Map<string, CompanyRecord>();
  const wikiDepotType = new Map<string, string>();
  for (const c of wiki?.companies ?? []) {
    for (const d of c.defIds) wikiCompanyByDef.set(d, c);
    for (const d of c.depotTypes) if (d.gameId && d.type) wikiDepotType.set(d.gameId, d.type);
  }
  const wikiCargoByName = new Map((wiki?.cargo ?? []).map((c) => [fold(c.name), c]));

  // Companies are grouped by brand name: ATS has one id per depot type
  // (ai_car_pln, ai_car_whs) under the same name; telemetry reports those ids.
  const groups = new Map<string, typeof gd.companies>();
  for (const c of gd.companies) {
    const key = slug(c.name) || c.id;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const companyIdOf = new Map<string, string>();
  const companies: CompanyRecord[] = [];
  for (const [key, members] of groups) {
    const w = members.map((m) => wikiCompanyByDef.get(m.id)).find(Boolean);
    for (const m of members) companyIdOf.set(m.id, key);
    companies.push({
      id: key,
      name: members[0]!.name,
      fullName: w?.fullName ?? null,
      category: w?.category ?? null,
      industry: w?.industry ?? null,
      defIds: members.map((m) => m.id),
      depotTypes: members.map((m) => ({
        gameId: m.id,
        type: wikiDepotType.get(m.id) ?? null,
        cities: m.cities,
        accepts: m.cargoIn,
        provides: m.cargoOut,
      })),
      wiki: w?.wiki ?? null,
    });
  }

  const cities: CityRecord[] = gd.cities.map((c) => {
    const w = wikiCity.get(c.id);
    return {
      id: c.id,
      gameId: c.id,
      name: c.nameRo ?? c.name,
      state: (c.country && countryName.get(c.country)) ?? c.country ?? '',
      dlc: dlcLabel(c.dlc),
      population: c.population,
      companyCount: new Set(c.companies.map((id) => companyIdOf.get(id) ?? id)).size,
      depots: c.companies.map((id) => ({ company: companyIdOf.get(id) ?? id, depotGameId: id, type: wikiDepotType.get(id) ?? null })),
      timezone: w?.timezone ?? null,
      coordinates: w?.coordinates ?? null,
      facilities: w?.facilities,
      facilityDetails: w?.facilityDetails,
      roads: w?.roads,
      neighbors: w?.neighbors?.map((n) => n.replace(/-/g, '_')),
      landmarks: w?.landmarks,
      truckDealers: w?.truckDealers,
      wiki: w?.wiki ?? null,
    };
  });

  const cargo: CargoRecord[] = gd.cargo.map((c) => {
    const w = wikiCargoByName.get(fold(c.name));
    const flags = [c.valuable ? 'valoroasă' : null, c.overweight ? 'agabaritică' : null, c.fragility !== null && c.fragility >= 0.7 ? 'fragilă' : null].filter(
      (x): x is string => Boolean(x),
    );
    return {
      id: c.id,
      gameId: c.id,
      name: c.nameRo ?? c.name,
      dlc: dlcLabel(c.dlc),
      weightLb: w?.weightLb ?? null,
      unitMassKg: c.unitMassKg,
      valuePerKm: c.rewardPerKm,
      flags,
      hazmatClass: c.adrClass !== null ? String(c.adrClass) : null,
      trailerTypes: c.bodyTypes,
      wiki: w?.wiki ?? null,
    };
  });

  return {
    game: gd.meta.game,
    origin: 'game',
    trailerAliases: gd.trailerAliases ?? {},
    meta: wiki && gd.meta.game === 'ats'
      ? { ...GAME_META, attribution: `${GAME_META.attribution} Detalii suplimentare: ${wiki.meta.attribution}`, licence: wiki.meta.licence, licenceUrl: wiki.meta.licenceUrl, retrieved: wiki.meta.retrieved }
      : GAME_META,
    cities,
    companies,
    cargo,
    trucks: (gd.trucks ?? []).length
      ? (gd.trucks ?? []).map((t) => {
          const name = `${t.brand} ${t.model}`;
          const w = (wiki?.trucks ?? []).find((x) => fold(x.name) === fold(name));
          const top = Math.max(0, ...t.engines.map((e) => e.hp ?? 0));
          return {
            id: t.id,
            name,
            manufacturer: t.brand,
            maxHp: top || null,
            electric: t.electric,
            bodyStyles: t.cabins,
            transmissions: t.transmissions,
            availability: t.dlc ? null : 'Joc de bază',
            engines: t.engines.map(({ id: _id, ...e }) => e),
            chassis: t.chassis,
            dlc: dlcLabel(t.dlc),
            wiki: w?.wiki ?? null,
          };
        })
      : gd.meta.game === 'ats' ? (wiki?.trucks ?? []) : [],
    trailers: (gd.trailers ?? []).length
      ? (gd.trailers ?? []).map((t) => {
          const generic = t.brand.toLowerCase() === 'scs';
          return {
            id: t.id,
            name: generic ? `${t.bodies[0]?.name ?? t.model} (${t.model})` : `${t.brand} ${t.model}`,
            cargo: [],
            brand: generic ? 'Remorci de bază' : t.brand,
            bodies: t.bodies.map(({ name, volumeM3, lengthM }) => ({ name, volumeM3, lengthM })),
            chassis: t.chassis,
            dlc: dlcLabel(t.dlc),
          };
        })
      : gd.meta.game === 'ats' ? (wiki?.trailers ?? []) : [],
  };
}
