// Compact job dataset built from data/ats/*.json, shared by the browser (departures board,
// route planner) and the tests. Pure: pass the parsed files in.
import { pairKey } from './route-states.mjs';

/**
 * @returns {{
 *   cities: { id, name, state, tz }[],
 *   cargo: { id, name, dlc, w: [min,max]|null, trailers: string[], flags: string[], hz: string|null }[],
 *   trailers: { id, name, ownable: boolean|null }[],
 *   companies: { id, name }[],
 *   depots: { city, company, type, gameId, offers: { cargo, dlc }[], accepts: { cargo, dlc }[] }[],
 *   km: Record<string, number>,  // "from>to" → km (estimated)
 *   stateDlc: Record<string, string>, // state code → map DLC id ('base' = base game)
 *   via: Record<string, string[]>     // "a|b" (alphabetical) → states crossed between the two cities
 * }}
 */
export function buildJobDataset({ cities, companies, cargo, trailers, distances, trucks = [], routeStates = null }) {
  const depots = [];
  for (const co of companies) {
    for (const d of co.depotTypes) {
      const offers = d.provides.map((id) => ({ cargo: id, dlc: null }));
      const accepts = d.accepts.map((id) => ({ cargo: id, dlc: null }));
      for (const [dlc, v] of Object.entries(d.dlcCargo ?? {})) {
        v.provides.forEach((id) => offers.push({ cargo: id, dlc }));
        v.accepts.forEach((id) => accepts.push({ cargo: id, dlc }));
      }
      for (const city of d.cities) {
        depots.push({ city, company: co.id, type: d.type, gameId: d.gameId, offers, accepts });
      }
    }
  }
  const km = {};
  for (const p of distances.pairs) km[`${p.from}>${p.to}`] = p.km;
  // A state's map DLC is the DLC its cities come with on the wiki (all cities of a state agree).
  const stateDlc = {};
  for (const c of cities) stateDlc[c.state] = stateDlc[c.state] ?? c.dlc ?? 'base';
  return {
    cities: cities.map((c) => ({ id: c.id, name: c.name, state: c.state, tz: c.timezone.iana, dealers: c.truckDealers ?? [], dlc: c.dlc ?? 'base' })),
    cargo: cargo.map((c) => ({
      id: c.id,
      name: c.name,
      dlc: c.dlc,
      w: c.weightLb ? [c.weightLb.min, c.weightLb.max] : null,
      trailers: c.trailerTypes,
      flags: c.flags,
      hz: c.hazmatClass ?? null,
      un: c.un ?? null,
      unExpected: c.unExpected ?? null,
    })),
    trailers: trailers.map((t) => ({
      id: t.id,
      name: t.name,
      ownable: t.models.some((m) => m.ownable) ? true : (t.models.length ? false : null),
      models: t.models.map((m) => ({ name: m.name, priceUsd: m.priceUsd, pricesUsd: m.pricesUsd ?? [], ownable: m.ownable })),
    })),
    trucks: trucks.map((t) => ({ id: t.id, name: t.name, make: t.manufacturer, hp: t.maxHp, electric: t.electric })),
    companies: companies.map((c) => ({ id: c.id, name: c.fullName ?? c.name, industry: c.industry ?? null })),
    depots,
    km,
    stateDlc,
    via: routeStates?.via ?? {},
  };
}

// ---- Transport format -------------------------------------------------------
// The browser downloads the packed form: each depot type once, cargo and DLCs as indexes.

export function packJobDataset(ds) {
  const cargoIx = new Map(ds.cargo.map((c, i) => [c.id, i]));
  const dlcs = [...new Set(ds.depots.flatMap((d) => [...d.offers, ...d.accepts].map((x) => x.dlc)).filter(Boolean))].sort();
  const dlcIx = new Map(dlcs.map((d, i) => [d, i]));
  const types = [];
  const typeKey = new Map();
  const depots = [];
  const cityIx = new Map(ds.cities.map((c, i) => [c.id, i]));
  const companyIx = new Map(ds.companies.map((c, i) => [c.id, i]));
  const enc = (list) => list.map((x) => (x.dlc ? [cargoIx.get(x.cargo), dlcIx.get(x.dlc)] : cargoIx.get(x.cargo)));
  for (const d of ds.depots) {
    const key = `${d.company}|${d.type}|${d.gameId}`;
    if (!typeKey.has(key)) {
      typeKey.set(key, types.length);
      types.push([companyIx.get(d.company), d.type, d.gameId, enc(d.offers), enc(d.accepts)]);
    }
    depots.push([cityIx.get(d.city), typeKey.get(key)]);
  }
  const ids = ds.cities.map((c) => c.id);
  const km = [];
  for (let i = 0; i < ids.length; i++) {
    km.push(ids.map((to, j) => (i === j ? 0 : ds.km[`${ids[i]}>${to}`] ?? -1)));
  }
  // Route states as [cityIndex, cityIndex, "CA OR"] (the pair key is rebuilt on unpack).
  const via = Object.entries(ds.via ?? {}).map(([k, states]) => { const [a, b] = k.split('|'); return [cityIx.get(a), cityIx.get(b), states.join(' ')]; }).filter(([a, b]) => a !== undefined && b !== undefined);
  return { v: 3, cities: ds.cities, cargo: ds.cargo, trailers: ds.trailers, trucks: ds.trucks, companies: ds.companies, dlcs, types, depots, km, stateDlc: ds.stateDlc ?? {}, via };
}

export function unpackJobDataset(p) {
  const dec = (list) => list.map((x) => (Array.isArray(x) ? { cargo: p.cargo[x[0]].id, dlc: p.dlcs[x[1]] } : { cargo: p.cargo[x].id, dlc: null }));
  const types = p.types.map(([co, type, gameId, offers, accepts]) => ({ company: p.companies[co].id, type, gameId, offers: dec(offers), accepts: dec(accepts) }));
  const depots = p.depots.map(([ci, ti]) => ({ city: p.cities[ci].id, ...types[ti] }));
  const km = {};
  p.km.forEach((row, i) => row.forEach((v, j) => { if (i !== j && v >= 0) km[`${p.cities[i].id}>${p.cities[j].id}`] = v; }));
  const via = {};
  for (const [a, b, states] of p.via ?? []) via[pairKey(p.cities[a].id, p.cities[b].id)] = states.split(' ');
  return { cities: p.cities, cargo: p.cargo, trailers: p.trailers, trucks: p.trucks ?? [], companies: p.companies, depots, km, stateDlc: p.stateDlc ?? {}, via };
}
