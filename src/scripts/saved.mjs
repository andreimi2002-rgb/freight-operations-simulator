// Favorites and history in localStorage. Every read and write is guarded: in a private
// window or with storage blocked the pages work as before, only nothing is remembered.
import { parseState, emptyState, toggleFav, addRecent, isFav, normUrl } from '../lib/saved.mjs';
import { pageText } from './units.mjs';

const KEY = 'fw:saved';

export function loadSaved() {
  try { return parseState(localStorage.getItem(KEY)); } catch { return emptyState(); }
}

export function storeSaved(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage blocked */ }
  document.dispatchEvent(new CustomEvent('fw:saved'));
}

const urlOf = (btn) => normUrl(btn.dataset.url || location.pathname);
const itemOf = (btn) => ({ type: btn.dataset.type, name: btn.dataset.name, detail: btn.dataset.detail ?? '', url: urlOf(btn) });

/** Updates a star button's pressed state and label. */
export function paintSave(btn) {
  const t = pageText().saved ?? {};
  const on = isFav(loadSaved(), urlOf(btn));
  btn.setAttribute('aria-pressed', String(on));
  const label = btn.querySelector('[data-save-label]');
  if (label) label.textContent = on ? t.savedButton ?? '' : t.saveButton ?? '';
}

/** Adds this page to the history (job sheets call it once they know the job). */
export function recordVisit(btn) {
  if (btn?.dataset.name) storeSaved(addRecent(loadSaved(), itemOf(btn)));
}

const buttons = document.querySelectorAll('[data-save]');
for (const btn of buttons) {
  paintSave(btn);
  btn.addEventListener('click', () => {
    if (!btn.dataset.name) return;
    storeSaved(toggleFav(loadSaved(), itemOf(btn)));
    paintSave(btn);
  });
  if (btn.dataset.name) recordVisit(btn);
}
// Another tab changed the list.
window.addEventListener('storage', (e) => {
  if (e.key === KEY) { buttons.forEach(paintSave); document.dispatchEvent(new CustomEvent('fw:saved')); }
});
