// Phase 1A scope: Romania, Hungary, Bulgaria. The GeoNames catalog still contains
// the old ATS/ETS2 pools; this module filters it in the UI (phase 1B regenerates it).
import { has, t } from "../i18n/i18n.mjs";

export const SCOPE_COUNTRIES = ["RO", "HU", "BG"];

// The catalog lists city districts as separate "cities" (Bucharest sectors, Budapest
// districts). A load from "Sector 3" to "Budapest XIII. kerület" would be nonsense, so they are excluded.
const DISTRICT_IDS = new Set([
  3046446, 3054667, 3042430, 3043470, 3049646, 11054704, 3055970, 3053176, 3049795, 3052655, // Pest, Buda, Zugló, Újpest, Kőbánya, Józsefváros, Angyalföld, Erzsébetváros, Kispest, Ferencváros
  733606, // Asparuhovo (district of Varna)
]);
const isDistrict = city => DISTRICT_IDS.has(Number(city.id)) || /^Sector \d/.test(city.name) || /kerület$/.test(city.name);

export function scopeCities(catalog) {
  const cities = (catalog?.cities || []).filter(city =>
    SCOPE_COUNTRIES.includes(city.countryCode) && city.worlds?.includes("ETS2") && !isDistrict(city));
  return { metadata: catalog?.metadata, cities };
}

export const inScope = place => SCOPE_COUNTRIES.includes(place?.countryCode) && !isDistrict(place);

// Three-letter codes for the biggest cities; the rest use their first three letters.
// Temporary until UN/LOCODE arrives in phase 2.
const CODES = {
  683506: "BUC", 680963: "CND", 681290: "CLJ", 665087: "TIM", 675810: "IAS", 683844: "BRV",
  3054643: "BUD", 721472: "DEB", 715429: "SZE", 717582: "MSK", 3046526: "PEC",
  727011: "SOF", 728193: "PLD", 726050: "VAR", 732770: "BGS",
};
const stripAccents = text => text.normalize("NFD").replace(/[̀-ͯ]/g, "");
export function cityCode(place) {
  if (CODES[Number(place.id)]) return CODES[Number(place.id)];
  return stripAccents(String(place.name || "")).replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "???";
}

// GeoNames uses cedilla forms (ş, ţ); modern Romanian uses comma-below (ș, ț).
const commaBelow = text => text.replace(/ş/g, "ș").replace(/ţ/g, "ț").replace(/Ş/g, "Ș").replace(/Ţ/g, "Ț");
export function cityName(place) {
  const key = `place.${place.id}`;
  return has(key) ? t(key) : commaBelow(String(place.name || ""));
}
