import {
  GAMEDATA_EXTRACTOR_VERSION,
  type GameData,
  type GameId,
  type GdCargo,
  type GdCity,
  type GdCompany,
  type GdCountry,
  type GdEngine,
  type GdTrailer,
  type GdTruck,
} from '@trucksim/core';
import { parseSii, sii, type SiiUnit } from '../scs/sii.ts';
import { GameFs } from '../scs/vfs.ts';

/**
 * Extracts countries, cities, companies (with depots and cargo) and cargo
 * from an ETS2/ATS installation. Reads only plain-text definition files.
 */

const LANGS = ['ro_ro', 'en_us'] as const;

/** "chocolate.dlc_balkan_e.sii" -> { id: "chocolate", dlc: "dlc_balkan_e" } */
function splitName(file: string): { id: string; dlc: string | null } {
  const base = file.replace(/\.(sii|sui)$/i, '');
  const dot = base.indexOf('.');
  if (dot < 0) return { id: base, dlc: null };
  const suffix = base.slice(dot + 1);
  return { id: base.slice(0, dot), dlc: suffix.startsWith('dlc_') ? suffix : null };
}

/** DLC of a definition file, from its name suffix or from the archive providing it. */
function dlcOf(fs: GameFs, path: string): string | null {
  const fromName = splitName(path.split('/').pop() ?? '').dlc;
  return fromName ?? fs.provider(path)?.dlc ?? null;
}

/** All units from def/<base>.sii and every def/<base>.<suffix>.sii, includes followed. */
function unitsOf(fs: GameFs, base: string): SiiUnit[] {
  const read = (p: string) => fs.readText(p);
  const files = fs.list('def').filter((n) => !n.endsWith('/') && (n === `${base}.sii` || (n.startsWith(`${base}.`) && n.endsWith('.sii'))));
  const out: SiiUnit[] = [];
  for (const f of files) {
    const path = `def/${f}`;
    const text = fs.readText(path);
    if (text) out.push(...parseSii(path, text, read));
  }
  return out;
}

/** Loads the localization tables (key -> text) for a language from all archives. */
function loadLocale(fs: GameFs, lang: string): Map<string, string> {
  const map = new Map<string, string>();
  const read = (p: string) => fs.readText(p);
  const files = fs.list(`locale/${lang}`).filter((n) => !n.endsWith('/') && /\.(sii)$/i.test(n));
  // Base files first, overrides last.
  files.sort((a, b) => Number(a.includes('override')) - Number(b.includes('override')) || a.localeCompare(b));
  for (const f of files) {
    const path = `locale/${lang}/${f}`;
    // Every archive can carry its own copy (DLC strings): read each one.
    for (const m of fs.archives) {
      const buf = m.archive.read(path);
      if (!buf) continue;
      for (const u of parseSii(path, buf.toString('utf8'), read)) {
        if (u.className !== 'localization_db') continue;
        const keys = u.attrs.key;
        const vals = u.attrs.val;
        if (!Array.isArray(keys) || !Array.isArray(vals)) continue;
        keys.forEach((k, i) => {
          const v = vals[i];
          if (typeof k === 'string' && typeof v === 'string') map.set(k, v);
        });
      }
    }
  }
  return map;
}

function localize(value: string | null, table: Map<string, string>): string | null {
  if (!value) return null;
  const m = /^@@(.+)@@$/.exec(value);
  return m ? (table.get(m[1]!) ?? null) : value;
}

/** Replaces every @@key@@ inside a string ("770 @@hp@@ (566@@kw@@)"). */
function localizeInline(value: string | null, table: Map<string, string>): string | null {
  if (!value) return null;
  return value.replace(/@@([^@]+)@@/g, (_, k: string) => table.get(k) ?? '').replace(/\s+/g, ' ').trim();
}

/** First unit of a definition file in a truck directory. */
function unitIn(fs: GameFs, path: string, className: string): SiiUnit | null {
  const text = fs.readText(path);
  if (!text) return null;
  const read = (p: string) => fs.readText(p);
  return parseSii(path, text, read).find((u) => u.className === className) ?? null;
}

function partNames(fs: GameFs, dir: string, className: string, table: Map<string, string>): string[] {
  const names: string[] = [];
  for (const f of fs.list(dir)) {
    if (!f.endsWith('.sii')) continue;
    const u = unitIn(fs, `${dir}/${f}`, className);
    const n = u ? localize(sii.str(u, 'name'), table) : null;
    if (n && !names.includes(n)) names.push(n);
  }
  return names;
}

/** Player trucks: def/vehicle/truck/<brand.model>/ with data.sii, engines, gearboxes, cabins, chassis. */
function extractTrucks(fs: GameFs, en: Map<string, string>, ro: Map<string, string>): GdTruck[] {
  const trucks: GdTruck[] = [];
  for (const dir of fs.list('def/vehicle/truck')) {
    if (!dir.endsWith('/')) continue;
    const id = dir.slice(0, -1);
    const base = `def/vehicle/truck/${id}`;
    const data = unitIn(fs, `${base}/data.sii`, 'accessory_truck_data');
    if (!data) continue;
    const info = sii.list(data, 'info');
    const brand = localizeInline(info[0] ?? null, en) || id.split('.')[0]!;
    const model = localizeInline(info[1] ?? null, en) || id.split('.').slice(1).join(' ');
    const engines: GdEngine[] = [];
    for (const f of fs.list(`${base}/engine`)) {
      if (!f.endsWith('.sii')) continue;
      const u = unitIn(fs, `${base}/engine/${f}`, 'accessory_engine_data');
      if (!u) continue;
      const rawInfo = sii.list(u, 'info')[0] ?? '';
      const hp = /(\d[\d.,]*)\s*@@hp@@/.exec(rawInfo);
      const kw = /(\d[\d.,]*)\s*@@kw@@/.exec(rawInfo);
      const num = (m: RegExpExecArray | null) => (m ? Number(m[1]!.replace(/[.,]/g, '')) : null);
      engines.push({
        id: splitName(f).id,
        name: localize(sii.str(u, 'name'), ro) ?? localize(sii.str(u, 'name'), en) ?? splitName(f).id,
        hp: num(hp),
        kw: num(kw),
        torqueNm: sii.num(u, 'torque'),
        volumeL: sii.num(u, 'volume'),
        price: sii.num(u, 'price'),
        unlock: sii.num(u, 'unlock'),
      });
    }
    engines.sort((a, b) => (a.hp ?? a.kw ?? 0) - (b.hp ?? b.kw ?? 0));
    trucks.push({
      id,
      brand,
      model,
      electric: /electric|etech|\d{4}e$|_e$/.test(id) || (engines.length > 0 && engines.every((e) => e.volumeL === null && e.hp === null)),
      dlc: dlcOf(fs, `${base}/data.sii`),
      engines,
      transmissions: partNames(fs, `${base}/transmission`, 'accessory_transmission_data', ro),
      cabins: partNames(fs, `${base}/cabin`, 'accessory_cabin_data', ro),
      chassis: partNames(fs, `${base}/chassis`, 'accessory_chassis_data', ro),
    });
  }
  // Two trucks can share a series name (Iveco Stralis and Stralis Hi-Way): add the cabin to the variant.
  const key = (t: GdTruck) => `${t.brand}|${t.model}`;
  const counts = new Map<string, number>();
  for (const t of trucks) counts.set(key(t), (counts.get(key(t)) ?? 0) + 1);
  for (const t of trucks) {
    const variant = t.id.split('.').slice(1).join('.');
    const plain = t.model.toLowerCase().replace(/[^a-z0-9]/g, '');
    if ((counts.get(key(t)) ?? 0) > 1 && variant.replace(/[^a-z0-9]/g, '') !== plain && t.cabins[0] && !t.model.includes(t.cabins[0])) {
      t.model = `${t.model} ${t.cabins[0]}`;
    }
  }
  return trucks.sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`));
}

/** Ownable trailers, including trailer DLC brands (Krone, Schmitz, Kögel, ...). */
function extractTrailers(fs: GameFs, en: Map<string, string>, ro: Map<string, string>): GdTrailer[] {
  const out: GdTrailer[] = [];
  for (const dir of fs.list('def/vehicle/trailer_owned')) {
    if (!dir.endsWith('/')) continue;
    const id = dir.slice(0, -1);
    const base = `def/vehicle/trailer_owned/${id}`;
    const data = unitIn(fs, `${base}/data.sii`, 'accessory_trailer_data');
    if (!data) continue;
    const info = sii.list(data, 'info');
    const bodies: GdTrailer['bodies'] = [];
    for (const f of fs.list(`${base}/body`)) {
      if (!f.endsWith('.sii')) continue;
      const u = unitIn(fs, `${base}/body/${f}`, 'accessory_trailer_body_data');
      if (!u) continue;
      const total = u.attrs.total_size;
      const name = localize(sii.str(u, 'name'), ro) ?? localize(sii.str(u, 'name'), en) ?? splitName(f).id;
      if (bodies.some((b) => b.name === name)) continue;
      bodies.push({
        name,
        bodyType: u.name.split('.')[0] ?? '',
        volumeM3: sii.num(u, 'volume'),
        lengthM: Array.isArray(total) && typeof total[2] === 'number' ? Math.round(total[2] * 100) / 100 : null,
      });
    }
    out.push({
      id,
      brand: localizeInline(info[0] ?? null, en) || id.split('.')[0]!,
      model: localizeInline(info[1] ?? null, ro) || localizeInline(info[1] ?? null, en) || id.split('.').slice(1).join(' '),
      dlc: dlcOf(fs, `${base}/data.sii`),
      bodies,
      chassis: partNames(fs, `${base}/chassis`, 'accessory_chassis_data', ro),
    });
  }
  return out.sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`));
}

/** "trailer : trailer.schw_curtain { trailer_definition: trailer_def.schwmuller.curtain... }" */
function extractTrailerAliases(fs: GameFs): Record<string, string> {
  const out: Record<string, string> = {};
  const read = (p: string) => fs.readText(p);
  for (const f of fs.list('def/vehicle/trailer')) {
    if (f.endsWith('/') || !/\.(sui|sii)$/i.test(f)) continue;
    const path = `def/vehicle/trailer/${f}`;
    const text = fs.readText(path);
    if (!text) continue;
    for (const u of parseSii(path, text, read)) {
      if (u.className !== 'trailer') continue;
      const def = sii.str(u, 'trailer_definition');
      if (def) out[u.name.replace(/^trailer\./, '')] = def.replace(/^trailer_def\./, '');
    }
  }
  return out;
}

const idFrom = (unitName: string, prefix: string) => (unitName.startsWith(prefix) ? unitName.slice(prefix.length) : unitName);

export interface ExtractResult {
  data: GameData;
  warnings: string[];
}

export function extractGameData(game: GameId, installDir: string): ExtractResult {
  const fs = new GameFs(installDir);
  const warnings = [...fs.errors];
  try {
    const ro = loadLocale(fs, 'ro_ro');
    const en = loadLocale(fs, 'en_us');
    const dlcs = fs.archives.map((a) => a.dlc).filter((d): d is string => Boolean(d));

    // Countries
    const countries: GdCountry[] = [];
    for (const u of unitsOf(fs, 'country')) {
      if (u.className !== 'country_data') continue;
      const key = sii.str(u, 'name_localized');
      countries.push({
        id: idFrom(u.name, 'country.data.'),
        name: localize(key, en) ?? sii.str(u, 'name') ?? u.name,
        nameRo: localize(key, ro),
        code: sii.str(u, 'country_code'),
        iso: sii.str(u, 'iso_country_code'),
        dlc: dlcOf(fs, u.source),
      });
    }

    // Cities
    const cities = new Map<string, GdCity>();
    for (const u of unitsOf(fs, 'city')) {
      if (u.className !== 'city_data') continue;
      const id = idFrom(u.name, 'city.');
      const key = sii.str(u, 'city_name_localized');
      cities.set(id, {
        id,
        // city_name is the local spelling (e.g. Cyrillic for Ruse); prefer the English UI name.
        name: localize(key, en) ?? sii.str(u, 'city_name') ?? id,
        nameRo: localize(key, ro),
        country: sii.str(u, 'country'),
        population: sii.num(u, 'population'),
        dlc: dlcOf(fs, u.source),
        companies: [],
      });
    }

    // Companies: names from company_permanent; depots, cargo from def/company/<id>/...
    const companies = new Map<string, GdCompany>();
    for (const u of unitsOf(fs, 'company')) {
      if (u.className !== 'company_permanent') continue;
      const id = idFrom(u.name, 'company.permanent.');
      companies.set(id, { id, name: sii.str(u, 'name') ?? id, cities: [], cargoOut: [], cargoIn: [], dlc: dlcOf(fs, u.source) });
    }
    for (const dir of fs.list('def/company')) {
      if (!dir.endsWith('/')) continue;
      const id = dir.slice(0, -1);
      const c = companies.get(id) ?? { id, name: id, cities: [], cargoOut: [], cargoIn: [], dlc: null };
      companies.set(id, c);
      const read = (p: string) => fs.readText(p);
      for (const f of fs.list(`def/company/${id}/editor`)) {
        if (f.endsWith('/')) continue;
        const path = `def/company/${id}/editor/${f}`;
        const text = fs.readText(path);
        let city: string | null = null;
        if (text) for (const u of parseSii(path, text, read)) if (u.className === 'company_def') city = sii.str(u, 'city') ?? city;
        city ??= splitName(f).id;
        if (!c.cities.includes(city)) c.cities.push(city);
        const ct = cities.get(city);
        if (ct && !ct.companies.includes(id)) ct.companies.push(id);
      }
      for (const [sub, list] of [['out', c.cargoOut], ['in', c.cargoIn]] as const) {
        for (const f of fs.list(`def/company/${id}/${sub}`)) {
          if (f.endsWith('/')) continue;
          const cargo = splitName(f).id;
          if (!list.includes(cargo)) list.push(cargo);
        }
      }
    }

    // Cargo
    const cargo: GdCargo[] = [];
    for (const u of unitsOf(fs, 'cargo')) {
      if (u.className !== 'cargo_data') continue;
      const key = sii.str(u, 'name');
      const adr = sii.num(u, 'adr_class');
      cargo.push({
        id: idFrom(u.name, 'cargo.'),
        name: localize(key, en) ?? key ?? u.name,
        nameRo: localize(key, ro),
        unitMassKg: sii.num(u, 'mass'),
        unitVolume: sii.num(u, 'volume'),
        rewardPerKm: sii.num(u, 'unit_reward_per_km'),
        fragility: sii.num(u, 'fragility'),
        adrClass: adr && adr > 0 ? adr : null,
        valuable: sii.bool(u, 'valuable') ?? false,
        overweight: sii.bool(u, 'overweight') ?? false,
        groups: sii.list(u, 'group'),
        bodyTypes: sii.list(u, 'body_types'),
        dlc: dlcOf(fs, u.source),
      });
    }

    if (!cities.size) warnings.push('No cities found: the archive layout may have changed.');
    const sortByName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);
    return {
      warnings,
      data: {
        meta: {
          game,
          generatedAt: new Date().toISOString(),
          archivesStamp: fs.stamp,
          archives: fs.archives.length,
          dlcs,
          languages: [...LANGS].filter((l) => (l === 'ro_ro' ? ro.size : en.size) > 0),
          extractorVersion: GAMEDATA_EXTRACTOR_VERSION,
        },
        countries: countries.sort(sortByName),
        cities: [...cities.values()].sort(sortByName),
        companies: [...companies.values()].filter((c) => c.cities.length || c.cargoOut.length || c.cargoIn.length).sort(sortByName),
        cargo: cargo.sort(sortByName),
        trucks: extractTrucks(fs, en, ro),
        trailers: extractTrailers(fs, en, ro),
        trailerAliases: extractTrailerAliases(fs),
      },
    };
  } finally {
    fs.close();
  }
}
