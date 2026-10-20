// Simulated parties: the ROLE of the shipper and consignee (never a real company).
// Per cargo family, with overrides for cargo whose chain differs from its family.
export const ROLES_BY_FAMILY = {
  "Agriculture & food": { shippers: ["producer", "packhouse", "coldStore", "processor"], consignees: ["distributor", "retailDc", "processor", "wholesaler"] },
  "Retail & consumer goods": { shippers: ["manufacturer", "distributor", "parcelHub"], consignees: ["retailDc", "wholesaler", "parcelHub"] },
  "Building & materials": { shippers: ["manufacturer", "builderMerchant"], consignees: ["builderMerchant", "constructionSite"] },
  "Industrial & energy": { shippers: ["manufacturer", "distributor"], consignees: ["manufacturer", "distributor", "constructionSite"] },
  "Chemicals & regulated": { shippers: ["manufacturer", "distributor"], consignees: ["manufacturer", "distributor"] },
  "Vehicles & livestock": { shippers: ["manufacturer"], consignees: ["dealer"] },
};

export const ROLE_OVERRIDES = {
  livestock: { shippers: ["farm"], consignees: ["processor", "farm"] },
  wastePaper: { shippers: ["collectionPoint"], consignees: ["recycler"] },
  scrapMetal: { shippers: ["collectionPoint"], consignees: ["recycler"] },
  hazardousWaste: { shippers: ["manufacturer"], consignees: ["wasteTreatment"] },
  gravel: { shippers: ["quarry"], consignees: ["constructionSite", "builderMerchant"] },
  sand: { shippers: ["quarry"], consignees: ["constructionSite", "builderMerchant"] },
  logs: { shippers: ["forestry"], consignees: ["sawmill"] },
  fuel: { shippers: ["fuelDepot"], consignees: ["fuelStation", "fuelDepot"] },
};

export const ALL_ROLES = [...new Set([
  ...Object.values(ROLES_BY_FAMILY), ...Object.values(ROLE_OVERRIDES),
].flatMap(r => [...r.shippers, ...r.consignees]))];
