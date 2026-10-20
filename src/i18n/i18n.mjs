// Translation lookup and locale-aware formatting. Components never contain
// literal text: they look every string up by key. To add a language, add <lang>.json next
// to ro.json (with "_locale" and "_language") and load it with loadLanguage().

let dictionary = {};
let localeTag = "ro-RO";

export function setDictionary(next) {
  dictionary = next || {};
  localeTag = dictionary._locale || "ro-RO";
  if (typeof document !== "undefined" && dictionary._language) document.documentElement.lang = dictionary._language;
}

export async function loadLanguage(language = "ro") {
  const response = await fetch(new URL(`./${language}.json`, import.meta.url));
  if (!response.ok) throw new Error(`Translation file ${language}.json could not be loaded.`);
  setDictionary(await response.json());
}

export const locale = () => localeTag;
export const has = key => Object.prototype.hasOwnProperty.call(dictionary, key);

// A missing key is shown as ⟦key⟧ so it is noticed immediately; tOr() falls back to given text.
export function t(key, params) {
  const text = has(key) ? dictionary[key] : `⟦${key}⟧`;
  return params ? text.replace(/\{(\w+)\}/g, (match, name) => (params[name] ?? match)) : text;
}
export const tOr = (key, fallback) => (has(key) ? dictionary[key] : fallback);

export function formatNumber(value, options = {}) {
  return new Intl.NumberFormat(localeTag, { maximumFractionDigits: 1, ...options }).format(value);
}
export const formatKm = km => t("fmt.km", { value: formatNumber(km, { maximumFractionDigits: km >= 100 ? 0 : 1 }) });
export const formatTonnes = tonnes => t("fmt.t", { value: formatNumber(tonnes) });
export function formatDuration(seconds) {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? t("fmt.hm", { h, m }) : t("fmt.min", { m });
}
export function formatDate(value, { time = false, weekday = true } = {}) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return t("ui.noValue");
  const options = { day: "numeric", month: "long", year: "numeric", ...(weekday ? { weekday: "long" } : {}) };
  if (time) Object.assign(options, { hour: "2-digit", minute: "2-digit" });
  return new Intl.DateTimeFormat(localeTag, options).format(date);
}
export function formatTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return t("ui.noValue");
  return new Intl.DateTimeFormat(localeTag, { hour: "2-digit", minute: "2-digit" }).format(date);
}
export function countryName(code) {
  try { return new Intl.DisplayNames([localeTag], { type: "region" }).of(String(code).toUpperCase()) || code; } catch { return String(code); }
}
