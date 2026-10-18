/**
 * FOS scenario composition. Place and route facts are supplied by providers;
 * cargo and equipment are generated planning concepts, not a real booking.
 */
export const CARGO = {
  dryGoods: {
    id: "dryGoods",
    name: "Palletized dry goods",
    description: "General non-hazardous packaged freight",
    equipmentIds: ["dryVan", "curtainsider"],
  },
  chilledFood: {
    id: "chilledFood",
    name: "Chilled food products",
    description: "Temperature-controlled food freight",
    equipmentIds: ["reefer"],
  },
  freshProduce: {
    id: "freshProduce",
    name: "Fresh produce",
    description: "Fresh fruit and vegetables; handling needs vary by product",
    equipmentIds: ["reefer", "curtainsider"],
  },
  buildingMaterials: {
    id: "buildingMaterials",
    name: "Building materials",
    description: "Packaged or secured construction materials",
    equipmentIds: ["flatbed", "curtainsider"],
  },
  machinery: {
    id: "machinery",
    name: "Industrial machinery",
    description: "Machinery; dimensions and permits depend on the actual item",
    equipmentIds: ["lowboy", "flatbed"],
  },
  containerFreight: {
    id: "containerFreight",
    name: "Containerized freight",
    description: "Intermodal container movement",
    equipmentIds: ["containerChassis"],
  },
  bulkGrain: {
    id: "bulkGrain",
    name: "Bulk grain",
    description: "Dry agricultural bulk; unloading and commodity rules vary",
    equipmentIds: ["grainHopper"],
  },
};

export const EQUIPMENT = {
  dryVan: { id: "dryVan", name: "Dry van" },
  reefer: { id: "reefer", name: "Refrigerated trailer" },
  flatbed: { id: "flatbed", name: "Flatbed trailer" },
  curtainsider: { id: "curtainsider", name: "Curtainsider trailer" },
  lowboy: { id: "lowboy", name: "Lowboy trailer" },
  containerChassis: { id: "containerChassis", name: "Container chassis" },
  grainHopper: { id: "grainHopper", name: "Bulk hopper trailer" },
};

export const WORLD_MODES = {
  ATS: { id: "ATS", label: "American Truck Simulator", distanceUnit: "mi" },
  ETS2: { id: "ETS2", label: "Euro Truck Simulator 2", distanceUnit: "km" },
};

const pick = (items, random) => items[Math.min(items.length - 1, Math.floor(random() * items.length))];

export function generateMission({ world = "ATS", origin, destination, route, cargoId = "random", now = new Date(), random = Math.random } = {}) {
  const mode = WORLD_MODES[world];
  if (!mode) throw new Error(`Unknown transport world: ${world}`);
  if (!origin || !destination || !route) throw new Error("Search for a real origin, destination, and truck route first.");
  const cargoKey = cargoId === "random" ? pick(Object.keys(CARGO), random) : cargoId;
  const cargo = CARGO[cargoKey];
  if (!cargo) throw new Error(`Unknown cargo category: ${cargoId}`);
  const equipment = pick(cargo.equipmentIds.map(id => EQUIPMENT[id]), random);
  const distance = mode.distanceUnit === "mi" ? route.distanceMeters / 1609.344 : route.distanceMeters / 1000;
  const idSuffix = Math.floor(random() * 0xffffff).toString(36).toUpperCase().padStart(5, "0").slice(-5);
  return {
    schemaVersion: 2,
    id: `FOS-${world}-${now.getUTCFullYear()}-${idSuffix}`,
    createdAt: now.toISOString(),
    world,
    origin,
    destination,
    route: {
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      distance: Number(distance.toFixed(1)),
      unit: mode.distanceUnit,
      provider: route.provider,
      sourceUrl: route.sourceUrl,
      retrievedAt: route.retrievedAt,
      profile: route.profile,
    },
    cargo: { ...cargo, status: "generated-planning-scenario" },
    equipment: { ...equipment, status: "suggested-compatibility" },
    isSimulated: true,
  };
}

export function validateMission(mission) {
  const errors = [];
  if (!mission || mission.schemaVersion !== 2) return ["Unsupported mission schema."];
  if (!WORLD_MODES[mission.world]) errors.push("Unknown transport world.");
  for (const endpoint of [mission.origin, mission.destination]) {
    if (!endpoint || !Number.isFinite(endpoint.lat) || !Number.isFinite(endpoint.lon) || !endpoint.name) errors.push("A sourced location is missing.");
  }
  const cargo = CARGO[mission.cargo?.id];
  const equipment = EQUIPMENT[mission.equipment?.id];
  if (!cargo || !equipment || !cargo.equipmentIds.includes(equipment.id)) errors.push("Cargo and equipment suggestions are inconsistent.");
  if (!Number.isFinite(mission.route?.distanceMeters) || mission.route.distanceMeters <= 0) errors.push("A routed distance is missing.");
  if (!Number.isFinite(mission.route?.durationSeconds) || mission.route.durationSeconds <= 0) errors.push("A routed duration is missing.");
  if (mission.isSimulated !== true) errors.push("The shipment scenario must remain marked as simulated.");
  return errors;
}
