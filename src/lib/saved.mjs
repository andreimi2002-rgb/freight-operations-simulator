// Favorites and recently viewed pages, kept only in the visitor's browser (no account).
// Pure functions on a plain state object; src/scripts/saved.mjs reads and writes localStorage.

export const SAVED_TYPES = ['city', 'company', 'cargo', 'trailer', 'truck', 'job'];
export const MAX_FAVS = 200;
export const MAX_RECENT = 30;

export const emptyState = () => ({ v: 1, favs: [], recent: [] });

/** Page path without the trailing slash ("/ats/az/phoenix/" -> "/ats/az/phoenix"). */
export const normUrl = (url) => (url.length > 1 ? url.replace(/\/+$/, '') : url);

const cleanItem = (x) => {
  if (!x || typeof x !== 'object') return null;
  if (!SAVED_TYPES.includes(x.type) || typeof x.url !== 'string' || !x.url.startsWith('/') || typeof x.name !== 'string' || !x.name) return null;
  return { type: x.type, url: normUrl(x.url), name: x.name.slice(0, 160), detail: typeof x.detail === 'string' ? x.detail.slice(0, 160) : '', at: Number.isFinite(x.at) ? x.at : 0 };
};

const cleanList = (list, max) => {
  const seen = new Set();
  const out = [];
  for (const x of Array.isArray(list) ? list : []) {
    const item = cleanItem(x);
    if (item && !seen.has(item.url)) { seen.add(item.url); out.push(item); }
    if (out.length >= max) break;
  }
  return out;
};

/** State from stored text; anything broken or unknown is dropped instead of throwing. */
export function parseState(text) {
  let raw;
  try { raw = JSON.parse(text ?? 'null'); } catch { return emptyState(); }
  if (!raw || typeof raw !== 'object') return emptyState();
  return { v: 1, favs: cleanList(raw.favs, MAX_FAVS), recent: cleanList(raw.recent, MAX_RECENT) };
}

export const isFav = (state, url) => state.favs.some((x) => x.url === normUrl(url));

/** Adds the item to favorites (newest first) or removes it if it is already there. */
export function toggleFav(state, item, now = Date.now()) {
  const it = cleanItem({ ...item, at: now });
  if (!it) return state;
  if (isFav(state, it.url)) return { ...state, favs: state.favs.filter((x) => x.url !== it.url) };
  return { ...state, favs: [it, ...state.favs].slice(0, MAX_FAVS) };
}

export const removeFav = (state, url) => ({ ...state, favs: state.favs.filter((x) => x.url !== normUrl(url)) });

/** Records a visit: the page moves to the top of the history, the oldest falls off. */
export function addRecent(state, item, now = Date.now()) {
  const it = cleanItem({ ...item, at: now });
  if (!it) return state;
  return { ...state, recent: [it, ...state.recent.filter((x) => x.url !== it.url)].slice(0, MAX_RECENT) };
}

export const clearRecent = (state) => ({ ...state, recent: [] });

/** Favorites grouped by type, in SAVED_TYPES order; empty groups left out. */
export function groupFavs(state) {
  return SAVED_TYPES.map((type) => [type, state.favs.filter((x) => x.type === type)]).filter(([, l]) => l.length);
}
