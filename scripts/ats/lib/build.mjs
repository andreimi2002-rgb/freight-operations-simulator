// Assemble cities / companies / cargo / trailers / issues from parsed wiki
// pages. Pure: all inputs are passed in, so the rules are testable offline.

import { slug, nameKey } from './wikitext.mjs';

/**
 * @param input {
 *   scope,
 *   cityPages, companyPages, trailerPages: parsed pages (+ revid),
 *   cargoRows: rows of the cargo list,
 *   titleRedirects: Map(linked title → final title),
 *   cargoSummary: counts stated in the cargo list summary,
 *   coordinates: Map(cityId → coords | { error }),
 *   pageUrl: (title) => url
 * }
 */
export function buildDataset(input) {
  const { scope, cityPages, companyPages, cargoRows, trailerPages, coordinates, pageUrl } = input;
  const titleRedirects = input.titleRedirects ?? new Map();
  const issues = [];
  const issue = (kind, entity, detail, extra = {}) => issues.push({ kind, entity, detail, ...extra });
  const stateByName = new Map(scope.states.map((s) => [s.name, s]));
  const resolveTitle = (t) => titleRedirects.get(t) ?? t;

  // ---- Cargo -------------------------------------------------------------
  // Two different cargoes may share a name (e.g. a base game and a DLC
  // version); those get the DLC appended to their id.
  const nameCount = new Map();
  for (const r of cargoRows) nameCount.set(nameKey(r.name), (nameCount.get(nameKey(r.name)) ?? 0) + 1);
  const cargo = [];
  const cargoByKey = new Map();
  for (const row of cargoRows) {
    const dlc = row.introducedWith.kind === 'dlc' ? slug(row.introducedWith.name) : 'base';
    let id = slug(row.name);
    if (nameCount.get(nameKey(row.name)) > 1 && dlc !== 'base') id = `${id}-${dlc}`;
    if (cargo.some((c) => c.id === id)) { issue('duplicate', id, `cargo "${row.name}" is listed twice on the cargo list with the same DLC; the second row is ignored`); continue; }
    const item = {
      id,
      gameId: null,
      name: row.name,
      dlc,
      introducedWith: row.introducedWith,
      weightLb: row.weightLb,
      valuePerKm: row.valuePerKm,
      valuePerKmRange: row.valuePerKmRange,
      valuePerKmAlt: row.valuePerKmAlt,
      un: row.un,
      unExpected: row.unExpected,
      dynamicLoading: row.dynamicLoading,
      flags: row.flags,
      hazmatClass: row.hazmatClasses?.length === 1 ? row.hazmatClasses[0] : null,
      trailerTypes: row.trailerTypes, // names; mapped to trailer ids below
    };
    cargo.push(item);
    const list = cargoByKey.get(nameKey(row.name)) ?? [];
    list.push(item);
    cargoByKey.set(nameKey(row.name), list);
    if (nameCount.get(nameKey(row.name)) > 1) issue('sameName', id, `"${row.name}" names more than one cargo on the cargo list; this one is the ${dlc === 'base' ? 'base game' : row.introducedWith.name} version`);
    if (!row.weightLb) issue('unknownValue', id, `weight on the cargo list is "${row.weightRaw || 'empty'}"`, { field: 'weightLb' });
    if (row.valuePerKm == null && !row.valuePerKmRange) issue('unknownValue', id, `value on the cargo list is "${row.valueRaw || 'empty'}"`, { field: 'valuePerKm' });
    if (row.valuePerKmRange) issue('valueRange', id, `value on the cargo list is a range (${row.valueRaw}); valuePerKm is empty, valuePerKmRange holds it`, { field: 'valuePerKm' });
    if (row.unFlagged) issue('flaggedOnWiki', id, `UN number ${row.un} (as shown in game) is marked on the wiki as not matching the cargo or its ADR skill${row.unExpected ? `; the wiki gives ${row.unExpected}` : ''}`);
    if (row.unRaw) issue('unknownValue', id, `UN cell on the cargo list is "${row.unRaw}", not a four-digit UN number; un left empty`, { field: 'un' });
    if (row.unknownSkillIcons.length) issue('unknownValue', id, `unrecognised skill icons: ${row.unknownSkillIcons.join(', ')}`, { field: 'flags' });
    if (row.introducedWith.kind === 'unknown') issue('unknownValue', id, `DLC/Patch cell is ${row.introducedWith.name ? `"${row.introducedWith.name}"` : 'empty'}`, { field: 'introducedWith' });
  }

  const unknownCargo = [];
  const variants = new Map();
  // Owner-approved corrections (data/ats/aliases.json): name → cargo ids.
  const aliasByKey = new Map();
  const cargoIds = new Set(cargo.map((c) => c.id));
  for (const a of input.aliases?.cargo ?? []) {
    const bad = a.cargo.filter((id) => !cargoIds.has(id));
    if (bad.length) { issue('aliasError', slug(a.name), `alias "${a.name}" points to cargo not in the catalog: ${bad.join(', ')}; ignored`); continue; }
    aliasByKey.set(nameKey(a.name), { ...a, where: new Set() });
  }
  /**
   * Cargo ids for a name seen on another page; `dlcName` is the "With … DLC"
   * section it was listed in. Usually one id; an approved generic alias gives several.
   */
  const cargoIdsFor = (name, where, dlcName = null) => {
    let list = cargoByKey.get(nameKey(name));
    if (!list) {
      const alias = aliasByKey.get(nameKey(name));
      if (alias) { alias.where.add(where); return alias.cargo; }
    }
    let variant = null;
    if (!list) {
      // Singular/plural spelling ("Frozen Foods" / "Frozen Food").
      const alt = nameKey(name).endsWith('s') ? nameKey(name).slice(0, -1) : `${nameKey(name)}s`;
      list = cargoByKey.get(alt);
      if (list) variant = list[0].name;
    }
    if (!list) { unknownCargo.push({ name, where }); return []; }
    if (variant) {
      const v = variants.get(name) ?? { matched: variant, where: new Set() };
      v.where.add(where);
      variants.set(name, v);
    }
    if (list.length === 1) return [list[0].id];
    const wanted = dlcName ? slug(dlcName) : 'base';
    const hit = list.find((c) => c.dlc === wanted);
    if (hit) return [hit.id];
    issue('ambiguousCargo', slug(name), `"${name}" in ${where} could be ${list.map((c) => c.id).join(' or ')}`);
    return [];
  };
  const genericAlias = (name) => {
    const a = aliasByKey.get(nameKey(name));
    return a?.generic && !cargoByKey.has(nameKey(name)) ? a : null;
  };

  // ---- Cities ------------------------------------------------------------
  const cities = [];
  const cityByTitle = new Map();
  for (const p of cityPages) {
    if (!p.name) { issue('parseError', p.title, (p.notes ?? []).join('; ')); continue; }
    const state = scope.states.find((s) => s.code === p.state);
    if (!state) { issue('parseError', p.title, `state "${p.state}" not in scope`); continue; }
    let id = slug(p.name);
    if (cities.some((c) => c.id === id)) id = `${id}-${state.code.toLowerCase()}`;
    // A state may override the game time zone mapping (Arizona: no daylight saving time).
    const iana = state.timezones?.[p.timezoneGame] ?? scope.timezones[p.timezoneGame] ?? null;
    if (!iana) issue('unknownValue', id, `time zone "${p.timezoneGame}" has no IANA mapping in scope.json`, { field: 'timezone' });
    const city = {
      id,
      gameId: null,
      name: p.name,
      state: state.code,
      dlc: p.dlc,
      addedInUpdate: p.addedInUpdate,
      timezone: { game: p.timezoneGame, iana },
      coordinates: null,
      companyCount: p.companyCount,
      depots: [],
      truckDealers: p.truckDealers,
      facilities: p.facilities,
      facilityDetails: p.facilityDetails,
      roads: p.roads,
      neighbors: [],
      landmarks: p.landmarks,
      wiki: { url: pageUrl(p.title), revid: p.revid },
    };
    Object.defineProperty(city, '_page', { value: p, enumerable: false });
    cities.push(city);
    cityByTitle.set(p.title, city);
    for (const note of p.notes) issue('parseNote', id, note);
  }
  const cityFor = (title, stateCode = null) => {
    const direct = cityByTitle.get(title) ?? cityByTitle.get(resolveTitle(title));
    if (direct) return { city: direct, byName: false };
    // A link to a disambiguation page ("Huron") inside a state row: match by name in that state.
    if (stateCode) {
      const byName = cities.filter((c) => c.state === stateCode && nameKey(c.name) === nameKey(title));
      if (byName.length === 1) return { city: byName[0], byName: true };
    }
    return null;
  };

  // ---- Companies (only depot types with a city in scope) ------------------
  const companies = [];
  const companyByTitle = new Map();
  for (const p of companyPages) {
    if (p.removed) continue; // marked {{Removed|ATS}} on the wiki
    if (!p.depotTypes) {
      issue('skippedPage', p.title, `in the company category but ${(p.notes ?? []).join('; ')} (not a company with depots)`);
      continue;
    }
    const id = slug(p.name);
    const types = [];
    for (const d of p.depotTypes) {
      const cityIds = [];
      const locations = {};
      for (const [stateName, titles] of Object.entries(d.citiesByState)) {
        const st = stateByName.get(stateName);
        if (!st) continue;
        for (const t of titles) {
          const hit = cityFor(t, st.code);
          if (!hit) { issue('unknownCity', id, `depot type "${d.type ?? '(unnamed)'}" lists "${t}" in ${stateName}, which is not a current city in scope`); continue; }
          if (hit.byName) issue('linkResolvedByName', id, `"${t}" (${stateName}) links to a page that is not the city page; matched to ${hit.city.id} by name and state`);
          cityIds.push(hit.city.id);
          if (d.locations?.[t]) locations[hit.city.id] = d.locations[t];
        }
      }
      if (cityIds.length) types.push({ d, cityIds: [...new Set(cityIds)].sort(), locations });
    }
    // Parse notes matter for companies in scope, or for pages that mention a
    // state in scope but yielded no depots there (a layout we may have missed).
    if (types.length || p.mentionsScope) {
      for (const note of p.notes) issue('parseNote', id, types.length ? note : `${note} (page mentions a state in scope)`);
    }
    if (!types.length) continue;
    const depotTypes = types.map(({ d, cityIds, locations }) => {
      const gameId = d.gameIds[0] ?? (p.defIds.length === 1 && p.depotTypes.length === 1 ? p.defIds[0] : null);
      if (!gameId) issue('missingGameId', id, `depot type "${d.type ?? '(unnamed)'}" has no internal game ID on the wiki`, { entityType: 'depotType' });
      if (d.gameIds.length > 1) issue('multipleGameIds', id, `depot type "${d.type}" lists several IDs: ${d.gameIds.join(', ')}; the first is used`);
      const where = `${p.name} / ${d.type ?? '(unnamed)'}`;
      const genericNames = {};
      const mapList = (list, dlcName = null) => {
        for (const n of list) { const g = genericAlias(n); if (g) genericNames[n] = g.cargo; }
        return [...new Set(list.flatMap((n) => cargoIdsFor(n, where, dlcName)))].sort();
      };
      let accepts = [];
      let provides = [];
      const dlcCargo = {};
      if (d.cargo) {
        accepts = mapList(d.cargo.accepts.base);
        provides = mapList(d.cargo.provides.base);
        for (const side of ['accepts', 'provides']) {
          for (const [dlcName, list] of Object.entries(d.cargo[side].dlc)) {
            const key = slug(dlcName);
            dlcCargo[key] = dlcCargo[key] ?? { name: dlcName, accepts: [], provides: [] };
            dlcCargo[key][side] = mapList(list, dlcName);
          }
        }
        if (d.cargo.shared) issue('parseNote', id, `one cargo table is shared by all depot types; applied to "${d.type}"`);
      } else {
        issue('unknownValue', id, `no cargo list found for depot type "${d.type ?? '(unnamed)'}"`, { field: 'accepts/provides' });
      }
      const out = { gameId, type: d.type, cities: cityIds, locations, accepts, provides, dlcCargo };
      // Marks cargo that came from a generic name on the wiki (approved alias to every variant).
      if (Object.keys(genericNames).length) out.genericNames = genericNames;
      return out;
    });
    const company = {
      id,
      name: p.name,
      fullName: p.fullName && p.fullName !== p.name ? p.fullName : null,
      category: p.category,
      industry: p.industry,
      defIds: p.defIds,
      depotTypes,
      wiki: { url: pageUrl(p.title), revid: p.revid },
    };
    companies.push(company);
    companyByTitle.set(p.title, company);
  }

  // Depots on each city, from the company pages (primary source).
  const cityById = new Map(cities.map((c) => [c.id, c]));
  for (const co of companies) {
    for (const d of co.depotTypes) {
      for (const cid of d.cities) {
        const depot = { company: co.id, depotGameId: d.gameId, type: d.type };
        if (d.locations[cid]) depot.location = d.locations[cid];
        cityById.get(cid).depots.push(depot);
      }
    }
  }

  // ---- Cross-checks between city pages and company pages ------------------
  for (const city of cities) {
    const p = city._page;
    const fromCity = new Set();
    for (const t of p.depotLinks) {
      const co = companyByTitle.get(t) ?? companyByTitle.get(resolveTitle(t));
      if (co) fromCity.add(co.id);
    }
    const fromCompanies = new Set(city.depots.map((d) => d.company));
    for (const co of fromCompanies) {
      if (!fromCity.has(co)) issue('mismatch', city.id, `company page "${co}" lists a depot in ${city.name}; the city page's Depots section does not mention it`);
    }
    for (const co of fromCity) {
      if (!fromCompanies.has(co)) issue('mismatch', city.id, `city page's Depots section mentions "${co}"; that company page does not list ${city.name}`);
    }
    if (city.companyCount != null && city.companyCount !== city.depots.length) {
      issue('mismatch', city.id, `city infobox says ${city.companyCount} companies; company pages give ${city.depots.length} depots`, { field: 'companyCount' });
    }
    const n = new Set();
    for (const t of p.connectionLinks) {
      const hit = cityFor(t);
      if (hit && hit.city.id !== city.id) n.add(hit.city.id);
    }
    city.neighbors = [...n].sort();
    city.depots.sort((a, b) => a.company.localeCompare(b.company) || String(a.type).localeCompare(String(b.type)));
  }

  // ---- Coordinates -------------------------------------------------------
  for (const city of cities) {
    const c = coordinates.get(city.id);
    if (c && !c.error) city.coordinates = { lat: c.lat, lon: c.lon, wikidata: c.wikidata };
    else issue('missingCoordinates', city.id, c?.error ?? 'not looked up');
  }

  // ---- Trailers ----------------------------------------------------------
  // Two levels. Trailer types come from the cargo list (what each cargo can go
  // on). Dealer trailer pages are models of a type: joined by the same name,
  // otherwise by the cargo they carry (Jaccard overlap of the page's cargo
  // icons and the type's cargo on the cargo list, best unique match >= 0.5).
  // Spellings that differ only in spaces/case ("Dropdeck" / "Drop Deck") are
  // one type, named by the spelling most cargo uses.
  const spellings = new Map();
  for (const c of cargo) for (const t of c.trailerTypes) {
    const k = nameKey(t);
    const m = spellings.get(k) ?? new Map();
    m.set(t, (m.get(t) ?? 0) + 1);
    spellings.set(k, m);
  }
  const typeIdOf = new Map();
  const typeNames = [];
  for (const m of spellings.values()) {
    const [canon] = [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    typeNames.push(canon);
    for (const t of m.keys()) {
      typeIdOf.set(t, slug(canon));
      if (t !== canon) issue('nameVariant', slug(canon), `cargo list writes trailer type "${t}" for ${m.get(t)} cargo; treated as "${canon}"`);
    }
  }
  typeNames.sort();
  for (const c of cargo) c.trailerTypes = [...new Set(c.trailerTypes.map((t) => typeIdOf.get(t)))].sort();
  const cargoOn = (tid) => cargo.filter((c) => c.trailerTypes.includes(tid)).map((c) => c.id).sort();
  const types = typeNames.map((t) => ({ id: slug(t), name: t, cargo: cargoOn(slug(t)), models: [] }));
  const quietCargoIds = (names) => {
    const ids = new Set();
    for (const n of names) {
      const list = cargoByKey.get(nameKey(n));
      if (list) list.forEach((c) => ids.add(c.id));
    }
    return ids;
  };
  const jaccard = (a, b) => {
    const inter = [...a].filter((x) => b.has(x)).length;
    const union = new Set([...a, ...b]).size;
    return union ? inter / union : 0;
  };
  for (const p of trailerPages) {
    if (!p.name) { issue('parseError', p.title, (p.notes ?? []).join('; ')); continue; }
    const pageCargo = quietCargoIds(p.cargo);
    // Pages found as "<Type> Trailer" for a type with no dealer page carry forType.
    let type = p.forType
      ? types.find((t) => t.name === p.forType)
      : types.find((t) => nameKey(t.name) === nameKey(p.name));
    let match = { by: p.forType ? 'page title' : 'name' };
    if (!type) {
      const scored = types.map((t) => ({ t, score: jaccard(pageCargo, new Set(t.cargo)) })).sort((a, b) => b.score - a.score);
      const [best, second] = scored;
      if (best && best.score >= 0.5 && (!second || second.score < best.score)) {
        type = best.t;
        match = { by: 'cargo overlap', jaccard: Math.round(best.score * 100) / 100 };
        issue('trailerModelMatch', slug(p.name), `dealer trailer "${p.name}" joined to cargo-list type "${type.name}" by shared cargo (Jaccard ${match.jaccard})`);
      }
    }
    if (!type) {
      issue('unmatchedTrailer', slug(p.name), `dealer trailer "${p.name}" matches no trailer type on the cargo list; left out`);
      continue;
    }
    if ((p.pricesUsd ?? []).length > 1) issue('multiplePrices', slug(p.name), `trailer page gives several prices (${p.pricesUsd.join(' / ')}) without saying what each is; priceUsd is empty, pricesUsd holds them`, { field: 'priceUsd' });
    type.models.push({
      id: slug(p.name),
      name: p.name,
      priceUsd: p.priceUsd,
      pricesUsd: p.pricesUsd ?? (p.priceUsd != null ? [p.priceUsd] : []),
      ownable: p.ownable,
      articulated: p.articulated,
      cargoTypesNote: p.cargoTypesNote,
      match,
      wiki: { url: pageUrl(p.title), revid: p.revid },
    });
  }
  const trailers = types;
  const noModel = trailers.filter((t) => !t.models.length).map((t) => t.id);
  if (noModel.length) issue('noTrailerPage', 'trailers', 'Trailer types on the cargo list without a dealer trailer page; price, ownable and articulated are unknown.', { ids: noModel });

  // ---- Cargo list summary vs rows -----------------------------------------
  if (input.cargoSummary) {
    const s = input.cargoSummary;
    const rowsBy = {};
    for (const c of cargo) rowsBy[c.dlc] = (rowsBy[c.dlc] ?? 0) + 1;
    const check = (label, stated, counted) => {
      if (stated != null && stated !== counted) issue('countMismatch', 'cargo', `cargo list summary (as of ${s.asOfUpdate ?? '?'}) says ${stated} ${label}; the table has ${counted}`);
    };
    check('base cargoes', s.base, rowsBy.base ?? 0);
    for (const [name, n] of Object.entries(s.dlc)) check(`cargoes in ${name}`, n, rowsBy[slug(name)] ?? 0);
    check('cargoes in total', s.total, cargo.length);
  }


  // ---- Trucks -------------------------------------------------------------
  const trucks = [];
  for (const p of input.truckPages ?? []) {
    if (!p.name) { issue('parseError', p.title, (p.notes ?? []).join('; ')); continue; }
    const id = slug(p.name);
    if (p.future) { issue('futureTruck', id, `"${p.name}" is announced but not released (no engine data); left out`); continue; }
    if (p.maxHp == null) issue('unknownValue', id, 'no horsepower found in the engine list', { field: 'engines' });
    trucks.push({
      id,
      gameId: null,
      name: p.name,
      manufacturer: p.manufacturer,
      electric: p.electric,
      engines: p.engines,
      maxHp: p.maxHp,
      bodyStyles: p.bodyStyles,
      transmissions: p.transmissions,
      availability: p.availability,
      dateAdded: p.dateAdded,
      wiki: { url: pageUrl(p.title), revid: p.revid },
    });
  }

  // ---- Aggregated issues ---------------------------------------------------
  const unknownByName = new Map();
  for (const u of unknownCargo) {
    const list = unknownByName.get(u.name) ?? new Set();
    list.add(u.where);
    unknownByName.set(u.name, list);
  }
  for (const [name, where] of unknownByName) issue('unknownCargo', slug(name), `"${name}" is not on the cargo list (left out)`, { seenIn: [...where] });
  for (const [name, v] of variants) issue('nameVariant', slug(name), `"${name}" is not on the cargo list; matched to "${v.matched}" (singular/plural)`, { seenIn: [...v.where] });
  for (const a of aliasByKey.values()) {
    if (!a.where.size) continue;
    issue('aliasApplied', slug(a.name), `"${a.name}" → ${a.cargo.join(', ')} (${a.reason}; data/ats/aliases.json)`, { seenIn: [...a.where], generic: Boolean(a.generic) });
  }

  issue('missingGameId', 'cities', 'The wiki gives no internal game IDs for cities.', { entityType: 'city', ids: cities.map((x) => x.id) });
  issue('missingGameId', 'cargo', 'The wiki gives no internal game IDs for cargo.', { entityType: 'cargo', ids: cargo.map((x) => x.id) });

  const byId = (a, b) => a.id.localeCompare(b.id);
  return {
    cities: cities.sort(byId),
    companies: companies.sort(byId),
    cargo: cargo.sort(byId),
    trailers: trailers.sort(byId),
    trucks: trucks.sort(byId),
    issues,
  };
}
