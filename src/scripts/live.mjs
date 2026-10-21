// Live parts of the pages, run in the browser: local clock, real weather
// (MET Norway through /api/weather/<city>, cached 15 minutes) and the US / metric unit switch.
// Text comes from the page (data attributes and a JSON block), never from here.
import { temperature, windSpeed, precipitation, weatherKind, weatherPath } from '../lib/ats.mjs';
import { currentUnits, saveUnits, pageText as texts, fill } from './units.mjs';

const CACHE_MS = 15 * 60 * 1000;

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch { /* storage may be blocked; the page works without it */ }
  return null;
}

// ---- Units -----------------------------------------------------------------
function initUnits(onChange) {
  const buttons = [...document.querySelectorAll('[data-units]')];
  const apply = (sys) => {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.units === sys)));
    document.documentElement.dataset.unitSystem = sys;
  };
  apply(currentUnits());
  buttons.forEach((b) => b.addEventListener('click', () => {
    apply(b.dataset.units);
    saveUnits(b.dataset.units);
    onChange(b.dataset.units);
  }));
}

// ---- Clock -----------------------------------------------------------------
function initClocks() {
  const clocks = [...document.querySelectorAll('[data-clock-tz]')];
  if (!clocks.length) return;
  const tick = () => {
    const now = new Date();
    for (const el of clocks) {
      const tz = el.dataset.clockTz;
      const locale = el.dataset.locale || 'en-US';
      const time = el.querySelector('[data-clock-time]');
      const date = el.querySelector('[data-clock-date]');
      try {
        if (time) time.textContent = new Intl.DateTimeFormat(locale, { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(now);
        if (date) date.textContent = new Intl.DateTimeFormat(locale, { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }).format(now);
      } catch { /* invalid zone: leave the server text */ }
    }
  };
  tick();
  setInterval(tick, 15 * 1000);
}

// ---- Weather ---------------------------------------------------------------
async function fetchWeather(cityId) {
  const key = `fw-wx2-${cityId}`;
  try {
    const cached = JSON.parse(store(key) || "null");
    if (cached && Date.now() - cached.at < CACHE_MS) return cached;
  } catch { /* ignore broken cache */ }
  const res = await fetch(weatherPath(cityId));
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(`weather ${res.status}`);
  const entry = { at: Date.now(), data };
  store(key, JSON.stringify(entry));
  return entry;
}

function icon(kind, night) {
  const tpl = document.getElementById(`wx-icon-${kind === 'clear' && night ? 'night' : kind}`) || document.getElementById('wx-icon-unknown');
  return tpl ? tpl.content.cloneNode(true) : document.createTextNode('');
}

function renderWeather(box, entry, units, t) {
  const { now: cur, days, timeZone } = entry.data;
  const kind = weatherKind(cur.sky, cur.intensity);
  const night = Boolean(cur.night);
  const locale = box.dataset.locale || "en-US";
  const q = (sel) => box.querySelector(sel);
  const temp = cur.tempC == null ? null : temperature(cur.tempC, units);
  q("[data-wx-icon]").replaceChildren(icon(kind, night));
  q("[data-wx-temp]").textContent = temp ? `${temp.value}${temp.unit}` : "–";
  q("[data-wx-label]").textContent = (t.weather?.[kind] ?? kind) + (night && kind === "clear" ? ` (${t.weather?.night ?? "night"})` : "");
  const wind = cur.windKmh == null ? null : windSpeed(cur.windKmh, units);
  q("[data-wx-wind]").textContent = wind ? fill(t.city?.wind, { v: `${wind.value} ${wind.unit}` }) : "";
  const pr = precipitation(cur.precipMm ?? 0, units);
  q("[data-wx-precip]").textContent = fill(t.city?.precipitation, { v: `${pr.value} ${pr.unit}` });
  const updated = new Intl.DateTimeFormat(locale, { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(entry.data.fetchedAt || entry.at));
  q("[data-wx-updated]").textContent = fill(t.city?.weatherUpdated, { time: updated });
  const list = q("[data-wx-days]");
  list.replaceChildren();
  days.forEach((day, i) => {
    const li = document.createElement("li");
    const name = i === 0 ? (t.city?.today ?? "Today") : new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(`${day.date}T12:00:00Z`));
    const k = weatherKind(day.sky, day.intensity);
    const label = document.createElement("span");
    label.className = "wx-day-name";
    label.textContent = name;
    const ic = document.createElement("span");
    ic.className = "wx-day-icon";
    ic.setAttribute("role", "img");
    ic.setAttribute("aria-label", t.weather?.[k] ?? k);
    ic.append(icon(k, false));
    const range = document.createElement("span");
    range.className = "wx-day-range";
    const hi = day.maxC == null ? null : temperature(day.maxC, units);
    const lo = day.minC == null ? null : temperature(day.minC, units);
    range.textContent = hi && lo ? `${hi.value}° / ${lo.value}°` : "–";
    li.append(label, ic, range);
    list.append(li);
  });
  box.dataset.state = "ready";
}

function initWeather() {
  const boxes = [...document.querySelectorAll('[data-wx-city]')];
  if (!boxes.length) return () => {};
  const t = texts();
  const cache = new Map();
  const load = async (box) => {
    box.dataset.state = 'loading';
    try {
      const entry = await fetchWeather(box.dataset.wxCity);
      cache.set(box, entry);
      renderWeather(box, entry, currentUnits(), t);
    } catch {
      box.dataset.state = 'error';
    }
  };
  boxes.forEach((box) => {
    box.querySelector('[data-wx-retry]')?.addEventListener('click', () => load(box));
    load(box);
  });
  // Refresh while the page stays open and visible.
  setInterval(() => { if (document.visibilityState === 'visible') boxes.forEach(load); }, CACHE_MS);
  return (units) => boxes.forEach((box) => { const e = cache.get(box); if (e) renderWeather(box, e, units, t); });
}

const rerender = initWeather();
initUnits((units) => rerender(units));
initClocks();
