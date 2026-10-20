// The ONLY place that knows the shape of a Load. Everything the page shows comes from
// buildLoadSheet(load): translated, formatted text plus the provenance of each row.
import { countryName, formatDate, formatDuration, formatKm, formatNumber, formatTime, formatTonnes, t, tOr } from "../i18n/i18n.mjs";
import { cityCode, cityName } from "../data/scope.mjs";
import { DATASETS } from "../engine/datasets.mjs";
import { offsetMin } from "../engine/time-windows.mjs";
import { scheduleFact } from "../engine/schedule.mjs";
import { LEVELS, UNAVAILABLE, levelHelp, levelLabel, phaseText } from "./provenance.mjs";

// The tabs of a load, in order. Ids are language-neutral (they appear in the page address: #cargo).
export const TABS = ["overview", "map", "cargo", "equipment", "schedule", "costs", "documents", "sources"];

// Every fact of the Load belongs to exactly one tab ("Surse și calcule" lists them all).
export const REAL_ROWS_BY_TAB = {
  overview: ["shipper", "consignee"],
  map: ["origin", "destination", "route", "countries", "borderDistance", "border"],
  cargo: ["cargo", "family", "cnCode", "temperature", "adr", "packaging", "unitMass", "mass", "loadingMetres"],
  equipment: ["trailer", "floor"],
  schedule: ["transit", "schedule", "loadingWindow", "unloadingWindow"],
  costs: [],
  documents: [],
  sources: [],
};
// Things the finished product will show, with the stage that adds them. Not facts of the Load yet.
export const PLACEHOLDERS_BY_TAB = {
  map: [["elevation", "5"]],
  cargo: [["volume", "3"]],
  equipment: [["truck", "4"], ["truckSpecs", "4"]],
  schedule: [["weekendBans", "6"], ["driverPlan", "6"]],
  costs: [["fuel", "6"], ["tolls", "5"], ["totalCost", "6"], ["currency", "6"]],
  documents: [["cmr", "7"], ["adrDocument", "7"]],
};
export const ROW_IDS = Object.values(REAL_ROWS_BY_TAB).flat();
export const PLACEHOLDER_IDS = Object.values(PLACEHOLDERS_BY_TAB).flat().map(([id]) => id);

const cargoName = cargo => tOr(`cargo.${cargo.id}`, cargo.name);
const familyName = family => tOr(`family.${family}`, family);
const equipmentName = equipment => tOr(`equip.${equipment.id}`, equipment.name);
const categoryName = category => tOr(`equipCat.${category}`, category);
const roleName = role => tOr(`role.${role}`, role);
const mm = value => t("fmt.mm", { value: formatNumber(value, { maximumFractionDigits: 0 }) });
const kg = value => t("fmt.kg", { value: formatNumber(value, { maximumFractionDigits: 0 }) });
const metres = value => t("fmt.m", { value: formatNumber(value, { maximumFractionDigits: 2 }) });
export const isFixtureRoute = summary => /fixture/i.test(summary?.provider || "");

export function zoneLabel(iso, timeZone) {
  const minutes = offsetMin(Date.parse(iso), timeZone);
  const sign = minutes >= 0 ? "+" : "−";
  const h = Math.floor(Math.abs(minutes) / 60), m = Math.abs(minutes) % 60;
  return t("fmt.utc", { offset: `${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}` });
}
const windowText = w => `${formatDate(w.from, { short: true, timeZone: w.timeZone })}, ${formatTime(w.from, w.timeZone)}–${formatTime(w.to, w.timeZone)} (${zoneLabel(w.from, w.timeZone)})`;

// Inputs of a computed fact, labelled and formatted.
function inputValue(key, value) {
  if (key === "cargo") return tOr(`cargo.${value}`, value);
  if (/Mm$/.test(key)) return mm(value);
  if (/Kg$/.test(key)) return kg(value);
  if (/Min$/.test(key)) return formatDuration(value * 60);
  if (/Km$/.test(key)) return formatKm(value);
  return typeof value === "number" ? formatNumber(value) : String(value);
}

// Turns an engine fact into what the drawer shows (all text translated).
function displayFact(fact) {
  const shown = { level: fact.level };
  if (fact.source) shown.source = { name: fact.source.name, url: fact.source.url, retrievedAt: fact.source.retrievedAt, license: fact.source.license || null };
  if (fact.formula) shown.formula = t(`formula.${fact.formula}`);
  if (fact.inputs) shown.inputs = Object.entries(fact.inputs).map(([key, value]) => ({ label: t(`input.${key}`), value: inputValue(key, value) }));
  if (fact.basis) shown.basis = t(`basis.${fact.basis}`) + (fact.range ? ` ${t("basis.range", { min: kg(fact.range.min), max: kg(fact.range.max) })}` : "");
  if (fact.note) shown.note = t(`note.${fact.note}`);
  if (fact.dependsOnEstimate) shown.note = [shown.note, t("note.dependsOnEstimate")].filter(Boolean).join(" ");
  if (fact.datasets) shown.datasets = fact.datasets.map(id => DATASETS[id]).filter(Boolean);
  if (fact.level === UNAVAILABLE) { shown.phase = fact.phase; shown.reason = t(`reason.${fact.reason}`); }
  return shown;
}

function sourceMeta(fact) {
  if (!fact?.source) return [];
  const meta = []; // the source name itself is shown in the drawer's source section
  if (fact.source.license) meta.push({ label: t("meta.license"), value: fact.source.license });
  meta.push({ label: t("meta.retrieved"), value: formatDate(fact.source.retrievedAt, { weekday: false }) });
  if (fact.source.note) meta.push({ label: t("meta.sourceNote"), value: t(`sourceNote.${fact.source.note}`) });
  return meta;
}
const sourceLinks = fact => (fact?.source?.url ? [{ label: t("drawer.openSource"), url: fact.source.url }] : []);
// Data sets a fact was derived from (Natural Earth, OpenStreetMap, UN/LOCODE…): one line and one link each.
const datasetMeta = fact => (fact?.datasets || []).map(id => DATASETS[id]).filter(Boolean).map(d => ({ label: t("meta.datasets"), value: `${d.name} · ${d.license}` }));
const datasetLinks = fact => (fact?.datasets || []).map(id => DATASETS[id]).filter(Boolean).map(d => ({ label: d.name, url: d.url }));

function row(id, fact, valueText, { explanation, meta = [], links = [] } = {}) {
  const available = fact.level !== UNAVAILABLE;
  const shown = displayFact(fact);
  return {
    id,
    label: t(`row.${id}.label`),
    valueText: available ? valueText : phaseText(fact.phase),
    level: fact.level,
    levelLabel: levelLabel(fact.level),
    available,
    fact: shown,
    detail: {
      explanation: available ? (explanation ?? tOr(`row.${id}.detail`, "")) : shown.reason,
      meta: [...meta, ...sourceMeta(fact), ...datasetMeta(fact)],
      links: [...links, ...sourceLinks(fact), ...datasetLinks(fact)],
    },
  };
}

function transitMeta(transit) {
  const names = { drive: t("transit.drive"), break: t("transit.break"), dailyRest: t("transit.dailyRest") };
  return [
    ...transit.segments.map(s => ({ label: names[s.type], value: formatDuration(s.min * 60) })),
    { label: t("transit.breaks"), value: String(transit.breaks) },
    { label: t("transit.dailyRests"), value: String(transit.dailyRests) },
  ];
}

const eventWhen = (iso, zone) => `${formatDate(iso, { short: true, timeZone: zone })}, ${formatTime(iso, zone)}`;
function timelineOf(events) {
  return events.map(e => {
    const start = e.from ?? e.at;
    return {
      type: e.type,
      label: t(`event.${e.type}`),
      when: eventWhen(start, e.timeZone),
      until: e.to ? formatTime(e.to, e.timeZone) : null,
      zone: zoneLabel(start, e.timeZone),
      duration: e.min ? formatDuration(e.min * 60) : (e.type === "loading" || e.type === "unloading" ? formatDuration((Date.parse(e.to) - Date.parse(e.from)) / 60000 * 60) : null),
    };
  });
}

// Short UN/LOCODE parts (BUH → BUD); when both would be the same, the full codes are shown.
function heroCodes(origin, destination) {
  const a = cityCode(origin), b = cityCode(destination);
  const same = a === b;
  return { originCode: cityCode(origin, { full: same }), destinationCode: cityCode(destination, { full: same }) };
}

// photos: Map(GeoNames ID -> prepared Wikimedia Commons photo), optional.
const crossingText = c => `${c.name || t("border.generic")} (${countryName(c.from)} → ${countryName(c.to)})`;
const regimeText = c => t(`border.${c.regime}`);
const osmUrl = id => `https://www.openstreetmap.org/${id}`;

function borderRowParts(fact) {
  if (fact.level === UNAVAILABLE) return { text: "", meta: [], links: [] };
  const list = fact.value.crossings;
  if (!list.length) return { text: t("border.none"), meta: [], links: [], explanation: t("row.border.detailNone") };
  return {
    text: list.map(crossingText).join("; "),
    meta: list.flatMap(c => [
      { label: crossingText(c), value: regimeText(c) },
      { label: t("border.position"), value: `${formatNumber(c.lat, { maximumFractionDigits: 4 })}, ${formatNumber(c.lon, { maximumFractionDigits: 4 })}` },
      ...(c.osm.length ? [{ label: t("border.found"), value: t("border.foundValue", { meters: formatNumber(c.distanceM, { maximumFractionDigits: 0 }) }) }] : [{ label: t("border.found"), value: t("border.notFound") }]),
    ]),
    links: list.flatMap(c => c.osm.slice(0, 3).map(id => ({ label: `OpenStreetMap ${id}`, url: osmUrl(id) }))),
  };
}

const distancesText = fact => (fact.level === UNAVAILABLE ? "" : fact.value.countries.map(c => `${countryName(c.code)} ${formatKm(c.km)}`).join(" · "));

export function buildLoadSheet(load, { photos = new Map() } = {}) {
  const origin = load.origin.value;
  const destination = load.destination.value;
  const summaryFact = load.route.summary;
  const route = summaryFact.value;
  const cargo = load.cargo.selection.value;
  const equipment = load.equipment.selection.value;
  const p = load.packaging;
  const transit = load.transit.value;
  const loading = load.timeWindows.loading.value;
  const unloading = load.timeWindows.unloading.value;
  const duration = formatDuration(route.durationS);
  const transitText = formatDuration(transit.totalMin * 60);
  const countries = route.countries.map(countryName);
  const packagingOk = p.unitCount.level !== UNAVAILABLE;
  const massText = packagingOk ? t("fmt.approx", { value: formatTonnes(p.totalMassKg.value / 1000) }) : null;
  const floor = load.equipment.floor;
  const names = { cargo: cargoName(cargo), trailer: equipmentName(equipment), family: familyName(cargo.family) };
  const originLine = `${cityName(origin)}, ${countryName(origin.countryCode)}`;
  const destinationLine = `${cityName(destination)}, ${countryName(destination.countryCode)}`;
  const placeMeta = place => [
    ...(place.locode ? [{ label: t("meta.locode"), value: place.locode }] : []),
    { label: t("meta.population"), value: formatNumber(place.population, { maximumFractionDigits: 0 }) },
    { label: t("meta.timeZone"), value: place.timeZone },
  ];

  const rows = [
    row("origin", load.origin, originLine, { meta: placeMeta(origin) }),
    row("destination", load.destination, destinationLine, { meta: placeMeta(destination) }),
    row("route", summaryFact, `${formatKm(route.distanceKm)} · ${duration}`, {
      meta: [
        { label: t("meta.provider"), value: route.provider },
        { label: t("meta.distance"), value: formatKm(route.distanceKm) },
        { label: t("meta.duration"), value: duration },
        { label: t("meta.traffic"), value: route.trafficModel === "approximated" ? t("meta.trafficApprox") : t("meta.trafficUnknown") },
        { label: t("meta.tolls"), value: route.hasTolls ? t("meta.tollsYes") : t("meta.tollsNo") },
      ],
    }),
    countries.length
      ? row("countries", summaryFact, countries.join(" → "))
      : row("countries", { value: null, level: UNAVAILABLE, phase: "5", reason: "countriesMissing" }, ""),
    row("borderDistance", load.route.countryDistances, distancesText(load.route.countryDistances), {
      meta: load.route.countryDistances.level === UNAVAILABLE ? [] : load.route.countryDistances.value.countries.map(c => ({ label: countryName(c.code), value: `${formatKm(c.km)} · ${formatNumber(c.share * 100, { maximumFractionDigits: 0 })}%` })),
    }),
    (() => { const parts = borderRowParts(load.route.borderCrossings); return row("border", load.route.borderCrossings, parts.text, { meta: parts.meta, links: parts.links, ...(parts.explanation ? { explanation: parts.explanation } : {}) }); })(),
    row("cargo", load.cargo.selection, names.cargo, { meta: [{ label: t("meta.cargoCatalog"), value: cargo.id }] }),
    row("family", load.cargo.nstChapters, load.cargo.nstChapters.value ? `${names.family} · NST ${load.cargo.nstChapters.value.join(", ")}` : ""),
    row("temperature", load.cargo.temperature, ""),
    row("adr", load.cargo.adr, ""),
    row("packaging", p.unitCount, packagingOk ? t("fmt.palletCount", { count: p.unitCount.value }) : "", {
      meta: packagingOk ? [{ label: t("meta.unit"), value: t("fmt.palletDims", { l: mm(p.unitType.value.lengthMm), w: mm(p.unitType.value.widthMm) }) }, ...sourceMeta(p.unitType)] : [],
      links: packagingOk ? sourceLinks(p.unitType) : [],
    }),
    row("unitMass", p.unitMassKg, packagingOk ? t("fmt.approx", { value: kg(p.unitMassKg.value) }) : ""),
    row("mass", p.totalMassKg, massText || ""),
    row("loadingMetres", p.loadingMetres, packagingOk ? metres(p.loadingMetres.value) : ""),
    row("trailer", load.equipment.selection, names.trailer, { meta: [{ label: t("meta.category"), value: categoryName(equipment.category) }] }),
    row("floor", floor, floor.value ? t("fmt.floor", { l: metres(floor.value.lengthMm / 1000), w: metres(floor.value.widthMm / 1000), payload: formatTonnes(floor.value.payloadKg / 1000) }) : ""),
    row("transit", load.transit, transitText, {
      meta: [...transitMeta(transit), ...sourceMeta({ source: load.transit.regulation })],
      links: sourceLinks({ source: load.transit.regulation }),
    }),
    row("loadingWindow", load.timeWindows.loading, windowText(loading), { meta: [{ label: t("meta.timeZone"), value: loading.timeZone }] }),
    row("unloadingWindow", load.timeWindows.unloading, windowText(unloading), {
      meta: [{ label: t("meta.timeZone"), value: unloading.timeZone }, { label: t("meta.slack"), value: formatDuration(unloading.slackMin * 60) }],
    }),
    row("shipper", load.parties.shipperRole, roleName(load.parties.shipperRole.value)),
    row("consignee", load.parties.consigneeRole, roleName(load.parties.consigneeRole.value)),
  ];

  const schedule = scheduleFact(load);
  const events = schedule.value.events;
  const scheduleText = t("fmt.scheduleSummary", { depart: eventWhen(schedule.value.departAt, loading.timeZone), arrive: eventWhen(schedule.value.arrivalAt, unloading.timeZone) });
  const extraRows = [
    row("cnCode", load.cargo.cnCode, ""),
    row("schedule", schedule, scheduleText, {
      meta: events.map(e => ({
        label: t(`event.${e.type}`),
        value: e.to ? `${eventWhen(e.from, e.timeZone)} → ${formatTime(e.to, e.timeZone)} (${zoneLabel(e.from, e.timeZone)})` : `${eventWhen(e.at, e.timeZone)} (${zoneLabel(e.at, e.timeZone)})`,
      })),
    }),
  ];
  const rowMap = Object.fromEntries([...rows, ...extraRows].map(r => [r.id, r]));
  const placeholderRow = ([id, phase]) => ({ ...row(id, { value: null, level: UNAVAILABLE, phase, reason: id }, ""), placeholder: true });
  const rowsByTab = Object.fromEntries(TABS.map(tab => [tab, [
    ...REAL_ROWS_BY_TAB[tab].map(id => ({ ...rowMap[id], tab })),
    ...(PLACEHOLDERS_BY_TAB[tab] || []).map(entry => ({ ...placeholderRow(entry), tab })),
  ]]));
  const allRows = TABS.flatMap(tab => rowsByTab[tab]);
  const listedTrailers = cargo.equipmentIds.map(id => ({ id, name: tOr(`equip.${id}`, id), chosen: id === equipment.id }));
  const stopsText = t("kpi.breaksFoot", { breaks: transit.breaks, rests: transit.dailyRests });

  const chip = (id, valueText, phase = null) => ({ id, label: t(`chip.${id}`), valueText: valueText ?? t("chip.pending", { phase }), available: valueText != null });
  const kpi = (id, valueText, pendingText = null, foot = null) => ({ id, label: t(`kpi.${id}`), valueText, pendingText, foot });
  const pendingPhase = fact => t("kpi.pending", { phase: fact.phase });

  return {
    id: load.id,
    displayId: load.id,
    fixture: isFixtureRoute(route),
    hero: {
      ...heroCodes(origin, destination),
      originName: cityName(origin),
      destinationName: cityName(destination),
      originLine,
      destinationLine,
      via: route.viaNames.length ? route.viaNames.join(" · ") : null,
      chips: [
        chip("distance", formatKm(route.distanceKm)),
        chip("duration", duration),
        chip("transit", transitText),
        chip("cargo", names.cargo),
        chip("trailer", names.trailer),
        chip("mass", massText, p.totalMassKg.phase),
        chip("temperature", null, load.cargo.temperature.phase),
        chip("adr", null, load.cargo.adr.phase),
      ],
      generatedAt: formatDate(load.createdAt, { time: true }),
      loading: {
        time: `${formatTime(loading.from, loading.timeZone)}–${formatTime(loading.to, loading.timeZone)}`,
        date: `${formatDate(loading.from, { timeZone: loading.timeZone })} · ${zoneLabel(loading.from, loading.timeZone)}`,
      },
      unloadingLine: t("hero.unloadingLine", { value: windowText(unloading) }),
    },
    kpis: [
      kpi("distance", formatKm(route.distanceKm)),
      kpi("duration", duration),
      kpi("transit", transitText, null, t("kpi.transitFoot")),
      kpi("mass", massText, packagingOk ? null : pendingPhase(p.totalMassKg)),
      kpi("loadingMetres", packagingOk ? metres(p.loadingMetres.value) : null, packagingOk ? null : pendingPhase(p.loadingMetres)),
      kpi("breaks", String(transit.breaks + transit.dailyRests), null, t("kpi.breaksFoot", { breaks: transit.breaks, rests: transit.dailyRests })),
      kpi("cost", null, t("kpi.costPhase")),
      kpi("documents", null, t("kpi.documentsPhase")),
    ],
    cargo: {
      name: names.cargo,
      family: names.family,
      verify: cargo.regulatoryReview,
      notes: cargo.handling,
      facts: [
        { label: t("card.family"), value: names.family },
        { label: t("card.loadForm"), value: cargo.loadForm || t("ui.noValue"), english: Boolean(cargo.loadForm) },
        { label: t("card.packaging"), value: packagingOk ? t("fmt.palletCount", { count: p.unitCount.value }) : phaseText(p.unitCount.phase), pending: !packagingOk },
        { label: t("row.temperature.label"), value: phaseText(load.cargo.temperature.phase), pending: true },
      ],
    },
    map: {
      geometry: route.geometry,
      origin: { lat: origin.lat, lon: origin.lon },
      destination: { lat: destination.lat, lon: destination.lon },
      originName: cityName(origin),
      destinationName: cityName(destination),
      provider: route.provider,
      crossings: load.route.borderCrossings.level === UNAVAILABLE ? [] : load.route.borderCrossings.value.crossings.map(c => ({ lat: c.lat, lon: c.lon, label: crossingText(c) })),
    },
    cities: [
      { role: "origin", label: t("city.origin"), place: origin, weatherAt: { iso: loading.from, label: t("weather.atLoading") } },
      { role: "destination", label: t("city.destination"), place: destination, weatherAt: { iso: unloading.from, label: t("weather.atUnloading") } },
    ].map(({ role, label, place, weatherAt }) => ({
      role,
      label,
      geonamesId: place.geonamesId,
      timeZone: place.timeZone,
      code: cityCode(place),
      name: cityName(place),
      sub: `${countryName(place.countryCode)} · ${t("city.population", { value: formatNumber(place.population, { maximumFractionDigits: 0 }) })}`,
      photo: photos.get(String(place.geonamesId)) || null,
      weatherAt,
    })),
    tabs: TABS.map(id => ({ id, label: t(`tab.${id}`) })),
    rows: allRows,
    rowsByTab,
    timeline: timelineOf(events),
    trailers: listedTrailers,
    overview: {
      route: [
        { label: t("chip.distance"), value: formatKm(route.distanceKm) },
        { label: t("chip.duration"), value: duration },
        { label: t("chip.transit"), value: transitText },
        { label: t("row.countries.label"), value: load.route.countryDistances.level !== UNAVAILABLE ? distancesText(load.route.countryDistances) : (countries.length ? countries.join(" → ") : phaseText("5")) },
        { label: t("row.border.label"), value: load.route.borderCrossings.level !== UNAVAILABLE ? borderRowParts(load.route.borderCrossings).text : phaseText(load.route.borderCrossings.phase) },
        { label: t("hero.via"), value: route.viaNames.length ? route.viaNames.join(" · ") : t("ui.noValue") },
        { label: t("meta.tolls"), value: route.hasTolls ? t("meta.tollsYes") : t("meta.tollsNo") },
      ],
      roles: [
        { label: t("row.shipper.label"), value: roleName(load.parties.shipperRole.value) },
        { label: t("row.consignee.label"), value: roleName(load.parties.consigneeRole.value) },
      ],
      trailer: {
        name: names.trailer,
        category: categoryName(equipment.category),
        floor: floor.value ? t("fmt.floor", { l: metres(floor.value.lengthMm / 1000), w: metres(floor.value.widthMm / 1000), payload: formatTonnes(floor.value.payloadKg / 1000) }) : null,
        floorPending: floor.value ? null : phaseText(floor.phase),
      },
      schedule: [
        { label: t("row.loadingWindow.label"), value: windowText(loading) },
        { label: t("row.unloadingWindow.label"), value: windowText(unloading) },
        { label: t("row.transit.label"), value: transitText },
        { label: t("kpi.breaks"), value: stopsText },
      ],
    },
    warnings: load.warnings.map(w => t(`warning.${w.id}`)),
    legend: [...LEVELS, UNAVAILABLE].map(level => ({ level, label: levelLabel(level), help: levelHelp(level) })),
  };
}

// Small entry for the "recent loads" chips in the top bar.
export function buildRecentEntry(load) {
  const code = `${cityCode(load.origin.value)}→${cityCode(load.destination.value)}`;
  const label = cargoName(load.cargo.selection.value);
  return { id: load.id, code, label, aria: t("history.recentFor", { code, cargo: label }) };
}
