// Pure helpers for the cargo, trailer and truck pages. Relations are computed from the same
// depot data as the job generator, so they only show what exists in the game.

export const cargoPath = (c) => `/ats/cargo/${c.id}`;
export const trailerPath = (t) => `/ats/trailer/${t.id}`;
export const truckPath = (t) => `/ats/truck/${t.id}`;

/** Cargo name, with its DLC label added when another cargo has the same name (e.g. two Crawler Tractors). */
export function cargoTitle(c, all, dlcLabel) {
  return all.some((x) => x !== c && x.name === c.name) ? `${c.name} (${dlcLabel(c.dlc)})` : c.name;
}

/** Depot types that offer (side "provides") or accept (side "accepts") a cargo, with the DLC section. */
export function cargoDepots(cargoId, companies, side) {
  const out = [];
  for (const co of companies) {
    for (const d of co.depotTypes) {
      let dlc;
      if (d[side].includes(cargoId)) dlc = null;
      else {
        const hit = Object.entries(d.dlcCargo ?? {}).find(([, v]) => v[side].includes(cargoId));
        if (!hit) continue;
        dlc = hit[1].name;
      }
      out.push({ company: co, type: d.type, gameId: d.gameId, cities: d.cities, dlc });
    }
  }
  return out.sort((a, b) => a.company.name.localeCompare(b.company.name));
}

/**
 * City pairs where a cargo can travel (an offering depot in one city, an accepting depot in
 * another), with the estimated distance. Returns the `n` longest and shortest pairs.
 */
export function cargoRoutes(cargoId, companies, distances, n = 5) {
  const from = new Set(cargoDepots(cargoId, companies, 'provides').flatMap((d) => d.cities));
  const to = new Set(cargoDepots(cargoId, companies, 'accepts').flatMap((d) => d.cities));
  const km = new Map(distances.pairs.map((p) => [`${p.from}>${p.to}`, p.km]));
  const pairs = [];
  for (const a of from) for (const b of to) {
    if (a === b) continue;
    const k = km.get(`${a}>${b}`);
    if (k != null) pairs.push({ from: a, to: b, km: k });
  }
  pairs.sort((x, y) => y.km - x.km);
  return { count: pairs.length, longest: pairs.slice(0, n), shortest: pairs.slice(-n).reverse() };
}

/** Cities whose truck dealer list includes a truck make ("Peterbilt" matches "Peterbilt (large)"). */
export function dealerCities(make, cities) {
  const m = String(make).toLowerCase();
  return cities.filter((c) => (c.truckDealers ?? []).some((d) => d.toLowerCase().startsWith(m)));
}
