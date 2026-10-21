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

// ---- Weather codes (WMO, as used by Open-Meteo) -------------------------------

/** WMO weather code → icon key and i18n label key. */
export function weatherKind(code) {
  const c = Number(code);
  if (c === 0) return 'clear';
  if (c === 1 || c === 2) return 'partly';
  if (c === 3) return 'cloudy';
  if (c === 45 || c === 48) return 'fog';
  if ((c >= 51 && c <= 57)) return 'drizzle';
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
  if (c >= 95 && c <= 99) return 'storm';
  return 'unknown';
}

/** Open-Meteo forecast URL for a city (metric; the page converts). */
export function openMeteoUrl({ lat, lon }) {
  const p = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    forecast_days: '3',
  });
  return `https://api.open-meteo.com/v1/forecast?${p}`;
}
