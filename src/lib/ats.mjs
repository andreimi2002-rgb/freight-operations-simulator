// Read-only helpers over data/ats/*.json for the pages. Pure functions; the
// pages pass the JSON in, so tests can use the same functions with plain Node.

/** URL path of a city page: /ats/ca/sacramento */
export function cityPath(city) {
  return `/ats/${city.state.toLowerCase()}/${city.id}`;
}

/** Static paths for every city: [{ params: { state, city }, props: { cityId } }] */
export function cityParams(cities) {
  return cities.map((c) => ({ params: { state: c.state.toLowerCase(), city: c.id }, props: { cityId: c.id } }));
}

/** States in scope order, each with its cities sorted by name. */
export function statesWithCities(scope, cities) {
  return scope.states.map((s) => ({
    ...s,
    cities: cities.filter((c) => c.state === s.code).sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

/**
 * Depots of a city grouped by company, with cargo names resolved:
 * [{ company, depots: [{ type, gameId, location, accepts: [cargo], provides: [cargo], dlcCargo: [...] , generic }] }]
 */
export function cityCompanies(city, companies, cargo) {
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const cargoById = new Map(cargo.map((c) => [c.id, c]));
  const names = (ids) => ids.map((id) => cargoById.get(id)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  const groups = new Map();
  for (const d of city.depots) {
    const co = companyById.get(d.company);
    if (!co) continue;
    const type = co.depotTypes.find((t) => t.gameId === d.depotGameId && t.type === d.type) ?? co.depotTypes.find((t) => t.cities.includes(city.id));
    if (!groups.has(co.id)) groups.set(co.id, { company: co, depots: [] });
    groups.get(co.id).depots.push({
      type: d.type,
      gameId: d.depotGameId,
      location: d.location ?? null,
      accepts: names(type?.accepts ?? []),
      provides: names(type?.provides ?? []),
      dlcCargo: Object.entries(type?.dlcCargo ?? {}).map(([id, v]) => ({ id, name: v.name, accepts: names(v.accepts), provides: names(v.provides) })),
      generic: Object.keys(type?.genericNames ?? {}),
    });
  }
  return [...groups.values()].sort((a, b) => a.company.name.localeCompare(b.company.name));
}

/** Total distinct cargo a city provides (base game), for the summary card. */
export function cityCargoCounts(groups) {
  const provides = new Set();
  const accepts = new Set();
  for (const g of groups) for (const d of g.depots) {
    d.provides.forEach((c) => provides.add(c.id));
    d.accepts.forEach((c) => accepts.add(c.id));
  }
  return { provides: provides.size, accepts: accepts.size };
}

// ---- Units ------------------------------------------------------------------

export const UNIT_SYSTEMS = ['us', 'metric'];

export function cToF(c) { return c * 9 / 5 + 32; }
export function kmhToMph(k) { return k / 1.609344; }
export function lbToKg(lb) { return lb * 0.45359237; }

/** Temperature from Celsius in the chosen system, rounded: { value, unit } */
export function temperature(celsius, system) {
  return system === 'metric'
    ? { value: Math.round(celsius), unit: '°C' }
    : { value: Math.round(cToF(celsius)), unit: '°F' };
}

/** Precipitation from mm in the chosen system: inches with two decimals in US units. */
export function precipitation(mm, system) {
  return system === "metric"
    ? { value: Math.round(mm * 10) / 10, unit: "mm" }
    : { value: Math.round((mm / 25.4) * 100) / 100, unit: "in" };
}

/** Wind speed from km/h in the chosen system, rounded. */
export function windSpeed(kmh, system) {
  return system === 'metric'
    ? { value: Math.round(kmh), unit: 'km/h' }
    : { value: Math.round(kmhToMph(kmh)), unit: 'mph' };
}

// ---- Weather (MET Norway via /api/weather/<city>) ------------------------------

/** Sky category from the weather function (MET symbol, simplified) → icon and label key. */
export function weatherKind(sky, intensity = null) {
  switch (sky) {
    case "clear": return "clear";
    case "partly": return "partly";
    case "cloudy": return "cloudy";
    case "fog": return "fog";
    case "rain": return intensity === "light" ? "drizzle" : "rain";
    case "sleet": return "sleet";
    case "snow": return "snow";
    case "thunder": return "storm";
    default: return "unknown";
  }
}

/** Path of our weather function for a city. */
export function weatherPath(cityId) {
  return `/api/weather/${encodeURIComponent(cityId)}`;
}

// ---- Jobs: distance, weight and time formatting ------------------------------------

export function kmToMi(km) { return km / 1.609344; }

/** Distance from km in the chosen system, rounded to whole units. */
export function distance(km, system) {
  return system === 'metric'
    ? { value: Math.round(km), unit: 'km' }
    : { value: Math.round(kmToMi(km)), unit: 'mi' };
}

/** Weight from lb in the chosen system: lb as given, or kg rounded to 10. */
export function weight(lb, system) {
  return system === 'metric'
    ? { value: Math.round(lbToKg(lb) / 10) * 10, unit: 'kg' }
    : { value: lb, unit: 'lb' };
}

/** Local date (YYYY-MM-DD) and hour (0-23) now in a time zone. */
export function localDateHour(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t).value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) % 24 };
}

/** "2:38 PM" for minutes after local midnight; nextDay true when it passes midnight. */
export function clockTime(minutes, locale = 'en-US') {
  const m = ((minutes % 1440) + 1440) % 1440;
  const text = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' }).format(new Date(Date.UTC(2000, 0, 1, 0, m)));
  return { text, nextDay: minutes >= 1440 };
}

// ---- Job sheet helpers -----------------------------------------------------------

/** The forecast entry covering a moment (hourly first, then 6-hourly), or null. */
export function weatherAt(series, at) {
  const t = new Date(at).getTime();
  for (const e of series ?? []) {
    const start = Date.parse(e.t);
    const end = start + (e.stepH ?? 1) * 3600000;
    if (t >= start && t < end) return e;
  }
  return null;
}

/** Weather that deserves a warning on a job sheet (no delay is invented, only a warning). */
export function isSevere(entry) {
  if (!entry) return false;
  if (['snow', 'sleet', 'thunder', 'fog'].includes(entry.sky)) return true;
  return entry.sky === 'rain' && entry.intensity === 'heavy';
}

/** Local hour (0-23) of a moment in a time zone. */
export function localHour(timeZone, at) {
  return localDateHour(timeZone, new Date(at)).hour;
}

/** Arrival at night: between 22:00 and 06:00 local time. */
export function isNight(hour) {
  return hour >= 22 || hour < 6;
}
