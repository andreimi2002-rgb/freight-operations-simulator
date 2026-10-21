// Freight World job generator (DEVELOPMENT_PLAN.md, section 7). Pure and deterministic:
// the same city, local date and local hour give the same jobs to everyone. Kept free of
// browser and Astro code so the companion app can reuse it.
//
// Every job is possible in the game by construction: the source depot offers the cargo, the
// destination depot (in another city) accepts it, the trailer is one the cargo list allows,
// and the weight is inside the cargo's range. No pay is computed (no public formula inputs).

export const AVG_SPEED_KMH = 88.5; // 55 mph, the California truck speed limit; basis of the time estimate

// ---- Seeded random ------------------------------------------------------------

/** 32-bit FNV-1a hash of a string. */
export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small, fast, deterministic PRNG returning floats in [0, 1). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)];

// ---- Indexes ------------------------------------------------------------------

/** Lookups built once per dataset. */
export function indexDataset(ds) {
  if (ds._index) return ds._index;
  const cargo = new Map(ds.cargo.map((c) => [c.id, c]));
  const acceptors = new Map(); // cargoId → [{ depot, dlc }]
  ds.depots.forEach((d, i) => {
    for (const a of d.accepts) {
      if (!acceptors.has(a.cargo)) acceptors.set(a.cargo, []);
      acceptors.get(a.cargo).push({ depot: i, dlc: a.dlc });
    }
  });
  const depotsByCity = new Map();
  ds.depots.forEach((d, i) => {
    if (!depotsByCity.has(d.city)) depotsByCity.set(d.city, []);
    depotsByCity.get(d.city).push(i);
  });
  const index = { cargo, acceptors, depotsByCity, cities: new Map(ds.cities.map((c) => [c.id, c])) };
  Object.defineProperty(ds, '_index', { value: index, enumerable: false });
  return index;
}

/** DLCs a job needs: the cargo's pack and the DLC sections it was listed under at either end. */
function requiredDlcs(cargo, offerDlc, acceptDlc) {
  const set = new Set();
  if (cargo.dlc && cargo.dlc !== 'base') set.add(cargo.dlc);
  if (offerDlc) set.add(offerDlc);
  if (acceptDlc) set.add(acceptDlc);
  return [...set].sort();
}

/** Estimated drive time in game hours at the average speed. */
export function driveHours(km) {
  return Math.round((km / AVG_SPEED_KMH) * 10) / 10;
}

/**
 * All real jobs from a city (optionally one depot) to another city (optional).
 * Filters: { baseOnly, ownedDlcs: Set, allowHazmat, trailer }.
 * Cargo without a known weight is included with weight null.
 */
export function possibleJobs(ds, { from, depot = null, to = null, baseOnly = false, ownedDlcs = null, allowHazmat = true, trailer = null } = {}) {
  const ix = indexDataset(ds);
  const out = [];
  const sources = (ix.depotsByCity.get(from) ?? []).filter((i) => depot === null || i === depot);
  for (const si of sources) {
    const src = ds.depots[si];
    for (const offer of src.offers) {
      const cargo = ix.cargo.get(offer.cargo);
      if (!cargo) continue;
      if (!allowHazmat && cargo.hz) continue;
      if (trailer && !cargo.trailers.includes(trailer)) continue;
      for (const acc of ix.acceptors.get(cargo.id) ?? []) {
        const dst = ds.depots[acc.depot];
        if (dst.city === from || (to && dst.city !== to)) continue;
        const km = ds.km[`${from}>${dst.city}`];
        if (km == null) continue;
        const dlcs = requiredDlcs(cargo, offer.dlc, acc.dlc);
        if (baseOnly && dlcs.length) continue;
        if (ownedDlcs && dlcs.some((d) => !ownedDlcs.has(d))) continue;
        out.push({ source: si, cargo: cargo.id, destination: acc.depot, to: dst.city, km, hours: driveHours(km), dlcs });
      }
    }
  }
  return out;
}

/**
 * Departures board for a city at a local date (YYYY-MM-DD) and hour (0-23): `count` jobs
 * leaving within the next `hours` hours, sorted by departure time. Cargo without a known
 * weight is left out of the board (it stays in the planner).
 */
export function departures(ds, { city, date, hour, count = 12, hours = 6, baseOnly = false } = {}) {
  const ix = indexDataset(ds);
  const all = possibleJobs(ds, { from: city, baseOnly }).filter((j) => ix.cargo.get(j.cargo).w);
  if (!all.length) return [];
  const rand = rng(hash(`${city}|${date}|${hour}`));
  // Group by source depot so a big depot does not take the whole board.
  const bySource = new Map();
  for (const j of all) {
    if (!bySource.has(j.source)) bySource.set(j.source, []);
    bySource.get(j.source).push(j);
  }
  const sources = [...bySource.keys()].sort((a, b) => a - b);
  const jobs = [];
  const seen = new Set();
  for (let n = 0; jobs.length < count && n < count * 10; n++) {
    const options = bySource.get(pick(rand, sources));
    const j = pick(rand, options);
    const key = `${j.source}|${j.cargo}|${j.destination}`;
    const minute = Math.floor(rand() * hours * 60);
    const cargo = ix.cargo.get(j.cargo);
    const trailer = pick(rand, cargo.trailers);
    const [wMin, wMax] = cargo.w;
    const weightLb = Math.round((wMin + rand() * (wMax - wMin)) / 10) * 10;
    if (seen.has(key)) continue;
    seen.add(key);
    jobs.push({
      id: `${city}-${date.replace(/-/g, '')}-${String(hour).padStart(2, '0')}-${jobs.length + 1}`,
      departMinute: hour * 60 + minute, // minutes after local midnight of `date` (may pass 24 h)
      ...j,
      trailer,
      weightLb: Math.min(wMax, Math.max(wMin, weightLb)),
    });
  }
  return jobs.sort((a, b) => a.departMinute - b.departMinute || a.id.localeCompare(b.id));
}

/** The city featured on the home page for a UTC date and hour (same for everyone). */
export function featuredCity(ds, { date, hour }) {
  const rand = rng(hash(`featured|${date}|${hour}`));
  const withDepots = ds.cities.filter((c) => (indexDataset(ds).depotsByCity.get(c.id) ?? []).length);
  return pick(rand, withDepots).id;
}
