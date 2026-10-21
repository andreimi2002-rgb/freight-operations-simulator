// Pure helpers for the city photo scripts: whether a Wikimedia Commons file may be shown
// (licence, author, type, size). Adapted from FOS (scripts/lib/commons.mjs on main / tag fos-final).

// "http://commons.wikimedia.org/wiki/Special:FilePath/Bucharest%20skyline.jpg" -> "Bucharest skyline.jpg"
export function fileNameFromFilePath(url) {
  const m = String(url || "").match(/Special:FilePath\/(.+)$/);
  return m ? decodeURIComponent(m[1]).replace(/_/g, " ") : null;
}
export const qid = url => String(url || "").split("/").pop() || null;

// Preferred-rank photos first, then normal ones.
export const rankOrder = rank => (/preferred/i.test(String(rank || "")) ? 0 : 1);

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
export function toPhoto(info, { file, from, verified, minWidth = MIN_WIDTH }) {
  if (!info) return { reject: "missing on Commons" };
  if (!looksLikeAPhoto(file)) return { reject: "not a photo (name)" };
  if (!IMAGE_TYPES.has(info.mime)) return { reject: `type ${info.mime}` };
  if (!(info.width >= minWidth)) return { reject: "too small" };
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

// URL of a Commons thumbnail at `width` px, from either a thumbnail URL
// (".../thumb/a/ab/File.jpg/1600px-File.jpg") or an original
// (".../commons/a/ab/File.jpg").
export function thumbUrl(src, width) {
  const s = String(src || "");
  if (/\/thumb\//.test(s)) return s.replace(/\/(\d+)px-([^/]+)$/, `/${width}px-$2`);
  const m = s.match(/^(https:\/\/(?:upload|thumb)\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/);
  return m ? `${m[1]}/thumb/${m[2]}/${m[3]}/${m[4]}/${width}px-${m[4]}` : null;
}
