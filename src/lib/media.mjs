// Pure helpers for the illustrative media of trucks, trailers and cargo (phase B6):
// our own category icons, and the real-world photos chosen by hand in data/catalog-photos.json.

/** Category id of a trailer type, or 'general' when it is in no category. */
export function trailerCategory(trailerId, categories) {
  return categories.find((c) => c.trailers.includes(trailerId))?.id ?? 'general';
}

/**
 * Category id of a cargo: the category with the most of its trailer types; a tie goes to the
 * category listed first. Cargo without trailer types is 'general'.
 */
export function cargoCategory(cargo, categories) {
  let best = null;
  let bestCount = 0;
  for (const c of categories) {
    const n = cargo.trailerTypes.filter((t) => c.trailers.includes(t)).length;
    if (n > bestCount) { best = c.id; bestCount = n; }
  }
  return best ?? 'general';
}

/** The chosen photo of a truck, trailer or cargo (`kind` = trucks | trailers | cargo), or null. */
export function catalogPhoto(kind, id, catalogPhotos) {
  return catalogPhotos?.[kind]?.[id]?.photo ?? null;
}

// Own icons, drawn for Freight World (not game artwork): side views on a 48 × 28 grid,
// 1.6 px lines in currentColor. Each value is the inner SVG markup.
const WHEELS = '<circle cx="31" cy="23" r="2.6" fill="currentColor"/><circle cx="37.5" cy="23" r="2.6" fill="currentColor"/>';
const LEG = '<path d="M9 19v4"/>';
export const ICONS = {
  box: `<rect x="2" y="5" width="40" height="14" rx="1.5"/>${LEG}${WHEELS}`,
  reefer: `<rect x="5" y="5" width="37" height="14" rx="1.5"/><rect x="1.5" y="7.5" width="3.5" height="8" rx="0.8"/><path d="M23.5 8.5v7M20.5 10.25l6 3.5M20.5 13.75l6-3.5"/>${LEG}${WHEELS}`,
  flatbed: `<path d="M2 17h40v2.5H2z"/><path d="M6 17v-3M38 17v-3"/>${LEG}${WHEELS}`,
  heavy: `<path d="M2 12h8l3 6h29v2.5H11L8 15H2z"/><path d="M17 18v-7h9v7M26 13h5l3 5"/><path d="M19 11l-3-4h6"/>${WHEELS}`,
  tank: `<rect x="3" y="5" width="38" height="13" rx="6.5"/><path d="M14 5V3h6v2"/>${LEG}${WHEELS}`,
  bulk: `<path d="M2 5h40l-3 9H5z"/><path d="M8 14l3 4h5l3-4M24 14l3 4h5l3-4"/>${WHEELS}`,
  container: `<path d="M2 18h40v2H2z"/><rect x="3" y="5" width="38" height="13" rx="0.8"/><path d="M10 7v9M16 7v9M22 7v9M28 7v9M34 7v9"/>${WHEELS}`,
  vehicles: `<path d="M2 19h40M2 11h38M4 11v8M40 11v8"/><path d="M8 11l2-4h9l3 4M24 19l2-4h9l3 4"/><path d="M8 19l2-3h8l2 3"/>${WHEELS}`,
  timber: `<path d="M2 19h40"/><path d="M6 19V8M38 19V8"/><circle cx="12" cy="15.5" r="3"/><circle cx="18.5" cy="15.5" r="3"/><circle cx="25" cy="15.5" r="3"/><circle cx="15.25" cy="9.75" r="3"/><circle cx="21.75" cy="9.75" r="3"/>${WHEELS}`,
  livestock: `<rect x="2" y="5" width="40" height="14" rx="1.5"/><path d="M6 9h6M15 9h6M24 9h6M33 9h6M6 13h6M15 13h6M24 13h6M33 13h6"/>${LEG}${WHEELS}`,
  special: `<path d="M1 12c10-3 30-5 46-2-16 1-36 3-46 2z"/><path d="M8 13v4h4v-4M30 12v6"/><circle cx="10" cy="23" r="2.6" fill="currentColor"/>${WHEELS}`,
  truck: `<path d="M3 20V6h13l4 7h17l7 3v4z"/><path d="M16.5 8l2.5 4.5h-5V8z"/><path d="M12 6V2"/><circle cx="9" cy="22.5" r="2.8" fill="currentColor"/><circle cx="15.5" cy="22.5" r="2.8" fill="currentColor"/><circle cx="37" cy="22.5" r="2.8" fill="currentColor"/>`,
  general: `<rect x="12" y="4" width="22" height="16" rx="1"/><path d="M12 9h22M23 4v5"/><path d="M10 21h26M12 21v3M23 21v3M34 21v3"/>`,
};

/** Full SVG markup of an icon (decorative: the text next to it carries the meaning). */
export function iconSvg(id) {
  const inner = ICONS[id] ?? ICONS.general;
  return `<svg viewBox="0 0 48 28" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
