// Display helpers for cities: three-letter codes and Romanian names.
// The city catalogs (src/data/places/cities-<CC>.json) contain only places without city sections; works with a catalog city ({ id }) or a Load place ({ geonamesId }).
import { has, t } from "../i18n/i18n.mjs";

const idOf = place => Number(place.geonamesId ?? place.id);

// Provisional three-letter codes, used only for cities without a UN/LOCODE (src/data/places/locodes.json).
const CODES = {
  683506: "BUC", 680963: "CND", 681290: "CLJ", 665087: "TIM", 675810: "IAS", 683844: "BRV",
  3054643: "BUD", 721472: "DEB", 715429: "SZE", 717582: "MSK", 3046526: "PEC",
  727011: "SOF", 728193: "PLD", 726050: "VAR", 732770: "BGS",
};
const stripAccents = text => text.normalize("NFD").replace(/[̀-ͯ]/g, "");
// UN/LOCODE (e.g. "ROARW"): the 3-letter location part is the short code; the full code is used when
// two places of one route would otherwise share the same short code.
export const locodeShort = place => (place.locode ? String(place.locode).slice(2) : null);
export function cityCode(place, { full = false } = {}) {
  if (place.locode) return full ? place.locode : locodeShort(place);
  return CODES[idOf(place)] || stripAccents(String(place.name || "")).replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "???";
}

// GeoNames uses cedilla forms (ş, ţ); modern Romanian uses comma-below (ș, ț).
const commaBelow = text => text.replace(/ş/g, "ș").replace(/ţ/g, "ț").replace(/Ş/g, "Ș").replace(/Ţ/g, "Ț");
export function cityName(place) {
  const key = `place.${idOf(place)}`;
  return has(key) ? t(key) : commaBelow(String(place.name || ""));
}
