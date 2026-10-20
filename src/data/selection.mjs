// Pure helpers for the "new load" form: which cargo and trailers fit together,
// and how a missing origin/destination is drawn. No DOM.
import { CARGO, EQUIPMENT } from "../mission-engine.mjs";

export const families = () => [...new Set(Object.values(CARGO).map(cargo => cargo.family))];

export const eligibleCargo = ({ family = "all", equipmentId = "random" } = {}) =>
  Object.values(CARGO).filter(cargo =>
    (family === "all" || cargo.family === family) && (equipmentId === "random" || cargo.equipmentIds.includes(equipmentId)));

// Trailers that make sense for the current choice: the cargo's own list, or the union for a family, or all.
export function eligibleEquipment({ family = "all", cargoId = "random" } = {}) {
  if (cargoId !== "random" && CARGO[cargoId]) return CARGO[cargoId].equipmentIds.map(id => EQUIPMENT[id]).filter(Boolean);
  const ids = new Set(eligibleCargo({ family }).flatMap(cargo => cargo.equipmentIds));
  return Object.values(EQUIPMENT).filter(equipment => ids.has(equipment.id));
}

// The engine ignores the family filter when the cargo is random, so the form resolves it here.
export function resolveCargoId({ family = "all", cargoId = "random", equipmentId = "random", random = Math.random } = {}) {
  if (cargoId !== "random") return cargoId;
  const candidates = eligibleCargo({ family, equipmentId });
  if (!candidates.length) return null;
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))].id;
}

const MIN_KM = 45;
const MAX_KM = 1450;
function straightLineKm(a, b) {
  const rad = degrees => degrees * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Draws the missing end of a route when the user picked only one city. Same 45-1450 km rule as the engine's random draw.
export function drawCounterpart(cities, fixed, random = Math.random) {
  const candidates = cities.filter(city => city.id !== fixed.id && (d => d >= MIN_KM && d <= MAX_KM)(straightLineKm(city, fixed)));
  if (!candidates.length) return null;
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
}
