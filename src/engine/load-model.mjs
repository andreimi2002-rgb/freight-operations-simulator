// The Load: one generated truck load. Documented in docs/LOAD-MODEL.md.
import { collectFacts, validateFact } from "./provenance.mjs";
import { ACTIVE_COUNTRIES } from "../data/countries.mjs";

export const SCHEMA_VERSION = 3;

// Paths that every load must have (each is a fact, possibly "unavailable").
const REQUIRED = [
  "origin", "destination", "route.summary", "route.borderCrossings", "route.countryDistances",
  "cargo.selection", "cargo.nstChapters", "cargo.cnCode", "cargo.adr", "cargo.temperature",
  "packaging.unitType", "packaging.unitCount", "packaging.unitMassKg", "packaging.totalMassKg", "packaging.loadingMetres",
  "equipment.selection", "equipment.floor",
  "transit", "timeWindows.loading", "timeWindows.unloading", "parties.shipperRole", "parties.consigneeRole",
];

export function createLoad({ id, createdAt, origin, destination, route, cargo, packaging, equipment, transit, timeWindows, parties, warnings = [], countries = ACTIVE_COUNTRIES }) {
  return {
    id,
    createdAt,
    schemaVersion: SCHEMA_VERSION,
    scope: { countries: [...countries] },
    origin, destination, route, cargo, packaging, equipment, transit, timeWindows, parties,
    truck: null,      // TODO(phase 4): real truck model with sourced specifications
    driver: null,     // TODO(phase 6): full driver-hours plan (Reg. 561/2006, weekend bans)
    costs: null,      // TODO(phase 6): diesel (EU Weekly Oil Bulletin) and tolls (official tariffs)
    documents: [],    // TODO(phase 7): CMR and ADR transport document
    warnings,
  };
}

const get = (load, path) => path.split(".").reduce((node, key) => node?.[key], load);

export function validateLoad(load, { countries = ACTIVE_COUNTRIES } = {}) {
  const problems = [];
  if (!load || load.schemaVersion !== SCHEMA_VERSION) return ["unsupported load schema"];
  if (!load.id || !load.createdAt) problems.push("load without id or creation time");
  for (const path of REQUIRED) if (!get(load, path)) problems.push(`missing ${path}`);
  for (const { path, fact } of collectFacts(load)) for (const problem of validateFact(fact)) problems.push(`${path}: ${problem}`);
  for (const end of ["origin", "destination"]) {
    const place = load[end]?.value;
    if (!place || !countries.includes(place.countryCode)) problems.push(`${end} outside the active countries`);
    if (place && (!Number.isFinite(place.lat) || !Number.isFinite(place.lon))) problems.push(`${end} without coordinates`);
  }
  const cargo = load.cargo?.selection?.value;
  const equipment = load.equipment?.selection?.value;
  if (cargo && equipment && !cargo.equipmentIds?.includes(equipment.id)) problems.push("trailer not listed for this cargo");
  const loading = load.timeWindows?.loading?.value;
  const unloading = load.timeWindows?.unloading?.value;
  const transitMin = load.transit?.value?.totalMin;
  if (loading && unloading && Number.isFinite(transitMin)) {
    if (Date.parse(loading.to) <= Date.parse(loading.from)) problems.push("loading window ends before it starts");
    if (Date.parse(unloading.from) < Date.parse(loading.to) + transitMin * 60000) problems.push("unloading starts before the minimum transit time");
  }
  return problems;
}
