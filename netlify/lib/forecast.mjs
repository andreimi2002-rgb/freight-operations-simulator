// City weather from MET Norway Locationforecast 2.0 (compact): no key, CC BY 4.0.
// Terms: identify with a User-Agent that includes contact information, at most 4 decimals in
// coordinates, respect caching (Expires). https://api.met.no/doc/TermsOfService
// The answer is reduced to what the city page shows: now and the next 3 local days (today first).
// Ported from FOS (git tag fos-final, netlify/lib/weather/forecast.mjs).

export const USER_AGENT = "FreightWorld/2.0 (+https://github.com/andreimi2002-rgb/freight-operations-simulator)";
export const MET_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
export const SOURCE = {
  name: "MET Norway — Locationforecast 2.0",
  url: "https://api.met.no/weatherapi/locationforecast/2.0/documentation",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
};
const TIMEOUT_MS = 8000;
const SERIES_DAYS = 7;

// MET symbol codes ("lightrainshowers_day", "heavysnowandthunder", "partlycloudy_night") ->
// language-neutral sky category, intensity and night flag.
export function categorize(code) {
  if (!code) return { sky: null, intensity: null, night: false };
  const [base, time] = String(code).split("_");
  const night = time === "night" || time === "polartwilight";
  const simple = { clearsky: "clear", fair: "partly", partlycloudy: "partly", cloudy: "cloudy", fog: "fog" }[base];
  if (simple) return { sky: simple, intensity: null, night };
  const m = /^(light|heavy)?(rain|sleet|snow)(showers)?(andthunder)?$/.exec(base);
  if (!m) return { sky: null, intensity: null, night };
  if (m[4]) return { sky: "thunder", intensity: m[1] || null, night };
  return { sky: m[2], intensity: m[1] || null, night };
}
const SEVERITY = { clear: 0, partly: 1, cloudy: 2, fog: 3, rain: 4, sleet: 5, snow: 6, thunder: 7 };
const INTENSITY = { light: 0, null: 1, heavy: 2 };

const round1 = value => (Number.isFinite(value) ? Math.round(value * 10) / 10 : null);
const kmh = ms => (Number.isFinite(ms) ? Math.round(ms * 3.6) : null);

function localParts(iso, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const get = type => parts.find(p => p.type === type).value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24 };
}

// The MET answer -> { updatedAt, now, days[3], series[] }. `now` (ms) decides what is "now".
export function normalizeForecast(json, { timeZone, now = Date.now(), days = 3 } = {}) {
  const raw = json?.properties?.timeseries;
  if (!Array.isArray(raw) || !raw.length) throw new Error("unexpected forecast format");
  const series = raw.map(entry => {
    const d = entry.data?.instant?.details || {};
    const one = entry.data?.next_1_hours;
    const six = entry.data?.next_6_hours;
    const next = one || six || entry.data?.next_12_hours;
    return {
      t: entry.time,
      stepH: one ? 1 : six ? 6 : null,
      tempC: round1(d.air_temperature),
      windKmh: kmh(d.wind_speed),
      windDeg: Number.isFinite(d.wind_from_direction) ? Math.round(d.wind_from_direction) : null,
      precipMm: round1(one?.details?.precipitation_amount ?? six?.details?.precipitation_amount ?? null),
      ...categorize(next?.summary?.symbol_code),
    };
  }).filter(e => Date.parse(e.t) >= now - 60 * 60000 && Date.parse(e.t) <= now + SERIES_DAYS * 86400000 && e.stepH);

  if (!series.length) throw new Error("forecast has no future entries");
  const current = series.reduce((best, e) => (Math.abs(Date.parse(e.t) - now) < Math.abs(Date.parse(best.t) - now) ? e : best));

  // Daily summaries for `days` local calendar days, starting today (today covers the hours left).
  const today = localParts(new Date(now).toISOString(), timeZone).date;
  const byDay = new Map();
  for (const e of series) {
    const { date, hour } = localParts(e.t, timeZone);
    if (date < today) continue;
    if (!byDay.has(date)) byDay.set(date, []);
    byDay.get(date).push({ ...e, hour });
  }
  const daily = [...byDay.entries()].slice(0, days).map(([date, entries]) => {
    const temps = entries.map(e => e.tempC).filter(Number.isFinite);
    const daytime = entries.filter(e => e.hour >= 6 && e.hour <= 21 && e.sky);
    const pool = daytime.length ? daytime : entries.filter(e => e.sky);
    // The day's sky: the most serious precipitation if any falls in daytime, otherwise the most
    // frequent daytime sky (a foggy morning does not make a foggy day).
    const wet = pool.filter(e => SEVERITY[e.sky] >= SEVERITY.rain);
    const counts = pool.reduce((acc, e) => acc.set(e.sky, (acc.get(e.sky) || 0) + 1), new Map());
    const mostFrequent = [...counts].sort((a, b) => b[1] - a[1] || SEVERITY[b[0]] - SEVERITY[a[0]])[0]?.[0];
    const worst = wet.length
      ? wet.reduce((a, b) => (SEVERITY[b.sky] > SEVERITY[a.sky] || (SEVERITY[b.sky] === SEVERITY[a.sky] && INTENSITY[b.intensity] > INTENSITY[a.intensity]) ? b : a), wet[0])
      : pool.find(e => e.sky === mostFrequent);
    const precip = entries.reduce((sum, e) => sum + (e.precipMm || 0), 0);
    return {
      date,
      minC: temps.length ? Math.min(...temps) : null,
      maxC: temps.length ? Math.max(...temps) : null,
      precipMm: round1(precip),
      sky: worst?.sky ?? null,
      intensity: worst?.intensity ?? null,
      complete: entries.length >= 4,
    };
  });

  return {
    updatedAt: json.properties.meta?.updated_at || null,
    now: { t: current.t, tempC: current.tempC, windKmh: current.windKmh, windDeg: current.windDeg, precipMm: current.precipMm, stepH: current.stepH, sky: current.sky, intensity: current.intensity, night: current.night },
    days: daily,
  };
}

// Warm function instances reuse answers until MET's Expires (10-60 min); errors are not cached.
const memory = new Map();
export const clearWeatherCache = () => memory.clear();
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export async function fetchForecast(lat, lon, { fetchImpl = fetch, now = Date.now() } = {}) {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const hit = memory.get(key);
  if (hit && hit.expires > now) return hit.json;
  const response = await fetchImpl(`${MET_URL}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`MET Norway answered HTTP ${response.status}`);
  const json = await response.json();
  const expires = Date.parse(response.headers?.get?.("expires") || "");
  const ttl = clamp(Number.isFinite(expires) ? expires - now : 30 * 60000, 10 * 60000, 60 * 60000);
  memory.set(key, { json, expires: now + ttl });
  if (memory.size > 400) memory.delete(memory.keys().next().value);
  return json;
}

export async function getCityWeather({ lat, lon, timeZone }, { fetchImpl = fetch, now = Date.now() } = {}) {
  const json = await fetchForecast(lat, lon, { fetchImpl, now });
  return normalizeForecast(json, { timeZone, now });
}
