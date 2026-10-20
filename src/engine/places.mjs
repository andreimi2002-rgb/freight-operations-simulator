// Origin and destination: GeoNames cities (phase 2 adds real loading points from OSM).
import { sourced } from "./provenance.mjs";

export const MIN_KM = 45;
export const MAX_KM = 1450;

export function straightLineKm(a, b) {
  const rad = degrees => degrees * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const pick = (items, random) => items[Math.min(items.length - 1, Math.floor(random() * items.length))];
const inRange = (a, b) => a.id !== b.id && (d => d >= MIN_KM && d <= MAX_KM)(straightLineKm(a, b));

// The missing end of a route when only one city was chosen.
export function drawCounterpart(cities, fixed, random = Math.random) {
  const candidates = cities.filter(city => inRange(city, fixed));
  return candidates.length ? pick(candidates, random) : null;
}

export function randomPair(cities, random = Math.random, attempts = 200) {
  if (cities.length < 2) throw new Error("city catalog not loaded");
  for (let i = 0; i < attempts; i += 1) {
    const a = pick(cities, random);
    const b = pick(cities, random);
    if (inRange(a, b)) return [a, b];
  }
  throw new Error("no usable city pair");
}

// importedAt: the import date of the city's catalog (each city may carry its own: city.importedAt)
export function toPlace(city, importedAt) {
  return sourced({
    geonamesId: city.id,
    name: city.name,
    countryCode: city.countryCode,
    lat: city.latitude,
    lon: city.longitude,
    timeZone: city.timeZone,
    population: city.population,
    placeType: "city",
    locode: null, // TODO(phase 2): UN/LOCODE
  }, { name: "GeoNames", url: `https://www.geonames.org/${city.id}/`, retrievedAt: city.importedAt || importedAt, license: "CC BY 4.0" });
}
