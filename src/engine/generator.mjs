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
export function possibleJobs(ds, { from, depot = null, to = null, baseOnly = false, ownedDlcs = null, allowHazmat = true, trailer = null, company = null } = {}) {
  const ix = indexDataset(ds);
  const out = [];
  const sources = (ix.depotsByCity.get(from) ?? []).filter((i) => (depot === null || i === depot) && (company === null || ds.depots[i].company === company));
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

/**
 * One random job, reproducible from its seed (a 32-bit number; shown and shared as hex).
 * `from` limits the start city (null = any city with jobs). Cargo without a known weight
 * is left out. Returns null when nothing matches.
 */
export function randomJob(ds, { seed, from = null, baseOnly = false, ownedDlcs = null, company = null } = {}) {
  const ix = indexDataset(ds);
  const rand = rng(seed >>> 0);
  const starts = from ? [from] : ds.cities.map((c) => c.id).filter((id) => (ix.depotsByCity.get(id) ?? []).some((i) => company === null || ds.depots[i].company === company));
  // Try a few start cities in seed order until one has a matching job.
  const order = [...starts];
  for (let i = order.length - 1; i > 0; i--) {
    const k = Math.floor(rand() * (i + 1));
    [order[i], order[k]] = [order[k], order[i]];
  }
  for (const city of order.slice(0, company ? order.length : 8)) {
    const jobs = possibleJobs(ds, { from: city, baseOnly, ownedDlcs, company }).filter((j) => ix.cargo.get(j.cargo).w);
    if (!jobs.length) continue;
    const j = pick(rand, jobs);
    const cargo = ix.cargo.get(j.cargo);
    const [wMin, wMax] = cargo.w;
    const weightLb = Math.min(wMax, Math.max(wMin, Math.round((wMin + rand() * (wMax - wMin)) / 10) * 10));
    return { seed: seed >>> 0, from: city, ...j, trailer: pick(rand, cargo.trailers), weightLb };
  }
  return null;
}

/** Seed ⇄ short code for the address ("a1b2c3d4"). */
export const seedToCode = (seed) => (seed >>> 0).toString(16).padStart(8, '0');
export const codeToSeed = (code) => (/^[0-9a-f]{1,8}$/i.test(String(code ?? '')) ? parseInt(code, 16) >>> 0 : null);

// ---- Job sheet: stable ids and truck recommendation ------------------------------

const slugish = (s) => String(s ?? 'depot').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Stable key of a depot: its game id, or company + type when the wiki gives none. */
export function depotKey(depot) {
  return depot.gameId ?? `${depot.company}--${slugish(depot.type)}`;
}

/**
 * Job id for the sheet URL, built from stable ids so it survives a data refresh:
 * from.depot.cargo.to.depot.trailer.weight ("-" for trailer/weight when not chosen).
 */
export function missionId(ds, job) {
  const src = ds.depots[job.source];
  const dst = ds.depots[job.destination];
  return [src.city, depotKey(src), job.cargo, dst.city, depotKey(dst), job.trailer ?? '-', job.weightLb ?? '-'].join('.');
}

/** Resolve a job id against the current data: the job, or { error } saying why not. */
export function resolveMission(ds, id) {
  const parts = String(id ?? '').split('.');
  if (parts.length !== 7) return { error: 'badId' };
  const [from, srcKey, cargoId, to, dstKey, trailer, weight] = parts;
  const ix = indexDataset(ds);
  const cargo = ix.cargo.get(cargoId);
  if (!cargo) return { error: 'gone' };
  const find = (city, key) => (ix.depotsByCity.get(city) ?? []).find((i) => depotKey(ds.depots[i]) === key);
  const source = find(from, srcKey);
  const destination = find(to, dstKey);
  if (source === undefined || destination === undefined) return { error: 'gone' };
  const job = possibleJobs(ds, { from, depot: source, to }).find((j) => j.cargo === cargoId && j.destination === destination);
  if (!job) return { error: 'gone' };
  const trailerId = trailer === '-' ? null : trailer;
  if (trailerId && !cargo.trailers.includes(trailerId)) return { error: 'gone' };
  const weightLb = weight === '-' ? null : Number(weight);
  if (weightLb !== null && (!Number.isFinite(weightLb) || !cargo.w || weightLb < cargo.w[0] || weightLb > cargo.w[1])) return { error: 'gone' };
  return { ...job, from, trailer: trailerId, weightLb };
}

/**
 * Freight World truck recommendation (a simulated rule, shown as such on the sheet):
 * minimum engine power by cargo weight, more for heavy cargo; trucks sold at a dealer in
 * the start city first; electric trucks left out (no range data).
 */
export const TRUCK_RULE = { bands: [{ upToLb: 25000, hp: 400 }, { upToLb: 45000, hp: 450 }, { upToLb: Infinity, hp: 500 }], heavyHp: 550 };

export function neededHp(cargo, weightLb) {
  if (cargo.flags.includes('heavy')) return TRUCK_RULE.heavyHp;
  const w = weightLb ?? cargo.w?.[1] ?? 0;
  return TRUCK_RULE.bands.find((b) => w <= b.upToLb).hp;
}

export function recommendTrucks(ds, job, { max = 4 } = {}) {
  const ix = indexDataset(ds);
  const cargo = ix.cargo.get(job.cargo);
  const need = neededHp(cargo, job.weightLb);
  const dealers = new Set((ix.cities.get(job.from)?.dealers ?? []).map((d) => d.toLowerCase()));
  const list = (ds.trucks ?? [])
    .filter((t) => !t.electric && t.hp != null && t.hp >= need)
    .map((t) => ({ ...t, dealerHere: dealers.has(String(t.make).toLowerCase()) }))
    .sort((a, b) => Number(b.dealerHere) - Number(a.dealerHere) || a.hp - b.hp || a.name.localeCompare(b.name));
  return { needHp: need, trucks: list.slice(0, max) };
}

// ---- Job chain: what to take next from the destination ------------------------------

/**
 * Next jobs from the city a job delivers to (so the truck does not run empty).
 * Picks `count` jobs with different cargo, reproducible from the current job; jobs that can
 * use the same trailer type come first, then jobs heading back towards the start city.
 * Each result carries a trailer (the same one when possible) and a weight.
 */
export function chainJobs(ds, job, { count = 6, ownedDlcs = null, baseOnly = false } = {}) {
  const ix = indexDataset(ds);
  const all = possibleJobs(ds, { from: job.to, ownedDlcs, baseOnly }).filter((j) => ix.cargo.get(j.cargo).w);
  if (!all.length) return [];
  const rand = rng(hash(`chain|${job.from}|${job.to}|${job.cargo}|${job.source}|${job.destination}`));
  const home = ds.km[`${job.to}>${job.from}`] ?? Infinity;
  const scored = all.map((j) => {
    const cargo = ix.cargo.get(j.cargo);
    const sameTrailer = Boolean(job.trailer && cargo.trailers.includes(job.trailer));
    const backHome = j.to === job.from || (ds.km[`${j.to}>${job.from}`] ?? Infinity) < home * 0.5;
    return { j, cargo, sameTrailer, backHome, r: rand() };
  });
  scored.sort((a, b) => Number(b.sameTrailer) - Number(a.sameTrailer) || Number(b.backHome) - Number(a.backHome) || a.r - b.r);
  const out = [];
  const seenCargo = new Set();
  for (const s of scored) {
    if (out.length >= count) break;
    if (seenCargo.has(s.cargo.id)) continue;
    seenCargo.add(s.cargo.id);
    const [wMin, wMax] = s.cargo.w;
    const weightLb = Math.min(wMax, Math.max(wMin, Math.round((wMin + rand() * (wMax - wMin)) / 10) * 10));
    out.push({ ...s.j, from: job.to, trailer: s.sameTrailer ? job.trailer : s.cargo.trailers[0], weightLb, sameTrailer: s.sameTrailer, backHome: s.backHome });
  }
  return out;
}
