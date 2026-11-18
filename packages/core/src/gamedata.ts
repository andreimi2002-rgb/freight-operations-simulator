import type { GameId } from './types.ts';

/**
 * Game data extracted on the PC from the player's own installation
 * (def/*.sii in the .scs archives, base game plus installed DLCs).
 * It is never committed or published: it belongs to SCS Software and
 * stays on the owner's machine, served to the app by the bridge.
 */

export interface GameDataMeta {
  game: GameId;
  generatedAt: string;
  /** Newest archive modification time when extracted (detects game updates). */
  archivesStamp: number;
  archives: number;
  dlcs: string[];
  languages: string[];
  extractorVersion: number;
}

export interface GdCountry {
  id: string;
  name: string;
  nameRo: string | null;
  code: string | null;
  iso: string | null;
  dlc: string | null;
}

export interface GdCity {
  id: string;
  name: string;
  nameRo: string | null;
  country: string | null;
  population: number | null;
  dlc: string | null;
  /** Company ids with a depot in this city. */
  companies: string[];
}

export interface GdCompany {
  id: string;
  name: string;
  /** Cities with a depot of this company. */
  cities: string[];
  /** Cargo ids the company ships out / accepts. */
  cargoOut: string[];
  cargoIn: string[];
  dlc: string | null;
}

export interface GdCargo {
  id: string;
  name: string;
  nameRo: string | null;
  /** Mass of one unit, kg. */
  unitMassKg: number | null;
  unitVolume: number | null;
  rewardPerKm: number | null;
  fragility: number | null;
  adrClass: number | null;
  valuable: boolean;
  overweight: boolean;
  groups: string[];
  bodyTypes: string[];
  dlc: string | null;
}

export interface GdEngine {
  id: string;
  name: string;
  hp: number | null;
  kw: number | null;
  torqueNm: number | null;
  /** Displacement, litres (null for electric). */
  volumeL: number | null;
  price: number | null;
  /** Level needed to buy it. */
  unlock: number | null;
}

export interface GdTruck {
  /** Directory id, e.g. "scania.s_2016". */
  id: string;
  brand: string;
  model: string;
  electric: boolean;
  dlc: string | null;
  engines: GdEngine[];
  transmissions: string[];
  cabins: string[];
  chassis: string[];
}

export interface GdTrailerBody {
  name: string;
  /** Game body type id: reefer, curtainside, dryvan, silo, ... */
  bodyType: string;
  volumeM3: number | null;
  /** Total length incl. chassis, metres. */
  lengthM: number | null;
}

/** Trailers the player can own (def/vehicle/trailer_owned), incl. trailer DLC brands. */
export interface GdTrailer {
  /** Directory id, e.g. "krone.coolliner"; the telemetry trailer id starts with it. */
  id: string;
  brand: string;
  model: string;
  dlc: string | null;
  bodies: GdTrailerBody[];
  chassis: string[];
}

export interface GameData {
  meta: GameDataMeta;
  countries: GdCountry[];
  cities: GdCity[];
  companies: GdCompany[];
  cargo: GdCargo[];
  trucks: GdTruck[];
  trailers: GdTrailer[];
  /**
   * Job trailers (def/vehicle/trailer, e.g. "schw_curtain") -> trailer definition
   * (e.g. "schwmuller.curtain.single_3.curtain"). Telemetry reports the job trailer
   * id with empty brand and name for these, so this is how they are identified.
   */
  trailerAliases?: Record<string, string>;
}

export const GAMEDATA_EXTRACTOR_VERSION = 4;
