// Job sheet: resolve the job id against the current data and fill the page. Weather at the
// start (now) and at the destination (at the estimated arrival if leaving now) comes from
// /api/weather/<city>; bad weather only raises a warning, no delay is invented.
import { resolveMission, recommendTrucks, missionId, chainJobs } from '../engine/generator.mjs';
import { loadJobs, el, badges, depotLabel, weightText, trailerName, cityPathOf } from './jobs.mjs';
import { distance, temperature, weatherKind, weatherPath, weatherAt, isSevere, localHour, isNight } from '../lib/ats.mjs';
import { currentUnits, pageText, fill } from './units.mjs';
import { owned } from './dlcs.mjs';
import { paintSave, recordVisit } from './saved.mjs';
import { mountMap, loadMap } from './map.mjs';
import { drivingPlan, urgencyOf, timeAllowedH, realMinutes } from '../engine/schedule.mjs';
import { buildRoadGraph, routeBetween } from '../engine/roadgraph.mjs';

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
  let routeInfo = null; // { route, stops } once the map data is loaded
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

    document.title = `${cargo.name}: ${fromCity.name} → ${toCity.name} · Freight World`;
    m('fromLink').textContent = `${fromCity.name}, ${fromCity.state}`;
    m('fromLink').href = cityPathOf(fromCity);
    m('toLink').textContent = `${toCity.name}, ${toCity.state}`;
    m('toLink').href = cityPathOf(toCity);
    m('fromCompany').textContent = src.type ? `${ds.companyById.get(src.company).name} · ${src.type}` : ds.companyById.get(src.company).name;
    m('fromCompany').href = `/ats/company/${src.company}`;
    m('toCompany').textContent = dst.type ? `${ds.companyById.get(dst.company).name} · ${dst.type}` : ds.companyById.get(dst.company).name;
    m('toCompany').href = `/ats/company/${dst.company}`;
    m('cargoName').replaceChildren(el('a', { href: `/ats/cargo/${cargo.id}`, class: 'cargo-link', text: cargo.name }));
    const skills = m('skills');
    skills.replaceChildren();
    const skill = (id, title, extra) => {
      const tpl = document.getElementById(`skill-${id}`);
      const box = el('span', { class: `skill skill-${id}`, title, role: 'img', 'aria-label': title });
      if (tpl) box.append(tpl.content.cloneNode(true));
      if (extra) box.append(el('b', { text: extra }));
      skills.append(box);
    };
    if (cargo.hz) skill('adr', fill(t.mission?.hazmat, { c: cargo.hz }), String(cargo.hz).split('.')[0]);
    if (cargo.flags.includes('heavy')) skill('heavy', t.board?.heavy);
    if (cargo.flags.includes('fragile')) skill('fragile', t.board?.fragile);
    if (cargo.flags.includes('high-value')) skill('high-value', t.board?.highValue);

    // Urgency, plan and deadline
    const id = missionId(ds, job);
    const urgency = urgencyOf(id);
    const plan = drivingPlan(job.hours);
    const allowedH = timeAllowedH(plan.totalH, urgency);
    const u = m('urgency');
    u.textContent = t.mission?.urgency?.[urgency] ?? urgency;
    u.className = `urgency u-${urgency}`;
    const dur = (h) => { const mins = Math.round(h * 60); return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`; };
    m('offerTime').textContent = dur(allowedH);
    const offerDist = distance(job.km, units);
    m('offerDistance').textContent = `${offerDist.value.toLocaleString('en-US')} ${offerDist.unit}`;
    m('offerTrailer').textContent = job.trailer ? trailerName(ds, job.trailer) : cargo.trailers.map((x) => trailerName(ds, x)).join(', ');
    if (job.weightLb != null) {
      m('offerWeightLabel').textContent = t.mission?.weight;
      m('offerWeight').textContent = weightText(job.weightLb, units);
    } else {
      m('offerWeightLabel').textContent = t.mission?.weightRange;
      m('offerWeight').textContent = cargo.w ? `${weightText(cargo.w[0], units)} – ${weightText(cargo.w[1], units)}` : t.mission?.weightUnknown;
    }
    const startMs = Date.now();
    const clockIn = (tz, ms, withDay = true) => new Intl.DateTimeFormat(locale, { timeZone: tz, ...(withDay ? { weekday: 'short' } : {}), hour: 'numeric', minute: '2-digit' }).format(new Date(ms));
    m('deadline').textContent = fill(t.mission?.deliverBy, { time: clockIn(toCity.tz, startMs + allowedH * 3600000), city: toCity.name });
    m('realTime').textContent = fill(t.mission?.realTimeLine, { game: dur(plan.totalH), real: realMinutes(plan.totalH) });

    // Driving plan timeline
    const planList = m('plan');
    planList.replaceChildren();
    const stopLabel = (seg) => {
      const st = routeInfo?.stops?.find((x) => x.endH === seg.endH && x.kind === seg.type);
      return st?.near ? fill(t.mission?.near, { city: st.near }) : (routeInfo ? t.mission?.onRoad : '');
    };
    planList.append(el('li', { class: 'p-start' }, el('span', { class: 'p-time', text: clockIn(fromCity.tz, startMs, false) }), el('span', { class: 'p-dot', text: 'A' }), el('span', { class: 'p-text' }, fill(t.mission?.planStart, { company: ds.companyById.get(src.company).name, city: fromCity.name }))));
    let n = 0;
    for (const seg of plan.segments) {
      const at = clockIn(fromCity.tz, startMs + seg.startH * 3600000, false);
      if (seg.type === 'drive') {
        const km = job.km * (seg.h / job.hours);
        const d = distance(km, units);
        planList.append(el('li', { class: 'p-drive' }, el('span', { class: 'p-time', text: at }), el('span', { class: 'p-dot', text: '' }), el('span', { class: 'p-text' }, fill(t.mission?.planDrive, { time: dur(seg.h), dist: `${d.value.toLocaleString('en-US')} ${d.unit}` }))));
      } else {
        n += 1;
        const label = seg.type === 'rest' ? t.mission?.planRest : t.mission?.planBreak;
        planList.append(el('li', { class: `p-${seg.type}` }, el('span', { class: 'p-time', text: at }), el('span', { class: 'p-dot', text: String(n) }), el('span', { class: 'p-text' }, fill(label, { time: dur(seg.h) }), el('small', { text: stopLabel(seg) }))));
      }
    }
    planList.append(el('li', { class: 'p-end' }, el('span', { class: 'p-time', text: clockIn(toCity.tz, startMs + plan.totalH * 3600000, false) }), el('span', { class: 'p-dot', text: 'B' }), el('span', { class: 'p-text' }, fill(t.mission?.planEnd, { company: ds.companyById.get(dst.company).name, city: toCity.name }), el('small', { text: fill(t.mission?.planTotal, { time: dur(plan.totalH), allowed: dur(allowedH) }) }))));
    m('badges').replaceChildren(badges(ds, job.cargo, job.dlcs, t));
    m('sameRoute').href = `/ats/planner?from=${job.from}&to=${job.to}`;

    const companyOf = (d) => ds.companyById.get(d.company);
    m('pickupId').textContent = src.gameId ? fill(t.mission?.gameId, { id: src.gameId }) : t.mission?.noGameId;
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
    const arrive = startMs + plan.totalH * 3600000;
    m('night').hidden = !isNight(localHour(toCity.tz, arrive));

    // Job chain: what to take next from the destination
    const chain = chainJobs(ds, job, { ownedDlcs: owned() });
    m('chainTitle').textContent = fill(t.mission?.chainTitle, { city: toCity.name });
    m('chainIntro').textContent = fill(t.mission?.chainIntro, { city: toCity.name });
    m('chain').replaceChildren(...chain.map((c) => {
      const cc = ds._index.cargo.get(c.cargo);
      const to = ds.cityById.get(c.to);
      const d = distance(c.km, units);
      const tags = el('span', { class: 'c-tags' });
      if (c.sameTrailer) tags.append(el('span', { class: 'badge badge-green', text: t.mission?.sameTrailer }));
      if (c.backHome) tags.append(el('span', { class: 'badge', text: fill(t.mission?.towards, { city: fromCity.name }) }));
      for (const dl of c.dlcs) tags.append(el('span', { class: 'badge badge-blue', text: t.dlcNames?.[dl] ?? dl }));
      return el('li', {}, el('a', { href: `/ats/mission/${missionId(ds, c)}` },
        el('span', { class: 'c-cargo', text: cc.name }),
        el('span', { text: `→ ${to.name}, ${to.state}` }),
        el('span', { class: 'c-meta', text: `${d.value.toLocaleString('en-US')} ${d.unit} · ${trailerName(ds, c.trailer)} · ${weightText(c.weightLb, units)}` }),
        tags));
    }));
    m('chainAll').textContent = fill(t.mission?.chainAll, { city: toCity.name });
    m('chainAll').href = `/ats/planner?from=${job.to}`;

    // Trailer
    const trailerIds = job.trailer ? [job.trailer] : cargo.trailers;
    m('trailerName').replaceChildren(job.trailer ? el('a', { href: `/ats/trailer/${job.trailer}`, text: trailerName(ds, job.trailer) }) : document.createTextNode(t.mission?.anyTrailer ?? ''));
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
    m('trucks').replaceChildren(...rec.trucks.map((tk) => el('li', {}, el('a', { href: `/ats/truck/${tk.id}`, text: tk.name }), ` · ${fill(t.mission?.hp, { hp: tk.hp })}`, tk.dealerHere ? el('span', { class: 'badge badge-green', text: fill(t.mission?.dealerHere, { city: fromCity.name }) }) : null)));
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
      // Favorites and history: the job is "cargo: from -> to", saved under its canonical path.
      const save = root.querySelector('[data-save]');
      if (save) {
        const cargoName = ds._index.cargo.get(job.cargo)?.name ?? job.cargo;
        const fromCity = ds.cityById.get(job.from);
        const toCity = ds.cityById.get(job.to);
        save.dataset.url = canonical;
        save.dataset.name = `${cargoName}: ${fromCity.name} → ${toCity.name}`;
        save.dataset.detail = `${fromCity.state} → ${toCity.state}`;
        paintSave(save);
        recordVisit(save);
      }
      const mapBox = root.querySelector('[data-map="route"]');
      if (mapBox) {
        mapBox.dataset.mapFrom = job.from;
        mapBox.dataset.mapTo = job.to;
        loadMap().then((mapData) => {
          const xy = new Map(mapData.cities.map((c) => [c.id, c]));
          const a = xy.get(job.from);
          const b = xy.get(job.to);
          const route = a && b ? routeBetween(buildRoadGraph(mapData.roads), a.xy, b.xy) : null;
          const plan = drivingPlan(job.hours);
          const stops = [];
          if (route) {
            const cum = [0];
            for (let i = 1; i < route.points.length; i++) cum.push(cum[i - 1] + Math.hypot(route.points[i][0] - route.points[i - 1][0], route.points[i][1] - route.points[i - 1][1]));
            const total = cum[cum.length - 1];
            const at = (frac) => {
              const d = frac * total;
              let i = cum.findIndex((c) => c >= d);
              if (i <= 0) return route.points[0];
              const r = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
              return [route.points[i - 1][0] + r * (route.points[i][0] - route.points[i - 1][0]), route.points[i - 1][1] + r * (route.points[i][1] - route.points[i - 1][1])];
            };
            let n = 0;
            for (const seg of plan.segments) {
              if (seg.type === 'drive') continue;
              n += 1;
              const p = at(seg.driveDoneH / job.hours);
              let near = null;
              let best = 70;
              for (const c of mapData.cities) {
                const dkm = Math.hypot(c.xy[0] - p[0], c.xy[1] - p[1]);
                if (dkm < best) { best = dkm; near = c.name; }
              }
              stops.push({ xy: p, kind: seg.type, short: String(n), endH: seg.endH, near, label: near ?? '' });
            }
          }
          routeInfo = { route, stops };
          render();
          mountMap(mapBox, { route, stops });
        }).catch(() => mountMap(mapBox));
      }
      document.addEventListener('fw:units', render);
      document.addEventListener('fw:dlcs', render);
    }).catch(() => fail('gone'));
  }
}
