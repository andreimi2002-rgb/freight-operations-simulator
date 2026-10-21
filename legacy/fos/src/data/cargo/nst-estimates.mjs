// ESTIMATE, not a classification. FOS proposes which NST 2007 chapters (divisions) a cargo
// family may fall under. Replaced in phase 3 by the official CN -> NST correspondence (Eurostat).
// Chapter list (01-20): Commission Regulation (EC) No 1304/2007, as reproduced at
// https://www.cbs.nl/en-gb/our-services/methods/definitions/commodity-nomenclature-nst-2007
//  01 agriculture, hunting, forestry, fish      04 food products, beverages, tobacco
//  03 metal ores, quarrying products            05 textiles, leather
//  06 wood, paper, printed matter               07 coke and refined petroleum
//  08 chemicals, rubber, plastics               09 other non-metallic mineral products
//  10 basic and fabricated metals               11 machinery, electrical and precision equipment
//  12 transport equipment                       13 furniture, other manufactured goods
//  14 secondary raw materials, wastes           15 mail, parcels
//  18 grouped goods
export const NST_ESTIMATES = {
  "Agriculture & food": ["01", "04"],
  "Building & materials": ["03", "06", "09", "10"],
  "Industrial & energy": ["10", "11", "14"],
  "Chemicals & regulated": ["07", "08", "14"],
  "Retail & consumer goods": ["05", "06", "11", "13", "15", "18"],
  "Vehicles & livestock": ["01", "12"],
};
