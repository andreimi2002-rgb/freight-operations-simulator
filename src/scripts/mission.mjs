// Job sheet: resolve the job id against the current data and fill the page. Weather at the
// start (now) and at the destination (at the estimated arrival if leaving now) comes from
// /api/weather/<city>; bad weather only raises a warning, no delay is invented.
import { resolveMission, recommendTrucks, missionId } from '../engine/generator.mjs';
import { loadJobs, el, badges, depotLabel, weightText, trailerName, cityPathOf } from './jobs.mjs';
import { distance, temperature, weatherKind, weatherPath, weatherAt, isSevere, localHour, isNight } from '../lib/ats.mjs';
import { currentUnits, pageText, fill } from './units.mjs';
import { owned } from './dlcs.mjs';

const root = document.querySelector('[data-mission]');

function jobIdFromUrl() {
  const q = new URLSearchParams(location.search).get('id');
  if (q) return q;
  const m = location.pathname.match(/\/ats\/mission\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

if (root) {
  const t = pageText();
  const m = (k) => root.querySelector(`[data-m="${k}"]`);
  const fail = (key) => {
    m('msg').textContent = t.mission?.[key] ?? key;
    root.dataset.state = 'error';
  };
  let ds = null;
  let job = null;
  const weatherCache = new Map();

  const icon = (kind, night) => {
    const tpl = document.getElementById(`wx-icon-${kind === 'clear' && night ? 'night' : kind}`) || document.getElementById('wx-icon-unknown');
    return tpl ? tpl.content.cloneNode(true) : document.createTextNode('');
  };

  const fetchWeather = (cityId) => {
    if (!weatherCache.has(cityId)) {
      weatherCache.set(cityId, fetch(weatherPath(cityId)).then((r) => r.json()).then((d) => { if (!d.ok) throw new Error('weather'); return d; }));
    }
    return weatherCache.get(cityId);
  };

  const fillWeather = (box, title, entry, units) => {
    box.querySelector('.wx-title').textContent = title;
    if (!entry) {
      box.querySelector('.wx-label').textContent = t.mission?.weatherFar;
      return;
    }
    const kind = weatherKind(entry.sky, entry.intensity);
    box.querySelector('.wx-icon').replaceChildren(icon(kind, entry.night));
    const temp = entry.tempC == null ? null : temperature(entry.tempC, units);
    box.querySelector('.wx-temp').textContent = temp ? `${temp.value}${temp.unit}` : '–';
    box.querySelector('.wx-label').textContent = t.weather?.[kind] ?? kind;
  };

  const render = async () => {
    const units = currentUnits();
    const locale = root.dataset.locale || 'en-US';
    const ix = ds._index;
    const cargo = ix.cargo.get(job.cargo);
    const fromCity = ds.cityById.get(job.from);
    const toCity = ds.cityById.get(job.to);
    const src = ds.depots[job.source];
    const dst = ds.depots[job.destination];

    document.title = `${fromCity.name} → ${toCity.name}: ${cargo.name} · Freight World`;
    m('eyebrow').textContent = t.mission?.eyebrow;
    m('fromLink').textContent = fromCity.name;
    m('fromLink').href = cityPathOf(fromCity);
    m('toLink').textContent = toCity.name;
    m('toLink').href = cityPathOf(toCity);
    m('cargoName').textContent = cargo.name;
    m('badges').replaceChildren(badges(ds, job.cargo, job.dlcs, t));
    m('sameRoute').href = `/ats/planner?from=${job.from}&to=${job.to}`;

    const companyOf = (d) => ds.companyById.get(d.company);
    m('pickupCompany').textContent = companyOf(src).name;
    m('pickupCompany').href = `/ats/company/${src.company}`;
    m('pickupWhere').textContent = `${src.type ?? ''}${src.type ? ', ' : ''}${fromCity.name}, ${fromCity.state}`;
    m('pickupId').textContent = src.gameId ? fill(t.mission?.gameId, { id: src.gameId }) : t.mission?.noGameId;
    m('deliveryCompany').textContent = companyOf(dst).name;
    m('deliveryCompany').href = `/ats/company/${dst.company}`;
    m('deliveryWhere').textContent = `${dst.type ?? ''}${dst.type ? ', ' : ''}${toCity.name}, ${toCity.state}`;
    m('deliveryId').textContent = dst.gameId ? fill(t.mission?.gameId, { id: dst.gameId }) : t.mission?.noGameId;

    // Cargo
    if (job.weightLb != null) {
      m('weightLabel').textContent = t.mission?.weight;
      m('weight').textContent = weightText(job.weightLb, units);
    } else {
      m('weightLabel').textContent = t.mission?.weightRange;
      m('weight').textContent = cargo.w ? `${weightText(cargo.w[0], units)} – ${weightText(cargo.w[1], units)}` : t.mission?.weightUnknown;
    }
    const flags = [];
    if (cargo.hz) {
      flags.push(fill(t.mission?.hazmat, { c: cargo.hz }));
      if (cargo.un) flags.push(cargo.unExpected ? fill(t.mission?.unExpected, { un: cargo.un, expected: cargo.unExpected }) : fill(t.mission?.un, { un: cargo.un }));
    }
    for (const f of ['heavy', 'fragile', 'high-value']) if (cargo.flags.includes(f)) flags.push(t.board?.[f === 'high-value' ? 'highValue' : f] ?? f);
    m('flags').textContent = flags.length ? flags.join(' · ') : t.mission?.none;
    const mine = owned();
    m('dlcs').replaceChildren(...(job.dlcs.length
      ? job.dlcs.map((d) => el('span', { class: 'badge badge-blue' }, t.dlcNames?.[d] ?? d, mine ? ` · ${mine.has(d) ? t.mission?.owned : t.mission?.notOwned}` : ''))
      : [document.createTextNode(t.mission?.noDlc ?? '')]));

    // Route
    const dist = distance(job.km, units);
    m('distance').textContent = `${dist.value.toLocaleString('en-US')} ${dist.unit}`;
    m('drive').textContent = fill(t.board?.hours, { h: job.hours });
    const arrive = Date.now() + job.hours * 3600000;
    const arriveText = new Intl.DateTimeFormat(locale, { timeZone: toCity.tz, weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(arrive));
    m('arrival').textContent = fill(t.mission?.arriveAt, { time: arriveText, city: toCity.name });
    m('night').hidden = !isNight(localHour(toCity.tz, arrive));

    // Trailer
    const trailerIds = job.trailer ? [job.trailer] : cargo.trailers;
    m('trailerName').textContent = job.trailer ? trailerName(ds, job.trailer) : t.mission?.anyTrailer;
    const models = m('trailerModels');
    models.replaceChildren();
    for (const id of trailerIds) {
      const tr = ds.trailerById.get(id);
      if (!job.trailer) models.append(el('li', { text: tr?.name ?? id }));
      if (!tr) continue;
      if (job.trailer) {
        if (!tr.models.length) models.append(el('li', { text: t.mission?.noTrailerData }));
        for (const md of tr.models) {
          const price = md.priceUsd != null ? `$${md.priceUsd.toLocaleString('en-US')}` : (md.pricesUsd?.length ? md.pricesUsd.map((p) => `$${p.toLocaleString('en-US')}`).join(' / ') : null);
          models.append(el('li', {}, md.name, price ? ` · ${price}` : '', md.ownable === false ? el('span', { class: 'badge', text: t.mission?.notBuyable }) : null));
        }
        if (tr.ownable === false) models.append(el('li', { text: t.mission?.companyTrailer }));
      }
    }

    // Truck
    const rec = recommendTrucks(ds, job);
    m('truckNeed').textContent = fill(t.mission?.truckNeed, { hp: rec.needHp });
    m('trucks').replaceChildren(...rec.trucks.map((tk) => el('li', {}, `${tk.name} · ${fill(t.mission?.hp, { hp: tk.hp })}`, tk.dealerHere ? el('span', { class: 'badge badge-green', text: fill(t.mission?.dealerHere, { city: fromCity.name }) }) : null)));
    const dealerLine = (c) => (c.dealers?.length ? fill(t.mission?.dealersIn, { city: c.name, list: c.dealers.join(', ') }) : fill(t.mission?.noDealers, { city: c.name }));
    m('dealers').textContent = `${dealerLine(fromCity)}. ${dealerLine(toCity)}.`;

    // Weather and warnings
    const warnings = m('warnings');
    warnings.replaceChildren();
    warnings.hidden = true;
    const wxFrom = m('wxFrom');
    const wxTo = m('wxTo');
    wxFrom.querySelector('.wx-title').textContent = fill(t.mission?.weatherFrom, { city: fromCity.name });
    wxTo.querySelector('.wx-title').textContent = fill(t.mission?.weatherTo, { city: toCity.name });
    const addWarning = (entry, city) => {
      const kind = weatherKind(entry.sky, entry.intensity);
      warnings.append(el('p', { text: fill(t.mission?.severe, { what: (t.weather?.[kind] ?? kind).toLowerCase(), city: city.name }) }));
      warnings.hidden = false;
    };
    try {
      const [a, b] = await Promise.all([fetchWeather(job.from), fetchWeather(job.to)]);
      fillWeather(wxFrom, fill(t.mission?.weatherFrom, { city: fromCity.name }), a.now, units);
      const atArrival = weatherAt(b.series, arrive);
      fillWeather(wxTo, fill(t.mission?.weatherTo, { city: toCity.name }), atArrival, units);
      if (isSevere(a.now)) addWarning(a.now, fromCity);
      if (isSevere(atArrival)) addWarning(atArrival, toCity);
    } catch {
      for (const box of [wxFrom, wxTo]) box.querySelector('.wx-label').textContent = t.mission?.weatherError;
    }
  };

  m('copy').addEventListener('click', () => {
    navigator.clipboard?.writeText(location.href).then(() => { m('copied').textContent = t.mission?.copied ?? ''; }, () => { m('copied').textContent = location.href; });
  });

  const id = jobIdFromUrl();
  if (!id) fail('badId');
  else {
    loadJobs().then((data) => {
      ds = data;
      const r = resolveMission(ds, id);
      if (r.error) { fail(r.error); return; }
      job = r;
      // Normalise the address to the canonical path form.
      const canonical = `/ats/mission/${missionId(ds, job)}`;
      if (location.pathname !== canonical && !location.search.includes('id=')) history.replaceState(null, '', canonical);
      m('msg').hidden = true;
      m('job').hidden = false;
      root.dataset.state = 'ready';
      render();
      document.addEventListener('fw:units', render);
      document.addEventListener('fw:dlcs', render);
    }).catch(() => fail('gone'));
  }
}
