// "Generate a job" button. Each job comes from a random seed; the seed (and the start city
// filter) go into the address (?job=…&gfrom=…&gbase=1) so the same job opens for anyone.
import { randomJob, seedToCode, codeToSeed, missionId } from '../engine/generator.mjs';
import { owned } from './dlcs.mjs';
import { loadJobs, el, badges, depotLabel, weightText, trailerName, cityPathOf } from './jobs.mjs';
import { distance } from '../lib/ats.mjs';
import { currentUnits, pageText, fill } from './units.mjs';

const box = document.querySelector('[data-gen]');

if (box) {
  const t = pageText();
  const form = box.querySelector('[data-gen-form]');
  const from = form.querySelector('select[name="from"]');
  const base = form.querySelector('input[name="base"]');
  const mine = form.querySelector('input[name="mine"]');
  const msg = box.querySelector('[data-gen-msg]');
  const result = box.querySelector('[data-gen-result]');
  const g = (k) => box.querySelector(`[data-g="${k}"]`);
  const fixedCity = box.dataset.genCity || null;
  const fixedCompany = box.dataset.genCompany || null;
  let current = null;
  let ds = null;

  const q = new URLSearchParams(location.search);
  if (from && q.get('gfrom')) from.value = q.get('gfrom');
  if (q.get('gbase') === '1') base.checked = true;

  const say = (text) => { msg.textContent = text ?? ''; msg.hidden = !text; };

  const show = (job) => {
    const units = currentUnits();
    const fromCity = ds.cityById.get(job.from);
    const toCity = ds.cityById.get(job.to);
    const cargo = ds._index.cargo.get(job.cargo);
    g('code').textContent = fill(t.generator?.code, { code: seedToCode(job.seed) });
    g('fromLink').textContent = fromCity.name;
    g('fromLink').href = cityPathOf(fromCity);
    g('toLink').textContent = toCity.name;
    g('toLink').href = cityPathOf(toCity);
    g('cargo').textContent = cargo.name;
    g('badges').replaceChildren(badges(ds, job.cargo, job.dlcs, t));
    g('pickup').textContent = `${depotLabel(ds, ds.depots[job.source])}, ${fromCity.name}`;
    g('deliver').textContent = `${depotLabel(ds, ds.depots[job.destination])}, ${toCity.name}`;
    g('trailer').textContent = trailerName(ds, job.trailer);
    g('weight').textContent = weightText(job.weightLb, units);
    const d = distance(job.km, units);
    g('distance').textContent = `${d.value.toLocaleString('en-US')} ${d.unit}`;
    g('drive').textContent = fill(t.board?.hours, { h: job.hours });
    g('needs').textContent = job.dlcs.length ? job.dlcs.map((x) => t.dlcNames?.[x] ?? x).join(', ') : t.generator?.nothingNeeded;
    g('planner').href = `/ats/planner?from=${job.from}&to=${job.to}`;
    g('sheet').href = `/ats/mission/${missionId(ds, job)}`;
    result.hidden = false;
    say('');
  };

  const syncUrl = (job) => {
    const p = new URLSearchParams(location.search);
    p.set('job', seedToCode(job.seed));
    if (!fixedCity && from?.value) p.set('gfrom', from.value); else p.delete('gfrom');
    if (base.checked) p.set('gbase', '1'); else p.delete('gbase');
    history.replaceState(null, '', `?${p}${location.hash}`);
  };

  const generate = (seed) => {
    const ownedSet = mine.checked ? owned() : null;
    if (mine.checked && !ownedSet) { result.hidden = true; say(t.dlcs?.notSet); return; }
    const job = randomJob(ds, { seed, from: fixedCity || from?.value || null, baseOnly: base.checked, ownedDlcs: ownedSet, company: fixedCompany });
    if (!job) { result.hidden = true; say(t.generator?.none); return; }
    current = job;
    show(job);
    syncUrl(job);
  };

  const freshSeed = () => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0];
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (ds) generate(freshSeed());
  });
  box.querySelector('[data-gen-again]').addEventListener('click', () => { if (ds) generate(freshSeed()); });
  box.querySelector('[data-gen-share]').addEventListener('click', () => {
    const status = box.querySelector('[data-gen-copied]');
    navigator.clipboard?.writeText(location.href).then(() => { status.textContent = t.generator?.copied ?? ''; }, () => { status.textContent = location.href; });
  });
  document.addEventListener('fw:units', () => { if (current) show(current); });

  say(t.generator?.loading);
  loadJobs().then((data) => {
    ds = data;
    say('');
    box.dataset.state = 'ready';
    const seed = codeToSeed(q.get('job'));
    if (seed !== null) generate(seed);
  }).catch(() => { say(t.generator?.error); box.dataset.state = 'error'; });
}
