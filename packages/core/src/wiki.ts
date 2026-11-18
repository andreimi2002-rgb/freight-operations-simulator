/**
 * Search over the local game data (data/ats/*.json, from Truck Simulator Wiki,
 * CC BY-SA 4.0). The data files are passed in so the browser can lazy-load
 * them and the bridge can read them from disk.
 */

export interface WikiMeta {
  source: string;
  sourceUrl: string;
  licence: string;
  licenceUrl: string;
  attribution: string;
  retrieved: string;
}

export interface CityRecord {
  id: string;
  gameId: string | null;
  name: string;
  state: string;
  dlc: string | null;
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
  wiki?: { url: string } | null;
}

export interface TrailerRecord {
  id: string;
  name: string;
  cargo: string[];
}

export interface WikiData {
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
        kind: 'company', id: c.id, title: c.name, subtitle: `Companie · ${c.industry ?? c.category ?? ''}`,
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
      e.push({ kind: 'trailer', id: t.id, title: t.name, subtitle: 'Remorcă', terms: [t.name, t.id].map(fold) });
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
        hits.push({ kind: en.kind, id: en.id, game: 'ats', title: en.title, subtitle: en.subtitle, score });
      }
    }
    hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    return hits.slice(0, limit);
  }

  city(id: string): CityRecord | undefined {
    return this.cityById.get(id) ?? this.cityById.get(id.replace(/_/g, '-'));
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
}
