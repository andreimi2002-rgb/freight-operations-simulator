// Pure helpers for the company pages. Every relation is computed from the same depot data
// as the job generator, so it only lists links that are possible in the game.

export function companyPath(company) {
  return `/ats/company/${company.id}`;
}

/** Two-letter monogram from a company name ("Coastline Mining" → "CM", "Apade" → "AP"). */
export function monogram(name) {
  const words = String(name).replace(/['’]/g, '').replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? '?').slice(0, 2).toUpperCase();
}

/** Every cargo id a depot type offers or accepts, with the DLC sections included. */
function cargoOf(depotType, side) {
  const ids = new Set(depotType[side]);
  for (const v of Object.values(depotType.dlcCargo ?? {})) v[side].forEach((id) => ids.add(id));
  return ids;
}

/**
 * Where a company's cargo can go (side "provides" → partners that accept it) or who can
 * supply it (side "accepts" → partners that provide it). Only partner depots in another
 * city than at least one of the company's depots offering/accepting that cargo.
 * Returns [{ company, cargo: [cargoId], cities: [cityId] }] sorted by number of cargo.
 */
export function companyRelations(company, companies, side) {
  const other = side === 'provides' ? 'accepts' : 'provides';
  const out = new Map();
  for (const mine of company.depotTypes) {
    const myCargo = cargoOf(mine, side);
    if (!myCargo.size) continue;
    for (const partner of companies) {
      for (const theirs of partner.depotTypes) {
        const shared = [...cargoOf(theirs, other)].filter((id) => myCargo.has(id));
        if (!shared.length) continue;
        // Their cities that are not the only city of my depot type (a job needs two cities).
        const cities = theirs.cities.filter((c) => mine.cities.some((m) => m !== c));
        if (!cities.length) continue;
        if (!out.has(partner.id)) out.set(partner.id, { company: partner, cargo: new Set(), cities: new Set() });
        const r = out.get(partner.id);
        shared.forEach((id) => r.cargo.add(id));
        cities.forEach((c) => r.cities.add(c));
      }
    }
  }
  return [...out.values()]
    .map((r) => ({ company: r.company, cargo: [...r.cargo].sort(), cities: [...r.cities].sort() }))
    .sort((a, b) => b.cargo.length - a.cargo.length || a.company.name.localeCompare(b.company.name));
}

/** Companies grouped by category, each group sorted by name; categories sorted by name. */
export function companiesByCategory(companies) {
  const groups = new Map();
  for (const c of companies) {
    const key = c.category ?? 'other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  return [...groups.entries()]
    .map(([category, list]) => ({ category, companies: list.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

/** Distinct cities of a company. */
export function companyCities(company) {
  return [...new Set(company.depotTypes.flatMap((d) => d.cities))].sort();
}
