// Shared browser code for job data: loading the packed dataset once, and small DOM helpers
// for cargo badges and job cells. Text comes from the page JSON (pageText()).
import { unpackJobDataset } from '../engine/dataset.mjs';
import { indexDataset } from '../engine/generator.mjs';
import { distance, weight } from '../lib/ats.mjs';
import { fill } from './units.mjs';

let loading = null;

/** The job dataset (unpacked, indexed), fetched once per page. */
export function loadJobs() {
  if (!loading) {
    loading = fetch('/data/ats-jobs.json')
      .then((r) => { if (!r.ok) throw new Error(`jobs ${r.status}`); return r.json(); })
      .then((packed) => {
        const ds = unpackJobDataset(packed);
        indexDataset(ds);
        ds.cityById = new Map(ds.cities.map((c) => [c.id, c]));
        ds.companyById = new Map(ds.companies.map((c) => [c.id, c]));
        ds.trailerById = new Map(ds.trailers.map((t) => [t.id, t]));
        return ds;
      });
    loading.catch(() => { loading = null; });
  }
  return loading;
}

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

export function cityPathOf(city) {
  return `/ats/${city.state.toLowerCase()}/${city.id}`;
}

/** Badges for what a job needs or is: DLCs, hazmat class, heavy, fragile, high value. */
export function badges(ds, cargoId, dlcs, t) {
  const cargo = ds._index.cargo.get(cargoId);
  const out = el('span', { class: 'job-badges' });
  for (const d of dlcs) out.append(el('span', { class: 'badge badge-blue', text: t.dlcNames?.[d] ?? d }));
  if (cargo.hz) out.append(el('span', { class: 'badge badge-amber', text: fill(t.board?.hazmat, { c: cargo.hz }) }));
  for (const f of ['heavy', 'fragile', 'high-value']) {
    if (cargo.flags.includes(f)) out.append(el('span', { class: 'badge', text: t.board?.[f === 'high-value' ? 'highValue' : f] ?? f }));
  }
  return out;
}

export function depotLabel(ds, depot) {
  const co = ds.companyById.get(depot.company);
  return depot.type ? `${co.name} · ${depot.type}` : co.name;
}

export function distanceText(km, units, hours, t) {
  const d = distance(km, units);
  return `${d.value.toLocaleString('en-US')} ${d.unit} · ${fill(t.board?.hours, { h: hours })}`;
}

export function weightText(lb, units) {
  const w = weight(lb, units);
  return `${w.value.toLocaleString('en-US')} ${w.unit}`;
}

export function trailerName(ds, id) {
  return ds.trailerById.get(id)?.name ?? id;
}
