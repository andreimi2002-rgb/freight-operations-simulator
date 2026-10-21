// How each cargo is packed for the load calculation (phase 1B).
// - Palletised cargo: EUR pallets with an ESTIMATED mass per pallet (a range; the engine uses
//   its midpoint). The basis id names the reasoning shown to the user (translated in the UI).
//   Every range stays below the EUR pallet's 1,500 kg safe working load.
// - Everything else: no unit yet; the reason id explains why, and the phase that will add it.
// These are FOS estimates, not shipment data. Phase 3 (cargo v2) replaces them with sourced packaging.

const BASES = {
  produce: [500, 900],        // vented cartons or crates of fruit/vegetables stacked on a pallet
  produceHeavy: [700, 1000],  // dense produce in cartons or bags (bananas, melons, potatoes, onions)
  produceLight: [250, 500],   // light produce in punnets or trays (berries, cherries, leafy greens, mushrooms)
  chilledFrozen: [500, 900],  // packaged chilled or frozen food in cartons
  eggs: [300, 500],           // eggs in trays and cartons
  liquidsPacked: [700, 1000], // bottles, cans, drums or small containers of liquid
  bagged: [900, 1200],        // 25-50 kg sacks of dry goods stacked on a pallet
  baggedHeavy: [1000, 1400],  // cement bags, bricks and masonry units
  cartonsLight: [150, 400],   // light, bulky goods in cartons (volume fills before mass)
  veryLight: [50, 200],       // insulation packs and similar very light goods
  cartonsMedium: [300, 700],  // parts and electrical goods in cartons or crates
  dense: [500, 900],          // paper products, panels in crates
};

const pallet = basis => ({ unitType: "eurPallet", basis, unitMassKg: { min: BASES[basis][0], max: BASES[basis][1] } });
const none = (reason, phase = "3") => ({ unitType: null, reason, phase });

export const PACKAGING_PROFILES = {
  wheat: pallet("bagged"), maize: pallet("bagged"), barley: pallet("bagged"), animalFeed: pallet("bagged"), fertilizer: pallet("bagged"),
  potatoes: pallet("produceHeavy"), freshProduce: pallet("produce"), apples: pallet("produce"), citrusFruit: pallet("produce"),
  tableGrapes: pallet("produce"), strawberries: pallet("produceLight"), blueberries: pallet("produceLight"), cherries: pallet("produceLight"),
  pears: pallet("produce"), stoneFruit: pallet("produce"), avocados: pallet("produce"), bananas: pallet("produceHeavy"),
  melons: pallet("produceHeavy"), tomatoes: pallet("produce"), leafyGreens: pallet("produceLight"), broccoliCauliflower: pallet("produce"),
  onions: pallet("produceHeavy"), potatoesFresh: pallet("produceHeavy"), cornSweet: pallet("produce"), mushrooms: pallet("produceLight"),
  frozenBerries: pallet("chilledFrozen"), cheese: pallet("chilledFrozen"), poultry: pallet("chilledFrozen"), seafood: pallet("chilledFrozen"),
  frozenFood: pallet("chilledFrozen"), chilledMeat: pallet("chilledFrozen"), dairy: pallet("chilledFrozen"), eggs: pallet("eggs"),
  beverages: pallet("liquidsPacked"), edibleOil: pallet("liquidsPacked"), coffee: pallet("bagged"), cocoa: pallet("bagged"),
  rice: pallet("bagged"), flour: pallet("bagged"), sugar: pallet("bagged"),
  textiles: pallet("cartonsLight"), cementBags: pallet("baggedHeavy"), bricks: pallet("baggedHeavy"), insulation: pallet("veryLight"),
  industrialParts: pallet("cartonsMedium"), electronics: pallet("cartonsMedium"), solarPanels: pallet("dense"),
  furniture: pallet("cartonsLight"), appliances: pallet("cartonsLight"), clothing: pallet("cartonsLight"), paperProducts: pallet("dense"),
  autoParts: pallet("cartonsMedium"), parcels: pallet("cartonsLight"), packaging: pallet("cartonsLight"),

  // Not on EUR pallets, or not without data we do not have yet.
  containerizedFreight: none("container", "4"),
  cementBulk: none("bulk"), gravel: none("bulk"), sand: none("bulk"), fuel: none("bulk"), wastePaper: none("bulk"), scrapMetal: none("bulk"),
  lumber: none("specialUnit"), logs: none("specialUnit"), steelCoils: none("specialUnit"), steelSections: none("specialUnit"), glass: none("specialUnit"),
  machinery: none("specialUnit"), constructionPlant: none("specialUnit"), transformer: none("specialUnit"), windComponents: none("specialUnit"),
  tyres: none("specialUnit"), cars: none("specialUnit", "4"), commercialVehicles: none("specialUnit", "4"), livestock: none("specialUnit", "4"),
  industrialChemicals: none("dangerousGoods"), paintCoatings: none("dangerousGoods"), compressedGas: none("dangerousGoods"),
  hazardousWaste: none("dangerousGoods"), batteries: none("dangerousGoods"),
};
