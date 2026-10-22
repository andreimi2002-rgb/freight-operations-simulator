// Header search: loads /data/search.json on first open and ranks it with searchIndex().
import { searchIndex } from '../lib/search.mjs';
import { pageText, fill } from './units.mjs';

const dialog = document.getElementById('search-dialog');
const open = document.querySelector('[data-search-open]');

if (dialog && open) {
  const t = pageText();
  const input = dialog.querySelector('#search-input');
  const list = dialog.querySelector('#search-results');
  const hint = dialog.querySelector('[data-search-hint]');
  let index = null;
  let loading = null;
  let active = -1;

  const load = () => (loading ??= fetch('/data/search.json').then((r) => r.json()).then((d) => { index = d; }).catch(() => { loading = null; }));

  const select = (i) => {
    const links = [...list.querySelectorAll('a')];
    active = links.length ? (i + links.length) % links.length : -1;
    links.forEach((a, k) => a.setAttribute('aria-selected', String(k === active)));
    if (active >= 0) {
      input.setAttribute('aria-activedescendant', links[active].id);
      links[active].scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  };

  const render = () => {
    const q = input.value;
    list.replaceChildren();
    active = -1;
    if (!q.trim()) { hint.textContent = t.search?.hint ?? ''; input.setAttribute('aria-expanded', 'false'); return; }
    if (!index) { hint.textContent = t.search?.loading ?? ''; return; }
    const results = searchIndex(index, q);
    hint.textContent = results.length ? '' : fill(t.search?.none, { q });
    results.forEach(([type, name, detail, url], i) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = url;
      a.id = `search-r${i}`;
      a.setAttribute('role', 'option');
      a.setAttribute('aria-selected', 'false');
      const ty = document.createElement('span');
      ty.className = 's-type';
      ty.textContent = t.search?.types?.[type] ?? type;
      const n = document.createElement('span');
      n.className = 's-name';
      n.textContent = name;
      const d = document.createElement('span');
      d.className = 's-detail';
      d.textContent = detail;
      a.append(ty, n, d);
      li.append(a);
      list.append(li);
    });
    input.setAttribute('aria-expanded', String(results.length > 0));
    if (results.length) select(0);
  };

  const show = () => {
    if (!dialog.open) dialog.showModal();
    input.focus();
    input.select();
    load().then(render);
  };

  const q = new URLSearchParams(location.search).get('q');
  if (q) { input.value = q; show(); }

  open.addEventListener('click', show);
  dialog.querySelector('[data-search-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); select(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); select(active - 1); }
    // A search field with text eats the first Escape (it clears itself); close at once instead.
    else if (e.key === 'Escape') { e.preventDefault(); dialog.close(); }
    else if (e.key === 'Enter') {
      const a = list.querySelectorAll('a')[active];
      if (a) { e.preventDefault(); location.href = a.href; }
    }
  });
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '') || document.activeElement?.isContentEditable;
    if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      show();
    }
  });
}
