// Packaging, mass and loading metres (phase 1B). EUR pallets only, on trailers whose floor has
// a cited source. Everything else is reported as unavailable with its reason and phase.
import { EUR_PALLET } from "../data/regulations/packaging.mjs";
import { TRAILER_FLOORS } from "../data/equipment/floors.mjs";
import { PACKAGING_PROFILES } from "../data/cargo/packaging-profiles.mjs";
import { computed, estimated, sourced, unavailable } from "./provenance.mjs";

// Pure arithmetic, exported for tests. Pallets lie lengthwise (1200 mm along the trailer).
export function palletsOnFloor(floor, unit = EUR_PALLET) {
  const rows = Math.floor(floor.lengthMm / unit.lengthMm);
  const across = Math.floor(floor.widthMm / unit.widthMm);
  return { rows, across, capacity: rows * across };
}

export function planLoad({ floor, unitMassKg, unit = EUR_PALLET }) {
  const { rows, across, capacity } = palletsOnFloor(floor, unit);
  const byPayload = Math.floor(floor.payloadKg / unitMassKg);
  const count = Math.max(0, Math.min(capacity, byPayload));
  const usedRows = Math.ceil(count / across);
  return {
    rows, across, capacity, byPayload, count,
    limitedBy: count < capacity ? "payload" : "floor",
    totalMassKg: count * unitMassKg,
    loadingMetres: Math.round(usedRows * unit.lengthMm) / 1000,
  };
}

export const midpoint = ({ min, max }) => Math.round((min + max) / 2 / 10) * 10;

const allUnavailable = (phase, reason) => ({
  unitType: unavailable(phase, reason),
  unitCount: unavailable(phase, reason),
  unitMassKg: unavailable(phase, reason),
  totalMassKg: unavailable(phase, reason),
  loadingMetres: unavailable(phase, reason),
});

export function floorFact(equipmentId) {
  const floor = TRAILER_FLOORS[equipmentId];
  if (!floor) return unavailable("4", "floorUnknown");
  const { source, ...dims } = floor;
  return sourced(dims, source);
}

export function packagingFacts(cargo, equipmentId) {
  const profile = PACKAGING_PROFILES[cargo.id];
  if (!profile) return allUnavailable("3", "noProfile");
  if (!profile.unitType) return allUnavailable(profile.phase, profile.reason);
  const floor = TRAILER_FLOORS[equipmentId];
  if (!floor) return allUnavailable("4", "trailerNotPalletized");

  const unitMassKg = midpoint(profile.unitMassKg);
  const plan = planLoad({ floor, unitMassKg });
  const floorInputs = { floorLengthMm: floor.lengthMm, floorWidthMm: floor.widthMm, palletLengthMm: EUR_PALLET.lengthMm, palletWidthMm: EUR_PALLET.widthMm };
  return {
    unitType: sourced({ id: EUR_PALLET.id, lengthMm: EUR_PALLET.lengthMm, widthMm: EUR_PALLET.widthMm, heightMm: EUR_PALLET.heightMm, safeWorkingLoadKg: EUR_PALLET.safeWorkingLoadKg }, EUR_PALLET.source),
    unitCount: computed(plan.count, plan.limitedBy === "payload" ? "palletsByPayload" : "palletsOnFloor", {
      ...floorInputs, rows: plan.rows, across: plan.across, capacity: plan.capacity, payloadKg: floor.payloadKg, unitMassKg,
    }, { dependsOnEstimate: plan.limitedBy === "payload" }),
    unitMassKg: estimated(unitMassKg, `unitMass.${profile.basis}`, { range: profile.unitMassKg }),
    totalMassKg: computed(plan.totalMassKg, "totalMass", { count: plan.count, unitMassKg }, { dependsOnEstimate: true }),
    loadingMetres: computed(plan.loadingMetres, "loadingMetres", { count: plan.count, across: plan.across, palletLengthMm: EUR_PALLET.lengthMm }),
  };
}
