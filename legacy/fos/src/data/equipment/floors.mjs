// Internal loading floor of a typical trailer of each type, with a cited source.
// Directive 96/53/EC sets external limits only (no "13.6 m loading length"); these figures are
// typical values from operators' equipment pages, which state that they vary by manufacturer and year.
// A trailer type that is not listed has no sourced floor yet (phase 4: real trailer models).
const dsv = (page, name) => ({
  name: `DSV — ${name}`,
  note: "typicalVaries", // the page says dimensions vary by manufacture and production year
  url: `https://www.dsv.com/en/our-solutions/modes-of-transport/road-transport/trailer-sizes/${page}`,
  retrievedAt: "2026-10-20",
});

export const TRAILER_FLOORS = {
  curtainsider: { lengthMm: 13620, widthMm: 2480, heightMm: 2700, payloadKg: 32800, source: dsv("curtain-trailer", "curtain trailer") },
  reefer: { lengthMm: 13310, widthMm: 2480, heightMm: 2600, payloadKg: 31000, source: dsv("reefer-trailer", "reefer trailer") },
  dryVan: { lengthMm: 13620, widthMm: 2460, heightMm: 2700, payloadKg: 31400, source: dsv("box-trailer", "box trailer") },
};
