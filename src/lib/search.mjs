// Search index and ranking for the header search. Pure: built at build time into
// /data/search.json, ranked in the browser and in the tests with the same code.
import { cityPath } from './ats.mjs';
import { companyPath } from './companies.mjs';
import { cargoPath, trailerPath, truckPath } from './catalog.mjs';

export const SEARCH_TYPES = ['city', 'company', 'cargo', 'trailer', 'truck'];

/** Lowercase, no accents, single spaces. */
export function norm(s) {
  return String(s ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Entries: [type, name, detail, url]. */
export function buildSearchIndex({ cities, companies, cargo, trailers, trucks, stateName = (c) => c, dlcName = () => '' }) {
  const out = [];
  for (const c of cities) out.push(['city', c.name, stateName(c.state), cityPath(c)]);
  for (const c of companies) out.push(['company', c.fullName ?? c.name, c.industry ?? '', companyPath(c)]);
  for (const c of cargo) out.push(['cargo', c.name, dlcName(c.dlc), cargoPath(c)]);
  for (const t of trailers) out.push(['trailer', t.name, '', trailerPath(t)]);
  for (const t of trucks) out.push(['truck', t.name, t.manufacturer ?? '', truckPath(t)]);
  return out;
}

/**
 * Rank entries for a query: whole name starts with the query, then a word starts with it,
 * then the name contains it, then the detail contains it. Ties: shorter names first.
 */
export function searchIndex(index, query, limit = 12) {
  const q = norm(query);
  if (!q) return [];
  const scored = [];
  for (const e of index) {
    const n = norm(e[1]);
    let score = -1;
    if (n.startsWith(q)) score = 0;
    else if (` ${n}`.includes(` ${q}`)) score = 1;
    else if (n.includes(q)) score = 2;
    else if (norm(e[2]).includes(q)) score = 3;
    if (score >= 0) scored.push([score, n.length, e]);
  }
  scored.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2][1].localeCompare(b[2][1]));
  return scored.slice(0, limit).map((s) => s[2]);
}
