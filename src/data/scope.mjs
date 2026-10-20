// Display helpers for cities: three-letter codes and Romanian names.
// The catalog (src/data/places/cities-ro-hu-bg.json) already contains only RO/HU/BG places without
// city sections; works with a catalog city ({ id }) or a Load place ({ geonamesId }).
import { has, t } from "../i18n/i18n.mjs";

const idOf = place => Number(place.geonamesId ?? place.id);

// Three-letter codes for the biggest cities; the rest use their first three letters.
// Temporary until UN/LOCODE arrives in phase 2.
const CODES = {
  683506: "BUC", 680963: "CND", 681290: "CLJ", 665087: "TIM", 675810: "IAS", 683844: "BRV",
  3054643: "BUD", 721472: "DEB", 715429: "SZE", 717582: "MSK", 3046526: "PEC",
  727011: "SOF", 728193: "PLD", 726050: "VAR", 732770: "BGS",
};
const stripAccents = text => text.normalize("NFD").replace(/[̀-ͯ]/g, "");
export function cityCode(place) {
  return CODES[idOf(place)] || stripAccents(String(place.name || "")).replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "???";
}

// GeoNames uses cedilla forms (ş, ţ); modern Romanian uses comma-below (ș, ț).
const commaBelow = text => text.replace(/ş/g, "ș").replace(/ţ/g, "ț").replace(/Ş/g, "Ș").replace(/Ţ/g, "Ț");
export function cityName(place) {
  const key = `place.${idOf(place)}`;
  return has(key) ? t(key) : commaBelow(String(place.name || ""));
}
