// Decides whether an OSM name of a loading place may be shown (pure; tested).
// Rule (AGENTS.md): no private company names on locations. A name is kept only when it is a public
// place term ("Zonă industrială", "Port", "Ipari Park"…) plus words that cannot name a company:
// city names, compass words, numerals, short connecting words. Anything else -> null (the place is shown generically).
export const fold = text => String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// Legal forms and similar markers of a company, in several languages (compared on folded text).
const COMPANY_MARKERS = /(^| )(sa|srl|s r l|s a|sc|snc|scs|kft|zrt|rt|bt|nyrt|kkt|oood|ood|ad|eood|ead|ет|еоод|оод|ад|gmbh|ag|ltd|llc|inc|co|corp|plc|spa|sas|bv|nv|ooo|zao|holding|group|grup|grupul|company|companie|societatea|firma|fabrica)( |$)|[&@]/u;

export function createNameFilter({ terms, fillers = [], directions = [], cityNames = [] }) {
  const termList = terms.map(fold).filter(Boolean).map(t => t.split(" "));
  const allowed = new Set([...fillers, ...directions].map(fold));
  const cityTokens = [...new Set(cityNames.flatMap(n => fold(n).split(" ")).filter(t => t.length >= 4))];
  const isAllowedToken = token => allowed.has(token) || /^\d{1,3}$/.test(token) || /^[ivx]{1,4}$/.test(token) || token.length === 1
    || cityTokens.some(city => token === city || (token.length > city.length && token.startsWith(city) && token.length - city.length <= 3)); // Szeged -> Szegedi

  // -> the display name, or null when it must not be shown
  return function publicName(rawName, tags = {}) {
    const name = String(rawName || "").replace(/\s+/g, " ").trim();
    if (!name) return null;
    const folded = fold(name);
    if (!folded || COMPANY_MARKERS.test(folded) || /[&@]/.test(name)) return null;
    for (const key of ["operator", "brand", "owner", "name:brand"]) {
      const other = fold(tags[key]);
      if (other && (folded.includes(other) || other.includes(folded))) return null;
    }
    const tokens = folded.split(" ");
    const at = termList.findIndex(term => tokens.some((_, i) => term.every((word, k) => tokens[i + k] === word)));
    if (at < 0) return null;
    const term = termList[at];
    const start = tokens.findIndex((_, i) => term.every((word, k) => tokens[i + k] === word));
    const rest = [...tokens.slice(0, start), ...tokens.slice(start + term.length)];
    return rest.every(isAllowedToken) ? name : null;
  };
}
