// Departures boards: every element with data-board-city (a city) or data-board-featured
// (the city of the hour, home page) gets the jobs leaving in the next six hours.
// Recomputed when the local hour changes and when the units change.
import { departures, featuredCity } from '../engine/generator.mjs';
import { clockTime, localDateHour } from '../lib/ats.mjs';
import { loadJobs, el, badges, depotLabel, distanceText, weightText, trailerName, cityPathOf } from './jobs.mjs';
import { currentUnits, pageText, fill } from './units.mjs';

const boards = [...document.querySelectorAll('[data-board-city], [data-board-featured]')];

function utcDateHour(now = new Date()) {
  const iso = now.toISOString();
  return { date: iso.slice(0, 10), hour: now.getUTCHours() };
}

function render(box, ds, t) {
  const units = currentUnits();
  const cityId = box.dataset.boardCity || featuredCity(ds, utcDateHour());
  const city = ds.cityById.get(cityId);
  if (!city) { box.dataset.state = 'error'; return; }
  const { date, hour } = localDateHour(city.tz);
  const jobs = departures(ds, { city: cityId, date, hour });
  const locale = box.dataset.locale || 'en-US';

  const subtitle = box.querySelector('[data-board-subtitle]');
  if (subtitle) {
    const key = box.dataset.boardFeatured !== undefined ? 'subtitleHome' : 'subtitle';
    subtitle.replaceChildren();
    const link = el('a', { href: cityPathOf(city), text: city.name });
    const parts = fill(t.board?.[key], { city: '\u0000' }).split('\u0000');
    subtitle.append(parts[0] ?? '', link, parts[1] ?? '');
  }
  const caption = box.querySelector('caption');
  if (caption) caption.textContent = fill(t.board?.caption, { city: city.name });

  const tbody = box.querySelector('tbody');
  tbody.replaceChildren();
  if (!jobs.length) {
    tbody.append(el('tr', {}, el('td', { class: 'empty', colspan: '7', text: t.board?.empty })));
  }
  for (const j of jobs) {
    const src = ds.depots[j.source];
    const dst = ds.depots[j.destination];
    const toCity = ds.cityById.get(j.to);
    const time = clockTime(j.departMinute, locale);
    const cargo = ds._index.cargo.get(j.cargo);
    tbody.append(el('tr', {},
      el('td', { class: 'b-time' }, time.text, time.nextDay ? el('small', { text: ` ${t.board?.nextDay ?? '+1'}` }) : null),
      el('td', { class: 'b-cargo' }, el('span', { class: 'b-cargo-name', text: cargo.name }), badges(ds, j.cargo, j.dlcs, t)),
      el('td', { class: 'b-from', text: depotLabel(ds, src) }),
      el('td', { class: 'b-to' }, el('a', { href: cityPathOf(toCity), text: toCity.name }), el('small', { text: depotLabel(ds, dst) })),
      el('td', { class: 'b-dist', text: distanceText(j.km, units, j.hours, t) }),
      el('td', { class: 'b-trailer', text: trailerName(ds, j.trailer) }),
      el('td', { class: 'b-weight', text: weightText(j.weightLb, units) }),
    ));
  }
  box.dataset.state = 'ready';
  box.dataset.renderedHour = `${cityId}|${date}|${hour}`;
}

if (boards.length) {
  const t = pageText();
  loadJobs().then((ds) => {
    const all = () => boards.forEach((b) => render(b, ds, t));
    all();
    document.addEventListener('fw:units', all);
    // Check every 30 s whether the local hour (or the featured city) changed.
    setInterval(() => {
      for (const b of boards) {
        const cityId = b.dataset.boardCity || featuredCity(ds, utcDateHour());
        const city = ds.cityById.get(cityId);
        const { date, hour } = localDateHour(city.tz);
        if (b.dataset.renderedHour !== `${cityId}|${date}|${hour}`) render(b, ds, t);
      }
    }, 30 * 1000);
  }).catch(() => boards.forEach((b) => { b.dataset.state = 'error'; }));
}
