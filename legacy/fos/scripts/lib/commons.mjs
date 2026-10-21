// Pure helpers for scripts/build-city-photos.mjs (and the tests): which Wikidata item belongs to a
// GeoNames city, which photo to use, and whether a Wikimedia Commons file may be shown
// (licence, author, type, size). Adapted from Airport Live (scripts/lib/photo-data.mjs).

// "http://commons.wikimedia.org/wiki/Special:FilePath/Bucharest%20skyline.jpg" -> "Bucharest skyline.jpg"
export function fileNameFromFilePath(url) {
  const m = String(url || "").match(/Special:FilePath\/(.+)$/);
  return m ? decodeURIComponent(m[1]).replace(/_/g, " ") : null;
}
export const qid = url => String(url || "").split("/").pop() || null;

// Preferred-rank photos first, then normal ones (deprecated are left out by the query).
export const rankOrder = rank => (/PreferredRank$/.test(String(rank || "")) ? 0 : 1);

// SPARQL rows { item, geo, img, rank, banner, links } -> Map(geonamesId -> Map(qid -> { images: Map(file -> rank), banner, links }))
export function groupByGeonames(rows) {
  const byGeo = new Map();
  for (const row of rows) {
    const geo = String(row.geo || "").trim();
    const id = qid(row.item);
    if (!geo || !id) continue;
    if (!byGeo.has(geo)) byGeo.set(geo, new Map());
    const items = byGeo.get(geo);
    if (!items.has(id)) items.set(id, { qid: id, images: new Map(), banner: null, links: 0, articles: new Map() });
    const item = items.get(id);
    const file = fileNameFromFilePath(row.img);
    if (file) {
      const r = rankOrder(row.rank);
      if (!item.images.has(file) || r < item.images.get(file)) item.images.set(file, r);
    }
    item.banner ??= fileNameFromFilePath(row.banner);
    if (row.wpLang && row.wpTitle) item.articles.set(`${row.wpLang}|${row.wpTitle}`, { lang: row.wpLang, title: row.wpTitle });
    const links = Number(row.links);
    if (Number.isFinite(links) && links > item.links) item.links = links;
  }
  return byGeo;
}

// An item with at least this many times more Wikipedia sitelinks than the next is "the" city
// (e.g. the Romanian municipality item next to its "component locality" item and an empty stub).
export const DOMINANT_ITEM_FACTOR = 3;

// The one Wikidata item for a GeoNames ID, or a reason. Several items: only a clearly dominant one
// (by sitelinks) is used; otherwise the city is skipped (no guessing).
export function matchCity(geonamesId, byGeo) {
  let items = [...(byGeo.get(String(geonamesId))?.values() ?? [])];
  if (!items.length) return { skip: "no Wikidata item" };
  if (items.length > 1) {
    const sorted = [...items].sort((a, b) => b.links - a.links);
    if (sorted[0].links >= 1 && sorted[0].links >= DOMINANT_ITEM_FACTOR * sorted[1].links) items = [sorted[0]];
    else return { skip: `ambiguous (${items.map(i => `${i.qid}:${i.links}`).join(", ")})` };
  }
  const item = items[0];
  const photos = [...item.images].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([file]) => ({ file, from: "P18" }));
  if (item.banner && !photos.some(p => p.file === item.banner)) photos.push({ file: item.banner, from: "P948" });
  return { qid: item.qid, candidates: photos, articles: [...item.articles.values()] };
}

// File names that are maps, coats of arms, flags, logos or collages, not photos of the place.
const NOT_A_PHOTO = /(\bmap\b|\bharta\b|hartă|térkép|\bkarta\b|locator|location map|\bpoloha\b|\bflag\b|\bsteag|zászló|coat of arms|\bstema\b|címer|\bherb\b|\blogo\b|collage|colaj|kolaż|montage|montaj|\bseal\b|\bsigiliu\b|\bblazon)/i;
export const looksLikeAPhoto = file => !NOT_A_PHOTO.test(String(file || ""));

// Only free licences that allow showing the photo with credit (same rule as Airport Live):
// public domain, CC0, CC BY, CC BY-SA, Commons {{Attribution}}, Free Art License (FAL / LAL).
const LICENCE_OK = /^(public domain|pd(-[\w.-]+)?|cc0( 1\.0)?|cc[ -]by(-sa)?( \d\.\d)?( [a-z]{2,3})?|attribution|fal( \d\.\d)?|free art licen[cs]e( \d\.\d)?|lal( \d\.\d)?)$/i;
export function acceptLicence(name) {
  const n = String(name || "").trim();
  if (!n || /\b(nc|nd)\b/i.test(n)) return false;
  return LICENCE_OK.test(n);
}
export const isPublicDomain = name => /^(public domain|pd\b|pd-|cc0)/i.test(String(name || "").trim());

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };
// Author HTML from Commons -> short plain text.
export function cleanAuthor(html) {
  let text = String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e) => ENTITIES[e.toLowerCase()] ?? (e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : m))
    .replace(/\(\s*talk\s*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  text = text.replace(/^Original uploader was\s+/i, "").replace(/\s+at\s+\S*wikipedia\b.*$/i, "").replace(/^User:\s*/i, "").trim();
  if (text.length > 90) text = text.slice(0, 87).trimEnd() + "…";
  return text;
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
// 500 px: the card shows the photo at about 600 px under a dark shade; smaller files look blurry.
export const MIN_WIDTH = 500;

// Commons imageinfo (with extmetadata) -> photo record, or the reason it cannot be used.
export function toPhoto(info, { file, from, verified }) {
  if (!info) return { reject: "missing on Commons" };
  if (!looksLikeAPhoto(file)) return { reject: "not a photo (name)" };
  if (!IMAGE_TYPES.has(info.mime)) return { reject: `type ${info.mime}` };
  if (!(info.width >= MIN_WIDTH)) return { reject: "too small" };
  const meta = Object.fromEntries(Object.entries(info.extmetadata || {}).map(([k, v]) => [k, v?.value]));
  const licence = String(meta.LicenseShortName || "").trim();
  if (!acceptLicence(licence)) return { reject: `licence ${licence || "unknown"}` };
  const author = cleanAuthor(meta.Artist);
  if (!author && !isPublicDomain(licence)) return { reject: "no author" };
  // Commons serves thumbnails from thumb.wikimedia.org (originals from upload.wikimedia.org); tracking parameters are dropped.
  const src = String(info.thumburl || info.url || "").replace(/\?.*$/, "");
  if (!/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(src)) return { reject: "unexpected url" };
  if (!/^https:\/\/commons\.wikimedia\.org\//.test(String(info.descriptionurl || ""))) return { reject: "no Commons page" };
  return {
    photo: {
      src,
      page: info.descriptionurl,
      file,
      author: author || null,
      licence,
      licenceUrl: meta.LicenseUrl || null,
      from,
      width: info.thumbwidth || info.width,
      height: info.thumbheight || info.height,
      verified,
    },
  };
}
