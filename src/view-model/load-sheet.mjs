// The ONLY place that knows the shape of a mission. Everything the page shows comes
// from buildLoadSheet(mission). In phase 1B this function will read the new Load model
// instead; the UI modules do not change.
import { countryName, formatDate, formatDuration, formatKm, formatNumber, formatTime, t, tOr } from "../i18n/i18n.mjs";
import { cityCode, cityName } from "../data/scope.mjs";
import { NST_ESTIMATES } from "../data/nst-estimates.mjs";
import { LEVELS, UNAVAILABLE, computedFact, estimatedFact, levelHelp, levelLabel, phaseText, simulatedFact, sourcedFact, unavailableFact } from "./provenance.mjs";

export const ROW_IDS = ["origin", "destination", "route", "countries", "border", "cargo", "family", "temperature", "adr", "packaging", "mass", "trailer", "windows", "shipper"];

const cargoName = cargo => tOr(`cargo.${cargo.id}`, cargo.name);
const familyName = cargo => tOr(`family.${cargo.family}`, cargo.family);
const equipmentName = equipment => tOr(`equip.${equipment.id}`, equipment.name);
const equipmentCategory = equipment => tOr(`equipCat.${equipment.category}`, equipment.category);

export const displayId = id => String(id).replace(/^FOS-(?:ATS|ETS2)-/, "FOS-");
export const isFixtureRoute = route => /fixture/i.test(route?.provider || "");

function placeFact(place, fallbackDate) {
  return sourcedFact({
    name: place.sourceName || "GeoNames",
    url: place.sourceUrl,
    retrievedAt: place.retrievedAt || fallbackDate,
    license: place.attribution || null,
  });
}

function placeDetail(place, mission, explanationKey) {
  const meta = [{ label: t("meta.source"), value: place.sourceName || "GeoNames" }];
  if (place.attribution) meta.push({ label: t("meta.license"), value: place.attribution });
  meta.push({ label: t("meta.retrieved"), value: formatDate(place.retrievedAt || mission.createdAt, { weekday: false }) });
  if (Number.isFinite(place.population)) meta.push({ label: t("meta.population"), value: formatNumber(place.population, { maximumFractionDigits: 0 }) });
  return { explanation: t(explanationKey), meta, links: place.sourceUrl ? [{ label: t("drawer.openSource"), url: place.sourceUrl }] : [] };
}

function row(id, valueText, fact, detail = {}) {
  const available = fact.level !== UNAVAILABLE;
  return {
    id,
    label: t(`row.${id}.label`),
    valueText: available ? valueText : phaseText(fact.phase),
    level: fact.level,
    levelLabel: levelLabel(fact.level),
    available,
    fact,
    detail: { explanation: "", meta: [], links: [], ...detail },
  };
}
const pending = (id, phase) => row(id, "", unavailableFact(phase, t(`row.${id}.unavailable`)), { explanation: t(`row.${id}.unavailable`) });

export function buildLoadSheet(mission) {
  const { origin, destination, route, cargo, equipment } = mission;
  const details = route.routeDetails || {};
  const fixture = isFixtureRoute(route);
  const km = route.distanceMeters / 1000;
  const duration = formatDuration(route.durationSeconds);
  const roads = (details.namedRoads || []).slice(0, 3).map(road => road.name);
  const countries = (details.countries || []).map(countryName);
  const chapters = NST_ESTIMATES[cargo.family];
  const names = { cargo: cargoName(cargo), trailer: equipmentName(equipment), family: familyName(cargo) };

  const routeFact = sourcedFact({ name: route.provider || "Geoapify Routing API", url: route.sourceUrl, retrievedAt: route.retrievedAt || mission.createdAt });
  const trafficText = route.trafficModel === "approximated" ? t("meta.trafficApprox") : route.trafficModel === "free_flow" ? t("meta.trafficFree") : t("meta.trafficUnknown");
  const rows = [
    row("origin", `${cityName(origin)}, ${countryName(origin.countryCode)}`, placeFact(origin, mission.createdAt), placeDetail(origin, mission, "row.origin.detail")),
    row("destination", `${cityName(destination)}, ${countryName(destination.countryCode)}`, placeFact(destination, mission.createdAt), placeDetail(destination, mission, "row.destination.detail")),
    row("route", `${formatKm(km)} · ${duration}`, routeFact, {
      explanation: t("row.route.detail"),
      meta: [
        { label: t("meta.provider"), value: route.provider || "Geoapify Routing API" },
        { label: t("meta.profile"), value: t("meta.profileTruck") },
        { label: t("meta.distance"), value: formatKm(km) },
        { label: t("meta.duration"), value: duration },
        { label: t("meta.traffic"), value: trafficText },
        { label: t("meta.tolls"), value: details.hasTolls ? t("meta.tollsYes") : t("meta.tollsNo") },
        { label: t("meta.retrieved"), value: formatDate(route.retrievedAt || mission.createdAt, { time: true, weekday: false }) },
      ],
      links: route.sourceUrl ? [{ label: t("drawer.openSource"), url: route.sourceUrl }] : [],
    }),
    countries.length
      ? row("countries", countries.join(" → "), routeFact, { explanation: t("row.countries.detail"), links: route.sourceUrl ? [{ label: t("drawer.openSource"), url: route.sourceUrl }] : [] })
      : row("countries", "", unavailableFact("5", t("row.countries.unavailable")), { explanation: t("row.countries.unavailable") }),
    pending("border", "2"),
    row("cargo", names.cargo, simulatedFact({ note: t("row.cargo.note") }), { explanation: t("row.cargo.detail"), meta: [{ label: t("meta.cargoCatalog"), value: cargo.id }] }),
    chapters
      ? row("family", `${names.family} · NST ${chapters.join(", ")}`, estimatedFact({ basis: t("row.family.basis") }), {
        explanation: t("row.family.detail"),
        meta: [{ label: t("meta.family"), value: names.family }, { label: t("meta.nstChapters"), value: chapters.join(", ") }],
      })
      : row("family", "", unavailableFact("3", t("row.family.noEstimate")), { explanation: t("row.family.noEstimate") }),
    pending("temperature", "3"),
    pending("adr", "3"),
    pending("packaging", "1B"),
    pending("mass", "1B"),
    row("trailer", names.trailer, computedFact({
      formula: t("row.trailer.formula"),
      inputs: [{ label: t("meta.cargo"), value: names.cargo }, { label: t("meta.trailerOptions"), value: String((cargo.equipmentIds || []).length) }],
    }), { explanation: t("row.trailer.detail"), meta: [{ label: t("meta.category"), value: equipmentCategory(equipment) }] }),
    pending("windows", "1B"),
    pending("shipper", "1B"),
  ];

  const chip = (id, valueText, phase = null) => ({ id, label: t(`chip.${id}`), valueText: valueText ?? t("chip.pending", { phase }), available: valueText != null });
  const kpi = (id, valueText, phase) => ({ id, label: t(`kpi.${id}`), valueText: valueText ?? null, pendingText: valueText == null ? (phase.text || t("kpi.pending", { phase: phase.phase })) : null });
  const verify = cargo.regulatoryReview || null;

  return {
    id: mission.id,
    displayId: displayId(mission.id),
    fixture,
    hero: {
      originCode: cityCode(origin),
      destinationCode: cityCode(destination),
      originName: cityName(origin),
      destinationName: cityName(destination),
      originLine: `${cityName(origin)}, ${countryName(origin.countryCode)}`,
      destinationLine: `${cityName(destination)}, ${countryName(destination.countryCode)}`,
      via: roads.length ? roads.join(" · ") : null,
      chips: [
        chip("distance", formatKm(km)),
        chip("duration", duration),
        chip("cargo", names.cargo),
        chip("trailer", names.trailer),
        chip("mass", null, "1B"),
        chip("temperature", null, "3"),
        chip("adr", null, "3"),
      ],
      generatedAt: formatDate(mission.createdAt, { time: true }),
      generatedTime: formatTime(mission.createdAt),
      generatedDate: formatDate(mission.createdAt),
    },
    kpis: [
      kpi("distance", formatKm(km)),
      kpi("duration", duration, null),
      kpi("mass", null, { phase: "1B" }),
      kpi("loadMeters", null, { phase: "1B" }),
      kpi("cost", null, { text: t("kpi.costPhase") }),
      kpi("breaks", null, { text: t("kpi.breaksPhase") }),
      kpi("documents", null, { text: t("kpi.documentsPhase") }),
    ],
    cargo: {
      name: names.cargo,
      family: names.family,
      loadForm: cargo.loadForm || null,
      verify,
      notes: cargo.handling || [],
      facts: [
        { label: t("card.family"), value: names.family },
        { label: t("card.loadForm"), value: cargo.loadForm || t("ui.noValue"), english: Boolean(cargo.loadForm) },
        { label: t("card.packaging"), value: phaseText("1B"), pending: true },
        { label: t("row.temperature.label"), value: phaseText("3"), pending: true },
      ],
    },
    map: {
      geometry: details.geometry || [],
      origin: { lat: origin.lat, lon: origin.lon },
      destination: { lat: destination.lat, lon: destination.lon },
      originName: cityName(origin),
      destinationName: cityName(destination),
      provider: route.provider || "Geoapify Routing API",
    },
    rows,
    legend: [...LEVELS, UNAVAILABLE].map(level => ({ level, label: levelLabel(level), help: levelHelp(level) })),
  };
}

// Small entry for the "recent loads" chips in the top bar.
export function buildRecentEntry(mission) {
  const code = `${cityCode(mission.origin)}→${cityCode(mission.destination)}`;
  const label = cargoName(mission.cargo);
  return { id: mission.id, code, label, aria: t("history.recentFor", { code, cargo: label }) };
}
