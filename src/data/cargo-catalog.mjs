/**
 * Curated examples of real-world commodity types for generated scenarios.
 * Compatibility and handling notes are planning heuristics, not booking data.
 */
export const CARGO_SOURCES = {
  nst: { name: "UNECE NST 2007 goods classification", url: "https://unece.org/transport/statistics-transport/classification-nst-2007" },
  atp: { name: "UNECE ATP perishable-food transport agreement", url: "https://unece.org/atp-handbook" },
  adr: { name: "UNECE dangerous-goods road transport", url: "https://unece.org/transport/dangerous-goods" },
  euAnimals: { name: "EU animal-transport rules (Regulation EC 1/2005)", url: "https://eur-lex.europa.eu/eli/reg/2005/1/oj/eng" },
};

const item = (id, name, family, loadForm, equipmentIds, handling, extra = {}) => ({
  id, name, family, loadForm, equipmentIds, handling,
  description: `${name}; actual packaging, quantity, and shipment requirements depend on the specific product and shipper.`,
  dataStatus: "curated-commodity-example",
  pairingStatus: "planning-heuristic",
  sourceIds: ["nst", ...(extra.sourceIds || [])],
  ...extra,
});

const records = [
  // Agriculture and food
  item("wheat", "Wheat grain", "Agriculture & food", "Loose bulk or bagged", ["grainHopper", "walkingFloor", "dryVan"], ["Keep dry", "Control dust during handling"]),
  item("maize", "Maize / corn", "Agriculture & food", "Loose bulk or bagged", ["grainHopper", "walkingFloor", "dryVan"], ["Keep dry", "Control dust during handling"]),
  item("barley", "Barley grain", "Agriculture & food", "Loose bulk or bagged", ["grainHopper", "walkingFloor", "dryVan"], ["Keep dry"]),
  item("animalFeed", "Compound animal feed", "Agriculture & food", "Bulk or palletized bags", ["grainHopper", "walkingFloor", "dryVan"], ["Keep dry", "Protect from contamination"]),
  item("fertilizer", "Fertilizer", "Agriculture & food", "Bulk, bags, or big bags", ["grainHopper", "walkingFloor", "curtainsider"], ["Keep dry", "Check product-specific hazard information"], { sourceIds: ["adr"], regulatoryReview: "Product-dependent; verify the product safety data and applicable rules." }),
  item("potatoes", "Potatoes", "Agriculture & food", "Ventilated bins or bulk", ["curtainsider", "reefer", "walkingFloor"], ["Ventilation may be needed", "Avoid temperature extremes"]),
  item("freshProduce", "Fresh fruit and vegetables", "Agriculture & food", "Crates, cartons, or palletized", ["reefer", "curtainsider"], ["Temperature and ventilation depend on produce", "Protect from crushing"], { sourceIds: ["atp"], temperature: "product-specific" }),
  item("frozenFood", "Frozen food products", "Agriculture & food", "Cartons or palletized", ["reefer"], ["Maintain the product's required frozen condition", "Minimize door-open time"], { sourceIds: ["atp"], temperature: "product-specific" }),
  item("chilledMeat", "Chilled meat products", "Agriculture & food", "Hygienic crates, cartons, or hanging", ["reefer"], ["Temperature control", "Hygiene and separation requirements"], { sourceIds: ["atp"], temperature: "product-specific" }),
  item("dairy", "Dairy products", "Agriculture & food", "Palletized cartons or food-grade liquid", ["reefer", "foodTanker"], ["Temperature depends on product", "Food-grade cleanliness"], { sourceIds: ["atp"], temperature: "product-specific" }),
  item("eggs", "Eggs", "Agriculture & food", "Protective trays and cartons", ["dryVan", "reefer"], ["Protect from shock and crushing", "Temperature needs depend on product and market"]),
  item("beverages", "Packaged beverages", "Agriculture & food", "Palletized bottles, cans, or cartons", ["dryVan", "curtainsider"], ["Secure against movement", "Protect glass from impact"]),
  item("edibleOil", "Edible oils", "Agriculture & food", "Sealed drums, IBCs, or bulk liquid", ["dryVan", "foodTanker"], ["Food-grade cleanliness for bulk equipment", "Prevent leaks"]),
  item("coffee", "Coffee beans", "Agriculture & food", "Sacks or palletized bags", ["dryVan", "containerChassis"], ["Keep dry", "Protect from odors"]),
  // Building materials and metals
  item("cementBags", "Bagged cement", "Building & materials", "Palletized bags or big bags", ["dryVan", "curtainsider"], ["Keep dry", "Secure pallets"]),
  item("cementBulk", "Bulk cement", "Building & materials", "Pneumatic dry bulk", ["bulkTanker"], ["Keep dry", "Requires compatible pneumatic unloading"]),
  item("bricks", "Bricks and masonry units", "Building & materials", "Strapped or wrapped pallets", ["curtainsider", "flatbed", "dryVan"], ["Secure heavy pallets", "Protect edges where needed"]),
  item("lumber", "Sawn timber and lumber", "Building & materials", "Strapped bundles", ["flatbed", "curtainsider", "logTrailer"], ["Secure against shifting", "Protect from weather when required"]),
  item("logs", "Roundwood logs", "Building & materials", "Loose log loads", ["logTrailer"], ["Specialized load restraint", "Check route and load dimensions"]),
  item("steelCoils", "Steel coils", "Building & materials", "Coils with cradle or coil well", ["flatbed", "curtainsider"], ["Coil-specific restraint and blocking", "Concentrated load planning"]),
  item("steelSections", "Steel beams and sections", "Building & materials", "Long bundled sections", ["flatbed", "curtainsider"], ["Long-load restraint", "Check overhang and route constraints"]),
  item("glass", "Flat glass and glazing units", "Building & materials", "A-frame racks or purpose-built stillages", ["flatbed", "curtainsider"], ["Fragile; keep rack upright and restrained"]),
  item("insulation", "Insulation materials", "Building & materials", "Wrapped palletized packs", ["curtainsider", "dryVan"], ["Protect wrapping from tears and moisture"]),
  item("gravel", "Gravel and crushed stone", "Building & materials", "Loose tipper load", ["tipper", "walkingFloor"], ["Secure/protect loose material as required", "Dust and spill controls"]),
  item("sand", "Construction sand", "Building & materials", "Loose bulk", ["tipper", "walkingFloor"], ["Dust and spill controls", "Check moisture and unloading method"]),
  // Industrial and energy
  item("machinery", "Industrial machinery", "Industrial & energy", "Crated, skidded, or bare equipment", ["flatbed", "lowboy", "dryVan"], ["Verify dimensions, center of gravity, and lifting points", "Secure to manufacturer instructions"]),
  item("constructionPlant", "Construction plant and equipment", "Industrial & energy", "Self-propelled or secured machinery", ["lowboy", "flatbed"], ["Verify loaded dimensions and mass", "Check loading access and securement"]),
  item("transformer", "Electrical transformers", "Industrial & energy", "Crated or specialized heavy unit", ["lowboy", "flatbed"], ["Verify dimensions, mass, and center of gravity", "Special handling may apply"]),
  item("windComponents", "Wind-turbine components", "Industrial & energy", "Long or oversize component", ["lowboy", "flatbed"], ["Route survey and permits may be required", "Dimensions are item-specific"]),
  item("industrialParts", "Industrial parts and components", "Industrial & energy", "Crates, stillages, or pallets", ["dryVan", "curtainsider"], ["Secure against movement", "Protect precision surfaces where needed"]),
  item("electronics", "Electronics and electrical goods", "Industrial & energy", "Cartons, crates, or palletized", ["dryVan", "containerChassis"], ["Protect from shock and moisture", "Cargo security may be required"]),
  item("batteries", "Batteries", "Industrial & energy", "Secured packages or dedicated racks", ["dryVan", "curtainsider"], ["Product chemistry and condition determine requirements", "Check dangerous-goods status before booking"], { sourceIds: ["adr"], regulatoryReview: "Product-dependent; do not assume exemption or ADR classification." }),
  item("solarPanels", "Solar panels", "Industrial & energy", "Manufacturer crates or racks", ["dryVan", "curtainsider", "flatbed"], ["Fragile; protect from bending and impact"]),
  item("wastePaper", "Recovered paper and cardboard", "Industrial & energy", "Baled or loose, covered", ["walkingFloor", "curtainsider", "dryVan"], ["Keep dry", "Secure or cover loose/baled load"]),
  item("scrapMetal", "Scrap metal", "Industrial & energy", "Bulk or secured skips", ["walkingFloor", "tipper", "flatbed"], ["Prevent loss of loose pieces", "Check contamination and site rules"]),
  // Chemicals and regulated goods
  item("industrialChemicals", "Industrial chemicals", "Chemicals & regulated", "Packaged drums/IBCs or bulk liquid", ["dryVan", "chemicalTanker"], ["Follow product safety data and segregation rules", "Verify packaging and vehicle requirements"], { sourceIds: ["adr"], regulatoryReview: "Classification is product-, concentration-, and package-specific; ADR check required." }),
  item("paintCoatings", "Paints, coatings, and adhesives", "Chemicals & regulated", "Sealed pails, drums, or IBCs", ["dryVan", "curtainsider"], ["Prevent leaks and protect from temperature extremes", "Verify product safety data"], { sourceIds: ["adr"], regulatoryReview: "Some products may be regulated; verify the exact product and packaging." }),
  item("fuel", "Liquid fuels", "Chemicals & regulated", "Bulk liquid", ["fuelTanker"], ["Dedicated compatible tank compartments", "Dangerous-goods and operating rules apply"], { sourceIds: ["adr"], regulatoryReview: "Exact product determines applicable ADR classification and carriage rules." }),
  item("compressedGas", "Compressed gas cylinders", "Chemicals & regulated", "Secured cylinders or cylinder packs", ["curtainsider", "dryVan"], ["Secure against movement and valve damage", "Ventilation and segregation may be required"], { sourceIds: ["adr"], regulatoryReview: "Product and quantity determine applicable ADR requirements." }),
  item("hazardousWaste", "Regulated hazardous waste", "Chemicals & regulated", "Approved, labeled packages or tank", ["dryVan", "chemicalTanker"], ["Waste code and product assessment required", "Use only compatible approved equipment"], { sourceIds: ["adr"], regulatoryReview: "Requires waste classification and exact ADR assessment; this generator does not determine either." }),
  // Retail and consumer goods
  item("furniture", "Furniture and home furnishings", "Retail & consumer goods", "Cartons, wrapped items, or palletized", ["dryVan", "curtainsider"], ["Protect corners and surfaces", "Secure mixed-size pieces"]),
  item("appliances", "Household appliances", "Retail & consumer goods", "Upright cartons or palletized", ["dryVan", "curtainsider"], ["Follow orientation marks", "Protect from impact and moisture"]),
  item("clothing", "Clothing and textiles", "Retail & consumer goods", "Cartons, hanging garments, or bales", ["dryVan", "containerChassis"], ["Keep clean and dry", "Prevent odor transfer"]),
  item("paperProducts", "Paper and printed products", "Retail & consumer goods", "Pallets, reels, or cartons", ["dryVan", "curtainsider"], ["Keep dry", "Reels need suitable restraint"]),
  item("tyres", "Tyres", "Retail & consumer goods", "Loose, racked, or palletized", ["dryVan", "curtainsider"], ["Secure against movement", "Protect from contamination"]),
  item("autoParts", "Automotive parts", "Retail & consumer goods", "Returnable stillages, crates, or pallets", ["dryVan", "curtainsider"], ["Secure mixed packaging", "Check for separately regulated components"]),
  item("parcels", "Mixed parcels and e-commerce freight", "Retail & consumer goods", "Palletized cages or roll containers", ["dryVan", "curtainsider"], ["Mixed contents; carrier restrictions apply", "Secure cages and protect labels"]),
  item("packaging", "Packaging materials", "Retail & consumer goods", "Palletized or lightweight bulk", ["dryVan", "curtainsider", "walkingFloor"], ["Protect from moisture", "Volume may be more limiting than mass"]),
  // Vehicles and livestock
  item("cars", "Passenger cars", "Vehicles & livestock", "Driven or winched onto vehicle deck", ["carTransporter"], ["Vehicle restraints and deck layout required", "Check vehicle dimensions and ground clearance"]),
  item("commercialVehicles", "Commercial vehicles and vans", "Vehicles & livestock", "Driven or winched onto vehicle deck", ["carTransporter", "lowboy"], ["Verify loaded height and mass", "Secure each vehicle independently"]),
  item("livestock", "Live animals", "Vehicles & livestock", "Purpose-built livestock compartments", ["livestockTrailer"], ["Animal welfare, ventilation, water, and journey rules apply", "Species and journey specifics must be verified"], { sourceIds: ["euAnimals"], regulatoryReview: "Applicable live-animal transport rules depend on species, journey, and jurisdiction." }),
];

export const CARGO = Object.fromEntries(records.map(record => [record.id, Object.freeze(record)]));
export const CARGO_FAMILIES = [...new Set(records.map(record => record.family))];

