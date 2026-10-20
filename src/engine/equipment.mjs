// Trailer choice: the catalog rule cargo -> listed trailers (a planning heuristic).
import { EQUIPMENT } from "../data/equipment/catalog.mjs";
import { CARGO } from "../data/cargo/catalog.mjs";
import { eligibleCargo } from "./cargo.mjs";
import { computed } from "./provenance.mjs";

export { EQUIPMENT };
export const isCompatible = (cargo, equipmentId) => Boolean(cargo?.equipmentIds?.includes(equipmentId));

// Trailers that make sense for the current choice: the cargo's own list, the family's union, or all.
export function eligibleEquipment({ family = "all", cargoId = "random" } = {}) {
  if (cargoId !== "random" && CARGO[cargoId]) return CARGO[cargoId].equipmentIds.map(id => EQUIPMENT[id]).filter(Boolean);
  const ids = new Set(eligibleCargo({ family }).flatMap(cargo => cargo.equipmentIds));
  return Object.values(EQUIPMENT).filter(equipment => ids.has(equipment.id));
}

export function pickEquipment(cargo, equipmentId = "random", random = Math.random) {
  const options = cargo.equipmentIds.map(id => EQUIPMENT[id]).filter(Boolean);
  if (equipmentId !== "random") {
    if (!isCompatible(cargo, equipmentId)) throw new Error(`trailer ${equipmentId} is not listed for ${cargo.id}`);
    return EQUIPMENT[equipmentId];
  }
  return options[Math.min(options.length - 1, Math.floor(random() * options.length))];
}

export function equipmentSelectionFact(cargo, equipment, requested) {
  return computed(
    { id: equipment.id, name: equipment.name, category: equipment.category, checks: equipment.checks || [] },
    requested === "random" ? "trailerRuleRandom" : "trailerRuleChosen",
    { cargo: cargo.id, options: cargo.equipmentIds.length },
  );
}
