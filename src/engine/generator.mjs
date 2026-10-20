// Builds one complete Load. Pure apart from the injected routing adapter.
import { CARGO, cargoFacts, resolveCargoId } from "./cargo.mjs";
import { equipmentSelectionFact, pickEquipment } from "./equipment.mjs";
import { floorFact, packagingFacts } from "./load-planning.mjs";
import { drawCounterpart, randomPair, toPlace } from "./places.mjs";
import { routeFacts } from "./route.mjs";
import { transitFact } from "./transit-time.mjs";
import { generateWindows, windowFacts } from "./time-windows.mjs";
import { partyFacts } from "./parties.mjs";
import { routeGeoFacts } from "./geo-facts.mjs";
import { pickSite, siteFact } from "./sites.mjs";
import { createLoad, validateLoad } from "./load-model.mjs";

export class GenerationError extends Error {
  constructor(code, detail = "") { super(detail || code); this.code = code; }
}

function loadId(now, random) {
  const suffix = Math.floor(random() * 0xffffff).toString(36).toUpperCase().padStart(5, "0").slice(-5);
  return `FOS-${now.getUTCFullYear()}-${suffix}`;
}

export async function generateLoad({
  cities, importedAt, router,
  originCity = null, destinationCity = null,
  family = "all", cargoId = "random", equipmentId = "random",
  now = new Date(), random = Math.random, countries, geo = null, sites = null,
}) {
  let a = originCity;
  let b = destinationCity;
  if (a && !b) b = drawCounterpart(cities, a, random);
  else if (b && !a) a = drawCounterpart(cities, b, random);
  else if (!a && !b) [a, b] = randomPair(cities, random);
  if (!a || !b) throw new GenerationError("noPair");

  const resolved = resolveCargoId({ family, cargoId, equipmentId, random });
  if (!resolved) throw new GenerationError("noCargo");
  const cargo = CARGO[resolved];
  const equipment = pickEquipment(cargo, equipmentId, random);

  const origin = toPlace(a, importedAt);
  const destination = toPlace(b, importedAt);
  // A real loading place in the city (OpenStreetMap), when the catalog has one; the route then runs between the places.
  const originSite = siteFact(pickSite(a.id, cargo, sites, random), importedAt);
  const destinationSite = siteFact(pickSite(b.id, cargo, sites, random), importedAt);
  const route = await routeFacts(router, originSite.value ?? origin.value, destinationSite.value ?? destination.value);
  Object.assign(route, routeGeoFacts(route.summary.value, geo)); // distance by country and border crossings
  const transit = transitFact(route.summary.value.durationS);
  const windows = generateWindows({
    now, originTimeZone: a.timeZone, destinationTimeZone: b.timeZone, transitMin: transit.value.totalMin, random,
  });
  const packaging = packagingFacts(cargo, equipment.id);

  const warnings = [{ id: "routeDurationNotTachograph" }];
  if (packaging.totalMassKg.level !== "unavailable") warnings.push({ id: "massDependsOnEstimate" });
  if (windows.weekendShift) warnings.push({ id: "weekendUnloading" });
  if (transit.value.exceedsWeeklyLimit) warnings.push({ id: "weeklyDrivingLimit" });
  if (cargo.regulatoryReview) warnings.push({ id: "regulatoryReview" });

  const load = createLoad({
    id: loadId(now, random),
    createdAt: now.toISOString(),
    origin, destination, originSite, destinationSite, route,
    cargo: cargoFacts(cargo),
    packaging,
    equipment: { selection: equipmentSelectionFact(cargo, equipment, equipmentId), floor: floorFact(equipment.id) },
    transit,
    timeWindows: windowFacts(windows),
    parties: partyFacts(cargo, random),
    warnings,
    ...(countries ? { countries } : {}),
  });
  const problems = validateLoad(load, countries ? { countries } : undefined);
  if (problems.length) throw new GenerationError("invalidLoad", problems.join("; "));
  return load;
}
