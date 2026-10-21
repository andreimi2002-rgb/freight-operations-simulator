// UN/LOCODE parsing and matching to GeoNames cities (pure; tested).
// The list's row format (UNECE): Change, Country, Location, Name, NameWoDiacritics, Subdivision,
// Status, Function, Date, IATA, Coordinates ("4430N 02606E"), Remarks.
import { distanceM } from "./crossings.mjs";

// Minimal CSV line parser (quoted fields, doubled quotes).
export function parseCsvLine(line) {
  const out = [];
  let field = "", quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { out.push(field); field = ""; }
    else field += c;
  }
  out.push(field);
  return out;
}

// "4430N 02606E" -> { lat, lon }; null when missing or malformed.
export function parseCoordinates(text) {
  const m = /^(\d{2})(\d{2})([NS]) (\d{3})(\d{2})([EW])$/.exec(String(text || "").trim());
  if (!m) return null;
  const lat = (Number(m[1]) + Number(m[2]) / 60) * (m[3] === "S" ? -1 : 1);
  const lon = (Number(m[4]) + Number(m[5]) / 60) * (m[6] === "W" ? -1 : 1);
  return { lat: Math.round(lat * 1e4) / 1e4, lon: Math.round(lon * 1e4) / 1e4 };
}

export function parseLocodeCsv(text, countryCodes) {
  const wanted = new Set(countryCodes);
  const entries = [];
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line) continue;
    const f = parseCsvLine(line);
    const [, country, location, name, ascii, , status, functions, , , coordinates] = f;
    if (!wanted.has(country) || !/^[A-Z2-9]{3}$/.test(location || "") || !/^A[A-Z]$|^R[A-Z]$|^Q[A-Z]$|^C[A-Z]$|^I[A-Z]$|^U[A-Z]$|^F[A-Z]$/.test(status || "")) continue;
    // functions: 1 port, 2 rail terminal, 3 road terminal, 4 airport, 5 postal exchange, 6 multimodal, 7 fixed transport, B border crossing
    entries.push({ country, location, locode: `${country}${location}`, name, ascii: ascii || name, status, functions: functions || "", coordinates: parseCoordinates(coordinates) });
  }
  return entries;
}

export const fold = text => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Names that appear in the GeoNames catalog under another spelling than in UN/LOCODE.
const sameName = (a, b) => { const x = fold(a), y = fold(b); return x === y || x.replace(/ municipality$| city$/, "") === y; };

// Entries usable as "the city": not a station, airport or terminal named after something else.
const isPlace = entry => !/\b(apt|airport|aeroport|gara|station|statie|port|terminal|rail|border|vama|baneasa apt)\b/i.test(entry.ascii) || false;

// Cities whose GeoNames name differs from the UN/LOCODE spelling (GeoNames ID -> name in the list).
export const NAME_ALIASES = { 683506: "Bucuresti" };

// Matches a catalog city ({ id, name, latitude, longitude, countryCode }) to one entry.
// Rules, in order (same country in all of them):
//   1. an entry with coordinates within 25 km whose name matches exactly (accents ignored);
//   2. an entry WITHOUT coordinates whose name matches exactly and is the only one of that name in the country;
//   3. the only place-like entry with coordinates within 3 km.
// Anything ambiguous returns null (the city keeps its provisional code).
export function matchCity(city, entries) {
  const names = [city.name, NAME_ALIASES[city.id]].filter(Boolean);
  const matchesName = e => names.some(n => sameName(e.ascii, n) || sameName(e.name, n));
  const here = entries.filter(e => e.country === city.countryCode);
  const near = here
    .filter(e => e.coordinates)
    .map(e => ({ e, d: distanceM({ lat: city.latitude, lon: city.longitude }, e.coordinates) }))
    .filter(x => x.d <= 25000);
  const byName = near.filter(x => matchesName(x.e)).sort((a, b) => a.d - b.d);
  if (byName.length) return (byName.filter(x => isPlace(x.e))[0] || byName[0]).e;
  const withoutCoordinates = here.filter(e => !e.coordinates && matchesName(e) && isPlace(e));
  if (withoutCoordinates.length === 1) return withoutCoordinates[0];
  const close = near.filter(x => x.d <= 3000 && isPlace(x.e));
  return close.length === 1 ? close[0].e : null;
}
