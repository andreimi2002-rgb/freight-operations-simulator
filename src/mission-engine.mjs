/** FOS cargo and equipment suggestions are scenario planning concepts, never booking facts. */
import { CARGO } from "./data/cargo-catalog.mjs";
export { CARGO } from "./data/cargo-catalog.mjs";

export const EQUIPMENT = {
  dryVan: { id: "dryVan", name: "Enclosed dry van / box trailer", category: "Enclosed", uses: "Palletized and protected general freight", variants: ["Single-temperature, non-refrigerated", "Standard and high-cube body options"], checks: ["Payload and axle limits", "Load restraint and compatibility"] },
  reefer: { id: "reefer", name: "Refrigerated trailer (reefer)", category: "Temperature-controlled", uses: "Chilled or frozen freight when the unit and setup suit the product", variants: ["Single-temperature", "Multi-temperature / multi-compartment", "Bulkhead-configurable"], checks: ["Product-specific setpoint and operating range", "Pre-cooling, airflow, recording, sanitation, and ATP/market requirements"] },
  flatbed: { id: "flatbed", name: "Flatbed / platform trailer", category: "Open deck", uses: "Long, oversized, or crane-loaded freight", variants: ["Standard flatbed", "Extendable / telescopic", "Coil well / coil carrier", "Drop-side platform"], checks: ["Load restraint plan", "Weather protection", "Overhang, dimensions, permits, and axle loads"] },
  curtainsider: { id: "curtainsider", name: "Curtainsider / tautliner", category: "Enclosed-side access", uses: "Palletized general freight with side-loading access", variants: ["Standard curtainsider", "Reinforced curtainsider", "Double-deck", "Coil-well curtainsider"], checks: ["Curtain is not a substitute for rated load restraint", "Check side-loading and cargo securement"] },
  lowboy: { id: "lowboy", name: "Lowboy / low-loader", category: "Heavy and abnormal loads", uses: "Tall or heavy plant and machinery where a lower deck is required", variants: ["Removable gooseneck (RGN)", "Fixed-neck low-loader", "Multi-axle modular low-loader"], checks: ["Route survey, bridge/axle limits, permits, loading method, and tractor compatibility"] },
  containerChassis: { id: "containerChassis", name: "Intermodal container chassis", category: "Intermodal", uses: "ISO freight containers moved between port, rail, and inland terminals", variants: ["20 ft", "40 ft", "45 ft / extendable", "Gooseneck or straight-frame"], checks: ["Container size, gross mass, twistlocks, chassis rating, and terminal rules"] },
  grainHopper: { id: "grainHopper", name: "Gravity-discharge grain hopper", category: "Bulk and agricultural", uses: "Dry granular commodities unloaded through hopper gates", variants: ["Single- or multi-compartment hopper", "Weather-tight covers", "Bottom-discharge"], checks: ["Commodity cleanliness, moisture protection, gate compatibility, and unloading site"] },
  walkingFloor: { id: "walkingFloor", name: "Moving-floor / walking-floor trailer", category: "Bulk and agricultural", uses: "Enclosed or covered loose, baled, or palletized freight", variants: ["Moving-floor slats", "Bulk body", "Push-floor system"], checks: ["Floor pressure and material compatibility", "Discharge clearance and receiving facility"] },
  bulkTanker: { id: "bulkTanker", name: "Pneumatic dry-bulk tanker", category: "Bulk and agricultural", uses: "Powdered or granular dry bulk discharged pneumatically", variants: ["Food-grade tanker", "Cement / powder tanker", "Compartmented dry-bulk tanker"], checks: ["Product compatibility, pressure/unloading connections, cleaning, and certification"] },
  foodTanker: { id: "foodTanker", name: "Food-grade liquid tanker", category: "Tank", uses: "Food liquids carried in purpose-built sanitary tanks", variants: ["Insulated", "Heated", "Multi-compartment", "Stainless steel"], checks: ["Food-contact approval, cleaning records, product compatibility, and temperature control"] },
  chemicalTanker: { id: "chemicalTanker", name: "Chemical tanker (product specification required)", category: "Tank and regulated", uses: "Liquid chemicals in a tank specifically compatible with the substance", variants: ["Stainless steel", "Lined tank", "Insulated / heated", "Compartmented"], checks: ["Exact product, ADR classification, tank code, material compatibility, and cleaning"] },
  fuelTanker: { id: "fuelTanker", name: "Petroleum / fuel tanker", category: "Tank and regulated", uses: "Liquid petroleum products carried in dedicated tank compartments", variants: ["Multi-compartment road tanker", "Bottom-loading", "Insulated bitumen tanker"], checks: ["Exact product, ADR classification, tank approval, vapor controls, and site procedure"] },
  tipper: { id: "tipper", name: "End-tipper / dump trailer", category: "Bulk and construction", uses: "Loose aggregates and similar material discharged by tipping", variants: ["End tipper", "Side tipper", "Walking-floor alternative"], checks: ["Tipping clearance, ground stability, overhead hazards, and cover/spill rules"] },
  logTrailer: { id: "logTrailer", name: "Logging / timber trailer", category: "Forestry", uses: "Roundwood and long timber secured between stakes", variants: ["Pole trailer", "Extendable log trailer", "Self-loading crane-equipped"], checks: ["Load restraint, stake rating, length, overhang, and route restrictions"] },
  carTransporter: { id: "carTransporter", name: "Vehicle transporter / car carrier", category: "Vehicles", uses: "Cars and light commercial vehicles on purpose-built decks", variants: ["Single deck", "Double deck", "Rigid-plus-trailer combination"], checks: ["Vehicle dimensions, deck positions, restraints, loading ramps, and height"] },
  livestockTrailer: { id: "livestockTrailer", name: "Livestock trailer", category: "Animal transport", uses: "Live animals in purpose-built ventilated compartments", variants: ["Single or multi-deck", "Species-specific compartments", "Watering / ventilation systems"], checks: ["Species, journey duration, welfare rules, stocking density, cleaning, and jurisdiction"] },
  multiTemperatureReefer: { id: "multiTemperatureReefer", name: "Multi-temperature / multi-compartment reefer", category: "Temperature-controlled", uses: "Separately controlled cargo zones for compatible products with distinct temperature requirements", variants: ["Fixed insulated bulkheads", "Movable bulkhead", "Multiple evaporator zones"], checks: ["Zone-specific setpoints and airflow", "Do not assume mixed products are compatible", "Verify monitoring, sanitation, and local certification"] },
  insulatedTanker: { id: "insulatedTanker", name: "Insulated / heated tanker", category: "Tank", uses: "Temperature-sensitive liquid or viscous products", variants: ["Insulated", "Steam-heated", "Thermal-oil heated"], checks: ["Product temperature range, tank lining, heating method, and cleaning"] },
  intermodalSwapBody: { id: "intermodalSwapBody", name: "Swap-body / demountable body", category: "Intermodal", uses: "Road-rail distribution using demountable freight bodies", variants: ["Curtainside", "Box body", "Containerized swap body"], checks: ["Body format, support legs, carrier compatibility, and terminal equipment"] },
  skeletalTrailer: { id: "skeletalTrailer", name: "Skeletal container trailer", category: "Intermodal", uses: "ISO containers in port, rail, and inland drayage", variants: ["20 ft", "40 ft", "Extendable 20/40/45 ft"], checks: ["Container locking points, chassis mass rating, and local axle limits"] },
  stepDeck: { id: "stepDeck", name: "Step-deck / drop-deck platform", category: "Open deck", uses: "Tall machinery or equipment requiring lower deck height than a flatbed", variants: ["Fixed step deck", "Extendable step deck", "Double-drop"], checks: ["Loaded height, deck loading, permits, and load restraint"] },
  extendableFlatbed: { id: "extendableFlatbed", name: "Extendable flatbed", category: "Open deck", uses: "Long structural, energy, and industrial components", variants: ["Telescopic single extension", "Multi-extension", "Removable rear extension"], checks: ["Route survey, turning radius, axle distribution, escort, and permits"] },
  coilCarrier: { id: "coilCarrier", name: "Steel-coil carrier / coil well", category: "Steel and metals", uses: "Steel coils secured in a designed cradle or recessed coil well", variants: ["Coil-well flatbed", "Coil-well curtainsider", "Covered coil carrier"], checks: ["Coil mass, cradle geometry, restraint, and concentrated axle loading"] },
  carTransporterSingle: { id: "carTransporterSingle", name: "Single-deck vehicle transporter", category: "Vehicles", uses: "Cars or vans loaded on one purpose-built vehicle deck", variants: ["Rigid transporter", "Articulated single deck"], checks: ["Vehicle dimensions, restraint points, and deck ratings"] },
  carTransporterDouble: { id: "carTransporterDouble", name: "Double-deck car transporter", category: "Vehicles", uses: "Multiple cars on upper and lower adjustable decks", variants: ["Articulated double deck", "Rigid plus drawbar"], checks: ["Overall height, individual vehicle clearances, deck restraints, and route"] },
  sideTipper: { id: "sideTipper", name: "Side-tipper / side-dump trailer", category: "Bulk and construction", uses: "Loose bulk discharged to the side where the site permits", variants: ["Single-side", "Bi-directional"], checks: ["Ground stability, side-clearance, tipping procedure, and overhead hazards"] },
  foodGradeDryBulk: { id: "foodGradeDryBulk", name: "Food-grade pneumatic dry-bulk tanker", category: "Bulk and food-grade", uses: "Food powders or granules moved through sanitary pneumatic equipment", variants: ["Multi-compartment", "Sanitary stainless steel", "Dedicated food-grade"], checks: ["Allergen controls, wash certification, product compatibility, and unloading connection"] },
};

export const WORLD_MODES = {
  ATS: { id: "ATS", label: "American Truck Simulator", distanceUnit: "mi" },
  ETS2: { id: "ETS2", label: "Euro Truck Simulator 2", distanceUnit: "km" },
};

const pick = (items, random) => items[Math.min(items.length - 1, Math.floor(random() * items.length))];

function distanceKm(a, b) {
  const radians = degrees => degrees * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function toSourcedPlace(city, importedAt) {
  const country = new Intl.DisplayNames(["en"], { type: "region" }).of(city.countryCode);
  return {
    id: String(city.id),
    name: city.name,
    address: `${city.name}, ${country}`,
    city: city.name,
    country,
    countryCode: city.countryCode,
    lat: city.latitude,
    lon: city.longitude,
    sourceName: "GeoNames",
    sourceUrl: `https://www.geonames.org/${city.id}/`,
    attribution: "GeoNames, CC BY 4.0",
    retrievedAt: importedAt,
    population: city.population,
    timeZone: city.timeZone,
  };
}

export function chooseRandomCityPair({ world = "ATS", cityCatalog, random = Math.random, attempts = 120 } = {}) {
  if (!WORLD_MODES[world]) throw new Error(`Unknown transport world: ${world}`);
  const cities = cityCatalog?.cities?.filter(city => city.worlds?.includes(world)) || [];
  if (cities.length < 2) throw new Error(`No GeoNames city catalog is loaded for ${world}.`);
  const minKm = world === "ATS" ? 80 : 45;
  const maxKm = world === "ATS" ? 2400 : 1450;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const origin = pick(cities, random);
    const destination = pick(cities, random);
    if (origin.id === destination.id) continue;
    const straightLineKm = distanceKm(origin, destination);
    if (straightLineKm < minKm || straightLineKm > maxKm) continue;
    return {
      origin: toSourcedPlace(origin, cityCatalog.metadata?.importedAt),
      destination: toSourcedPlace(destination, cityCatalog.metadata?.importedAt),
      straightLineKm,
    };
  }
  throw new Error(`Could not draw a usable random ${world} city pair. Generate another scenario.`);
}

export function generateMission({ world = "ATS", origin, destination, route, cargoId = "random", equipmentId = "random", now = new Date(), random = Math.random } = {}) {
  const mode = WORLD_MODES[world];
  if (!mode) throw new Error(`Unknown transport world: ${world}`);
  if (!origin || !destination || !route) throw new Error("Search for a real origin, destination, and truck route first.");
  if (equipmentId !== "random" && !EQUIPMENT[equipmentId]) throw new Error(`Unknown trailer type: ${equipmentId}`);
  const randomCargoes = Object.values(CARGO).filter(record => equipmentId === "random" || record.equipmentIds.includes(equipmentId));
  if (!randomCargoes.length) throw new Error(`No cargo planning suggestions support ${EQUIPMENT[equipmentId]?.name || equipmentId}.`);
  const cargo = cargoId === "random"
    ? pick(randomCargoes, random)
    : CARGO[cargoId];
  if (!cargo) throw new Error(`Unknown cargo category: ${cargoId}`);
  const compatibleEquipment = cargo.equipmentIds.map(id => EQUIPMENT[id]);
  const equipment = equipmentId === "random"
    ? pick(compatibleEquipment, random)
    : compatibleEquipment.find(candidate => candidate.id === equipmentId);
  if (!equipment) throw new Error(`Equipment is not listed as a planning match for ${cargo.name}.`);
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
      trafficModel: route.trafficModel || "free_flow",
      routeDetails: {
        modeledMaximumGrossWeightKg: route.modeledMaximumGrossWeightKg ?? null,
        modeledMaximumHeightMeters: route.modeledMaximumHeightMeters ?? null,
        trafficModel: route.trafficModel || "not_returned",
        hasTolls: route.hasTolls === true,
        hasFerries: route.hasFerries === true,
        countries: route.countries || [],
        roadClasses: route.roadClasses || [],
        namedRoads: route.namedRoads || [],
        surfaces: route.surfaces || [],
        segmentCount: route.segmentCount || 0,
        providerSegmentCount: route.providerSegmentCount || route.segmentCount || 0,
        maneuverCount: route.maneuverCount || (route.segments || []).length,
        omittedSegmentCount: route.omittedSegmentCount || 0,
        segments: route.segments || [],
        geometry: route.geometry || [],
        mapImageDataUrl: route.mapImageDataUrl || null,
        mapError: route.mapError || null,
      },
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
