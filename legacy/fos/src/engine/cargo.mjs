// Cargo selection from the FOS catalog. The choice is part of the simulated load.
import { CARGO } from "../data/cargo/catalog.mjs";
import { NST_ESTIMATES } from "../data/cargo/nst-estimates.mjs";
import { estimated, simulated, unavailable } from "./provenance.mjs";

export { CARGO };
export const families = () => [...new Set(Object.values(CARGO).map(cargo => cargo.family))];

export const eligibleCargo = ({ family = "all", equipmentId = "random" } = {}) =>
  Object.values(CARGO).filter(cargo =>
    (family === "all" || cargo.family === family) && (equipmentId === "random" || cargo.equipmentIds.includes(equipmentId)));

// A specific id is kept; "random" draws from the family and trailer filter. null = nothing fits.
export function resolveCargoId({ family = "all", cargoId = "random", equipmentId = "random", random = Math.random } = {}) {
  if (cargoId !== "random") return CARGO[cargoId] ? cargoId : null;
  const candidates = eligibleCargo({ family, equipmentId });
  if (!candidates.length) return null;
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))].id;
}

export function cargoFacts(cargo) {
  const chapters = NST_ESTIMATES[cargo.family];
  return {
    selection: simulated({
      id: cargo.id, name: cargo.name, family: cargo.family, loadForm: cargo.loadForm || null,
      handling: cargo.handling || [], regulatoryReview: cargo.regulatoryReview || null, equipmentIds: [...cargo.equipmentIds],
    }, "cargoDraw"),
    nstChapters: chapters ? estimated(chapters, "nstFamily") : unavailable("3", "nstMissing"),
    cnCode: unavailable("3", "cnCode"),
    adr: unavailable("3", "adr"),
    temperature: unavailable("3", "temperature"),
  };
}
