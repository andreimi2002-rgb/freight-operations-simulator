// Route planner: every real job from a city (or one of its depots) to another city, or a
// list of destinations when no destination is chosen. State lives in the URL query
// (?from=&depot=&to=&trailer=&base=1&hazmat=0) so a plan can be bookmarked or shared.
import { possibleJobs, missionId } from '../engine/generator.mjs';
import { owned } from './dlcs.mjs';
import { loadJobs, el, badges, depotLabel, distanceText, weightText, trailerName, cityPathOf } from './jobs.mjs';
import { currentUnits, pageText, fill } from './units.mjs';

const form = document.getElementById('planner-form');
const results = document.getElementById('planner-results');
const PAGE = 60;

if (form && results) {
  const t = pageText();
  const msg = results.querySelector('[data-msg]');
  const out = results.querySelector('[data-out]');
  const f = {
    from: form.querySelector('#pl-from'),
    depot: form.querySelector('#pl-depot'),
    to: form.querySelector('#pl-to'),
    trailer: form.querySelector('#pl-trailer'),
    base: form.querySelector('#pl-base'),
    hazmat: form.querySelector('#pl-hazmat'),
    mine: form.querySelector('#pl-mine'),
  };
  let shown = PAGE;

  // Restore from the URL.
  const q = new URLSearchParams(location.search);
  if (q.get('from')) f.from.value = q.get('from');
  if (q.get('to')) f.to.value = q.get('to');
  if (q.get('trailer')) f.trailer.value = q.get('trailer');
  f.base.checked = q.get('base') === '1';
  f.hazmat.checked = q.get('hazmat') !== '0';
  f.mine.checked = q.get('mine') === '1';
  const wantedDepot = q.get('depot');

  const setMsg = (text) => { msg.textContent = text ?? ''; msg.hidden = !text; };

  loadJobs().then((ds) => {
    const fillDepots = () => {
      const from = f.from.value;
      f.depot.replaceChildren(el('option', { value: '', text: t.planner?.anyDepot }));
      const list = from ? (ds._index.depotsByCity.get(from) ?? []) : [];
      for (const i of list) f.depot.append(el('option', { value: String(i), text: depotLabel(ds, ds.depots[i]) }));
      f.depot.disabled = !list.length;
    };
    fillDepots();
    if (wantedDepot && [...f.depot.options].some((o) => o.value === wantedDepot)) f.depot.value = wantedDepot;

    const syncUrl = () => {
      const p = new URLSearchParams();
      if (f.from.value) p.set('from', f.from.value);
      if (f.depot.value) p.set('depot', f.depot.value);
      if (f.to.value) p.set('to', f.to.value);
      if (f.trailer.value) p.set('trailer', f.trailer.value);
      if (f.base.checked) p.set('base', '1');
      if (!f.hazmat.checked) p.set('hazmat', '0');
      if (f.mine.checked) p.set('mine', '1');
      const qs = p.toString();
      history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
    };

    const render = () => {
      const units = currentUnits();
      out.replaceChildren();
      const from = f.from.value;
      if (!from) { setMsg(t.planner?.pickFrom); return; }
      const fromCity = ds.cityById.get(from);
      const ownedSet = f.mine.checked ? owned() : null;
      if (f.mine.checked && !ownedSet) { setMsg(t.dlcs?.notSet); return; }
      const jobs = possibleJobs(ds, {
        ownedDlcs: ownedSet,
        from,
        depot: f.depot.value === '' ? null : Number(f.depot.value),
        to: f.to.value || null,
        baseOnly: f.base.checked,
        allowHazmat: f.hazmat.checked,
        trailer: f.trailer.value || null,
      });
      if (!jobs.length) { setMsg(t.planner?.none); return; }
      setMsg('');

      if (!f.to.value) {
        // Destinations overview.
        const byCity = new Map();
        for (const j of jobs) {
          if (!byCity.has(j.to)) byCity.set(j.to, { km: j.km, hours: j.hours, n: 0, cargo: new Set() });
          const g = byCity.get(j.to);
          g.n++;
          g.cargo.add(j.cargo);
        }
        const rows = [...byCity.entries()].sort((a, b) => a[1].km - b[1].km);
        out.append(el('h2', { text: fill(t.planner?.destinations, { n: rows.length, city: fromCity.name }) }));
        const tbody = el('tbody');
        for (const [cityId, g] of rows) {
          const c = ds.cityById.get(cityId);
          const btn = el('button', { type: 'button', class: 'linkish', text: c.name, 'aria-label': fill(t.planner?.showJobs, { city: c.name }) });
          btn.addEventListener('click', () => { f.to.value = cityId; shown = PAGE; syncUrl(); render(); });
          tbody.append(el('tr', {},
            el('td', {}, btn, el('small', { text: c.state })),
            el('td', { class: 'num', text: distanceText(g.km, units, g.hours, t) }),
            el('td', { class: 'num', text: fill(t.planner?.jobsTo, { n: g.n }) }),
          ));
        }
        out.append(el('div', { class: 'table-scroll' }, el('table', { class: 'dest' },
          el('thead', {}, el('tr', {},
            el('th', { scope: 'col', text: t.planner?.cols?.destination }),
            el('th', { scope: 'col', text: t.planner?.cols?.distance }),
            el('th', { scope: 'col', text: t.planner?.cols?.jobs }),
          )),
          tbody,
        )));
        return;
      }

      // Jobs between two cities, grouped by cargo name then depots.
      const toCity = ds.cityById.get(f.to.value);
      const cargoName = (id) => ds._index.cargo.get(id).name;
      jobs.sort((a, b) => cargoName(a.cargo).localeCompare(cargoName(b.cargo)) || a.source - b.source || a.destination - b.destination);
      const bar = el('div', { class: 'bar' },
        el('h2', { text: fill(t.planner?.jobsBetween, { n: jobs.length, from: fromCity.name, to: toCity.name }) }),
      );
      const back = el('button', { type: 'button', class: 'button button-ghost', text: t.planner?.backToAll });
      back.addEventListener('click', () => { f.to.value = ''; syncUrl(); render(); });
      bar.append(back);
      out.append(bar);
      const tbody = el('tbody');
      for (const j of jobs.slice(0, shown)) {
        const cargo = ds._index.cargo.get(j.cargo);
        const w = cargo.w ? `${weightText(cargo.w[0], units)} – ${weightText(cargo.w[1], units)}` : t.planner?.weightUnknown;
        tbody.append(el('tr', {},
          el('td', {}, el('a', { class: 'cargo-link', href: `/ats/mission/${missionId(ds, { ...j, trailer: null, weightLb: null })}`, text: cargo.name }), badges(ds, j.cargo, j.dlcs, t)),
          el('td', { text: depotLabel(ds, ds.depots[j.source]) }),
          el('td', { text: depotLabel(ds, ds.depots[j.destination]) }),
          el('td', { text: cargo.trailers.map((id) => trailerName(ds, id)).join(', ') }),
          el('td', { class: 'num', text: w }),
          el('td', { class: 'num', text: distanceText(j.km, units, j.hours, t) }),
        ));
      }
      out.append(el('div', { class: 'table-scroll' }, el('table', { class: 'jobs' },
        el('thead', {}, el('tr', {},
          el('th', { scope: 'col', text: t.planner?.cols?.cargo }),
          el('th', { scope: 'col', text: t.planner?.cols?.offeredBy }),
          el('th', { scope: 'col', text: fill(t.planner?.cols?.acceptedBy, { city: toCity.name }) }),
          el('th', { scope: 'col', text: t.planner?.trailers }),
          el('th', { scope: 'col', text: t.planner?.cols?.weight }),
          el('th', { scope: 'col', text: t.planner?.cols?.distance }),
        )),
        tbody,
      )));
      if (jobs.length > shown) {
        const more = el('button', { type: 'button', class: 'button button-ghost more', text: fill(t.planner?.showMore, { n: Math.min(PAGE, jobs.length - shown) }) });
        more.addEventListener('click', () => { shown += PAGE; render(); });
        out.append(more);
      }
    };

    form.addEventListener('change', (e) => {
      if (e.target === f.from) fillDepots();
      shown = PAGE;
      syncUrl();
      render();
    });
    form.addEventListener('submit', (e) => e.preventDefault());
    document.addEventListener('fw:units', render);
    document.addEventListener('fw:dlcs', render);
    results.dataset.state = 'ready';
    render();
  }).catch(() => { setMsg(t.planner?.error); results.dataset.state = 'error'; });
}
