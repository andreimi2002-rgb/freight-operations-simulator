// The unit system chosen in the header (US by default), shared by the page scripts.
// A change is announced with a "fw:units" event on document.
import { UNIT_SYSTEMS } from '../lib/ats.mjs';

export const UNITS_KEY = 'fw-units';

export function currentUnits() {
  try {
    const saved = localStorage.getItem(UNITS_KEY);
    if (UNIT_SYSTEMS.includes(saved)) return saved;
  } catch { /* storage blocked */ }
  return 'us';
}

export function saveUnits(sys) {
  try { localStorage.setItem(UNITS_KEY, sys); } catch { /* storage blocked */ }
  document.dispatchEvent(new CustomEvent('fw:units', { detail: sys }));
}

/** Page text passed by the layout as JSON (never hard-coded in scripts). */
export function pageText() {
  const el = document.getElementById('fw-live-text');
  try { return el ? JSON.parse(el.textContent) : {}; } catch { return {}; }
}

export const fill = (s, params) => String(s ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m));
