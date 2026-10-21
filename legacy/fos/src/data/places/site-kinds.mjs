// Which kinds of loading/unloading places suit a cargo (a FOS planning heuristic, not an official classification).
// Kinds: industrialZone, port, railTerminal, logisticsPark, silo (see scripts/build-locations.mjs).
const DEFAULT = ["industrialZone", "logisticsPark"];

const BY_FAMILY = {
  "Agriculture & food": ["logisticsPark", "industrialZone"],
  "Retail & consumer goods": ["logisticsPark", "industrialZone", "railTerminal"],
  "Building & materials": ["industrialZone", "port", "railTerminal"],
  "Industrial & energy": ["industrialZone", "logisticsPark"],
  "Chemicals & regulated": ["industrialZone", "port"],
  "Vehicles & livestock": ["logisticsPark", "industrialZone", "port"],
};

const BY_CARGO = {
  wheat: ["silo", "port", "railTerminal"], maize: ["silo", "port", "railTerminal"], barley: ["silo", "port", "railTerminal"],
  animalFeed: ["silo", "industrialZone"], fertilizer: ["silo", "port", "industrialZone"],
  rice: ["port", "logisticsPark"], flour: ["industrialZone", "silo"], sugar: ["industrialZone", "port"],
  coffee: ["port", "logisticsPark"], cocoa: ["port", "logisticsPark"],
  containerizedFreight: ["port", "railTerminal", "logisticsPark"],
  cementBulk: ["industrialZone", "port"], gravel: ["industrialZone", "port"], sand: ["industrialZone", "port"],
  steelCoils: ["port", "industrialZone", "railTerminal"], steelSections: ["port", "industrialZone"],
  fuel: ["port", "industrialZone"], livestock: ["industrialZone"],
  cars: ["port", "logisticsPark", "railTerminal"], commercialVehicles: ["port", "logisticsPark"],
};

export const siteKindsFor = cargo => BY_CARGO[cargo.id] || BY_FAMILY[cargo.family] || DEFAULT;
