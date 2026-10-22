// "My DLCs": the cargo DLCs the player owns, kept in this browser. Until the player saves a
// choice, nothing is filtered (owned() returns null). A change is announced with "fw:dlcs".
const KEY = 'fw-dlcs';

export function owned() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return v && Array.isArray(v.owned) ? new Set(v.owned) : null;
  } catch { return null; }
}

export function saveOwned(list) {
  try { localStorage.setItem(KEY, JSON.stringify({ owned: [...list] })); } catch { /* storage blocked */ }
  document.dispatchEvent(new CustomEvent('fw:dlcs'));
}

export function clearOwned() {
  try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
  document.dispatchEvent(new CustomEvent('fw:dlcs'));
}

/** True when the player saved a choice and a job needs a DLC outside it. */
export function missingDlcs(dlcs) {
  const set = owned();
  return set ? dlcs.filter((d) => !set.has(d)) : [];
}

// Wire the dialog in the header (one per page).
const dialog = document.getElementById('dlc-dialog');
const open = document.querySelector('[data-dlc-open]');
if (dialog && open) {
  const boxes = () => [...dialog.querySelectorAll('input[name="dlc"]')];
  const sync = () => {
    const set = owned();
    boxes().forEach((b) => { b.checked = set ? set.has(b.value) : false; });
    const count = open.querySelector('[data-dlc-count]');
    if (count) count.textContent = set ? String(set.size) : '';
  };
  sync();
  open.addEventListener('click', () => { sync(); dialog.showModal(); });
  dialog.querySelector('[data-dlc-save]').addEventListener('click', () => {
    saveOwned(boxes().filter((b) => b.checked).map((b) => b.value));
    sync();
    dialog.close();
  });
  dialog.querySelector('[data-dlc-clear]').addEventListener('click', () => { clearOwned(); sync(); dialog.close(); });
  dialog.querySelector('[data-dlc-close]').addEventListener('click', () => dialog.close());
}
