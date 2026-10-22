// Draws the /saved page from localStorage and keeps it in sync with other tabs.
import { groupFavs, removeFav, clearRecent } from '../lib/saved.mjs';
import { loadSaved, storeSaved } from './saved.mjs';
import { pageText, fill } from './units.mjs';

const root = document.querySelector('[data-saved-page]');

if (root) {
  const t = pageText().saved ?? {};
  const favsBox = root.querySelector('[data-favs]');
  const recentBox = root.querySelector('[data-recent]');
  const clearBtn = root.querySelector('[data-clear-recent]');
  const fmtDate = new Intl.DateTimeFormat(document.documentElement.lang || 'en', { dateStyle: 'medium', timeStyle: 'short' });

  const node = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  const card = (item, { removable, when }) => {
    const li = node('li', 'saved-item');
    const a = node('a');
    a.href = item.url;
    a.append(node('span', 'saved-type', t.types?.[item.type] ?? item.type), node('span', 'saved-name', item.name));
    const detail = [item.detail, when && item.at ? fmtDate.format(item.at) : ''].filter(Boolean).join(' · ');
    if (detail) a.append(node('span', 'saved-detail', detail));
    li.append(a);
    if (removable) {
      const b = node('button', 'saved-remove', '×');
      b.type = 'button';
      b.setAttribute('aria-label', fill(t.remove, { name: item.name }));
      b.addEventListener('click', () => storeSaved(removeFav(loadSaved(), item.url)));
      li.append(b);
    }
    return li;
  };

  const render = () => {
    const state = loadSaved();
    const groups = groupFavs(state);
    favsBox.replaceChildren();
    if (!groups.length) favsBox.append(node('p', 'muted', t.noFavs));
    for (const [type, list] of groups) {
      const ul = node('ul');
      list.forEach((x) => ul.append(card(x, { removable: true })));
      favsBox.append(node('h3', 'eyebrow', `${t.groups?.[type] ?? type} · ${list.length}`), ul);
    }
    recentBox.replaceChildren();
    clearBtn.hidden = !state.recent.length;
    if (!state.recent.length) recentBox.append(node('p', 'muted', t.noRecent));
    else {
      const ul = node('ul');
      state.recent.forEach((x) => ul.append(card(x, { when: true })));
      recentBox.append(ul);
    }
  };

  clearBtn.addEventListener('click', () => storeSaved(clearRecent(loadSaved())));
  document.addEventListener('fw:saved', render);
  render();
}
