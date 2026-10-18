import { CARGO, chooseRandomCityPair, EQUIPMENT, generateMission as buildMission, toSourcedPlace, validateMission, WORLD_MODES } from "./mission-engine.mjs";
import { CARGO_SOURCES } from "./data/cargo-catalog.mjs";
import { COMPANY_DIRECTORY, FREIGHT_LANES, getFreightLane, NETWORK_SOURCES } from "./data/freight-network.mjs";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const HISTORY_KEY = "fos-mission-history-v3";
let history = loadHistory();
const selectedPlaces = { origin: null, destination: null };
const selectedCompanyHints = { origin: null, destination: null };
let cityCatalog = null;

function getWorld() { return $("input[name=world]:checked")?.value || "ATS"; }
function formatNum(value) { return Number(value).toLocaleString("en-US", { maximumFractionDigits: 1 }); }
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 4200);
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
function safeHref(value, fallback) {
  return /^https?:\/\//i.test(String(value || "")) ? value : fallback;
}
function populateCargoOptions() {
  const select = $("#cargo");
  const previous = select.value || "random";
  const lane = getFreightLane($("#freightLane").value);
  const allowedIds = lane ? new Set(lane.cargoIds) : null;
  const groups = new Map();
  for (const cargo of Object.values(CARGO)) {
    if (allowedIds && !allowedIds.has(cargo.id)) continue;
    if (!groups.has(cargo.family)) groups.set(cargo.family, []);
    groups.get(cargo.family).push(cargo);
  }
  select.replaceChildren(new Option(lane ? "Random cargo for this corridor" : "Random cargo for any corridor", "random"));
  for (const [family, items] of groups) {
    const group = document.createElement("optgroup");
    group.label = family;
    for (const cargo of items) group.append(new Option(cargo.name, cargo.id));
    select.append(group);
  }
  select.value = previous === "random" || !allowedIds?.has(previous) ? "random" : previous;
  populateEquipmentOptions();
}
function populateEquipmentOptions() {
  const select = $("#equipment");
  const previous = select.value || "random";
  const cargo = CARGO[$("#cargo").value];
  const records = cargo
    ? cargo.equipmentIds.map(id => EQUIPMENT[id]).filter(Boolean)
    : Object.values(EQUIPMENT);
  const groups = new Map();
  for (const equipment of records) {
    if (!groups.has(equipment.category)) groups.set(equipment.category, []);
    groups.get(equipment.category).push(equipment);
  }
  select.replaceChildren(new Option("Random compatible trailer", "random"));
  for (const [category, items] of groups) {
    const group = document.createElement("optgroup");
    group.label = category;
    for (const equipment of items) group.append(new Option(equipment.name, equipment.id));
    select.append(group);
  }
  select.value = records.some(item => item.id === previous) ? previous : "random";
}
function populateLaneOptions() {
  const select = $("#freightLane");
  const previous = select.value;
  const cargoId = $("#cargo")?.value || "random";
  const equipmentId = $("#equipment")?.value || "random";
  const lanes = FREIGHT_LANES.filter(lane => lane.world === getWorld()
    && (cargoId === "random" || lane.cargoIds.includes(cargoId))
    && (equipmentId === "random" || lane.cargoIds.some(id => CARGO[id]?.equipmentIds.includes(equipmentId))));
  select.replaceChildren(new Option("Random compatible industry corridor", "random-lane"));
  for (const lane of lanes) select.add(new Option(lane.label, lane.id));
  select.value = lanes.some(lane => lane.id === previous) ? previous : "random-lane";
  populateCargoOptions();
  updateLaneStatus();
}
function updateLaneStatus() {
  const lane = getFreightLane($("#freightLane").value);
  const cargoId = $("#cargo").value;
  const equipmentId = $("#equipment").value;
  const hasCompatibleLane = FREIGHT_LANES.some(item => item.world === getWorld()
    && (cargoId === "random" || item.cargoIds.includes(cargoId))
    && (equipmentId === "random" || item.cargoIds.some(id => CARGO[id]?.equipmentIds.includes(equipmentId))));
  $("#laneStatus").textContent = lane
    ? `${lane.rationale} Lane context: ${(lane.sourceIds || []).map(id => NETWORK_SOURCES[id]?.name).filter(Boolean).join("; ") || "illustrative planning scenario, not a verified trade flow"}.`
    : !hasCompatibleLane
      ? "No curated industry corridor matches this cargo and trailer yet. A general real-city pair will be routed instead."
      : "A compatible corridor is drawn from the selected world, cargo, and trailer. These are illustrative city-to-city scenarios, not booked company routes.";
}
function populateCompanyDirectory() {
  const select = $("#companyPreset");
  const previous = select.value;
  const companies = COMPANY_DIRECTORY.filter(company => company.worlds.includes(getWorld()));
  select.replaceChildren(new Option("Choose a company search suggestion", ""));
  for (const company of companies) {
    select.add(new Option(`${company.name} · ${company.sector}`, company.id));
  }
  select.value = companies.some(company => company.id === previous) ? previous : "";
  $("#companyDirectoryLinks").innerHTML = companies.map(company =>
    `<a href="${esc(company.website)}" target="_blank" rel="noopener">${esc(company.name)}</a>`
  ).join(" · ");
}
function renderCargoDetails(cargo) {
  const handling = (cargo.handling || []).map(item => `<li>${esc(item)}</li>`).join("");
  const sources = (cargo.sourceIds || []).map(id => CARGO_SOURCES[id]).filter(Boolean)
    .map(source => `<a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.name)}</a>`).join(" · ");
  return `<div class="mission-section"><h4>CARGO PROFILE · ${esc(cargo.family.toUpperCase())}</h4>
    <p><b>${esc(cargo.name)}</b> — ${esc(cargo.description)}</p>
    <p><b>Typical load form:</b> ${esc(cargo.loadForm)}${cargo.temperature ? ` · <b>Temperature:</b> ${esc(cargo.temperature)}` : ""}</p>
    ${cargo.varietyExamples?.length ? `<p><b>Examples / varieties:</b> ${cargo.varietyExamples.map(esc).join(", ")}</p>` : ""}
    ${handling ? `<ul class="cargo-handling">${handling}</ul>` : ""}
    ${cargo.regulatoryReview ? `<p class="cargo-caution"><b>Verification needed:</b> ${esc(cargo.regulatoryReview)}</p>` : ""}
    ${cargo.planningNote ? `<p class="field-help">${esc(cargo.planningNote)}</p>` : ""}
    <p class="field-help">Commodity name: curated real-world example. Trailer match: planning heuristic, not verified compatibility. ${sources ? `Reference framework: ${sources}.` : ""}</p>
  </div>`;
}
function renderEquipmentDetails(equipment) {
  const variants = (equipment.variants || []).map(item => `<li>${esc(item)}</li>`).join("");
  const checks = (equipment.checks || []).map(item => `<li>${esc(item)}</li>`).join("");
  return `<div class="mission-section"><h4>TRAILER PROFILE · ${esc(equipment.category || "Equipment")}</h4>
    <p><b>${esc(equipment.name)}</b> — ${esc(equipment.uses || "Equipment match is a planning suggestion, not a verified specification.")}</p>
    ${variants ? `<p><b>Common configurations:</b></p><ul class="cargo-handling">${variants}</ul>` : ""}
    ${checks ? `<p><b>Confirm before use:</b></p><ul class="cargo-handling">${checks}</ul>` : ""}
    <p class="field-help">Equipment labels describe common trailer types; dimensions, payload, certification, and compatibility vary by vehicle, jurisdiction, and shipment.</p>
  </div>`;
}
function renderLaneDetails(lane) {
  if (!lane) return "";
  const sources = (lane.sourceIds || []).map(id => NETWORK_SOURCES[id]).filter(Boolean)
    .map(source => `<a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.name)}</a>`).join(" · ");
  const companies = (lane.companyIds || []).map(id => COMPANY_DIRECTORY.find(company => company.id === id)).filter(Boolean)
    .map(company => `<a href="${esc(safeHref(company.website, "#"))}" target="_blank" rel="noopener">${esc(company.name)}</a>`).join(" · ");
  return `<div class="mission-section"><h4>FREIGHT CORRIDOR CONTEXT</h4>
    <p><b>${esc(lane.label)}</b></p><p>${esc(lane.rationale)}</p>
    ${companies ? `<p><b>Relevant real brands to explore (not route parties):</b> ${companies}</p>` : ""}
    <p class="field-help">${sources ? `Background sources: ${sources}. ` : ""}Illustrative corridor between city reference points. Company examples are sector research prompts only; they are not claimed to operate at either endpoint or participate in the route.</p>
  </div>`;
}
function renderCompanyHints(hints = []) {
  const entries = hints.map(item => COMPANY_DIRECTORY.find(company => company.id === item?.id)).filter(Boolean);
  if (!entries.length) return "";
  return `<div class="mission-section"><h4>COMPANY SEARCH SUGGESTIONS</h4>
    <ul class="cargo-handling">${entries.map(company => `<li><a href="${esc(safeHref(company.website, "#"))}" target="_blank" rel="noopener">${esc(company.name)}</a> · ${esc(company.sector)}. Search inspiration only; the selected place is a separate provider result and is not verified as company-owned or operated.</li>`).join("")}</ul>
  </div>`;
}
function formatRouteDistance(meters, unit) {
  const distance = unit === "mi" ? meters / 1609.344 : meters / 1000;
  return `${formatNum(distance)} ${unit}`;
}
function renderRoadDetails(route, unit, originName, destinationName) {
  const details = route.routeDetails || {};
  const classRows = (details.roadClasses || []).map(item => `
    <div class="road-class-row"><span>${esc(String(item.name).replaceAll("_", " "))}</span><div><i style="width:${Math.min(100, Math.max(0, item.share * 100)).toFixed(1)}%"></i></div><b>${formatRouteDistance(item.distanceMeters, unit)}</b></div>`).join("");
  const namedRoads = (details.namedRoads || []).slice(0, 5).map(item => `<li><span>${esc(item.name)}</span><b>${formatRouteDistance(item.distanceMeters, unit)}</b></li>`).join("");
  const surfaces = (details.surfaces || []).map(item => `<li><span>${esc(String(item.name).replaceAll("_", " "))}</span><b>${formatRouteDistance(item.distanceMeters, unit)}</b></li>`).join("");
  const segments = (details.segments || []).map((step, index) => {
    const road = step.roadName ? ` · ${esc(step.roadName)}` : "";
    return `<li class="route-step"><span class="route-step-index">${index + 1}</span><div><b>${esc(step.instruction)}</b><small>${formatRouteDistance(step.distanceMeters || 0, unit)}${road}</small></div></li>`;
  }).join("");
  const countries = (details.countries || []).map(code => new Intl.DisplayNames(["en"], { type: "region" }).of(code)).join(", ");
  const mapMarkup = details.mapImageDataUrl
    ? `<img class="route-map-image" src="${esc(details.mapImageDataUrl)}" alt="Road map from ${esc(originName)} to ${esc(destinationName)}" loading="eager"/>`
    : `<div class="route-map-fallback">${esc(details.mapError || "A road map is not available for this saved route.")}</div>`;
  const topRoads = (details.namedRoads || []).slice(0, 3).map(item => `<span class="route-road-pill">${esc(item.name)}</span>`).join("");
  return `<section class="route-detail-panel">
    <div class="route-detail-heading"><div><div class="eyebrow">ROUTE MAP</div><h4>${esc(originName)} → ${esc(destinationName)}</h4></div><span class="mini-pill">${esc(route.profile || "truck")} profile</span></div>
    <figure class="route-map-frame">${mapMarkup}<figcaption><span>A · ${esc(originName)}</span><span>B · ${esc(destinationName)}</span></figcaption></figure>
    <div class="route-quick-summary"><span>${esc(countries || "Countries unavailable")}</span><span>${details.hasTolls ? "Tolls on route" : "No tolls reported"}</span><span>${esc(details.trafficModel || "Traffic model unavailable")} traffic</span></div>
    ${topRoads ? `<div class="route-major-roads"><small>MAIN ROADS</small><div>${topRoads}</div></div>` : ""}
    <details class="route-data-more"><summary>More route details</summary>
      <div class="route-detail-columns"><div><h5>Road classes</h5>${classRows || "<p class=\"field-help\">Not returned</p>"}</div><div><h5>Road surfaces</h5><ul class="named-road-list">${surfaces || "<li>Not returned</li>"}</ul></div></div>
      <div class="route-detail-columns"><div><h5>Major roads</h5><ul class="named-road-list">${namedRoads || "<li>Not returned</li>"}</ul></div><div><h5>Route profile</h5><p class="field-help">40 t gross / 4.1 m modeled height. Approximated traffic is not live, and the profile is not a vehicle-specific clearance.</p><p class="field-help">${formatNum(details.segmentCount || 0)} grouped road stretches from ${formatNum(details.providerSegmentCount || 0)} source records.</p></div></div>
      ${(details.segments || []).length ? `<details class="route-steps"><summary>Key turns · ${formatNum(details.maneuverCount || segments.length)} total</summary><ol>${segments}</ol>${details.omittedSegmentCount ? `<p class="field-help">${formatNum(details.omittedSegmentCount)} additional turns were omitted.</p>` : ""}</details>` : ""}
      <p class="field-help">Map and route data: Geoapify · OpenStreetMap contributors.</p>
    </details>
  </section>`;
}
function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter(item => validateMission(item).length === 0).slice(0, 30) : [];
  } catch { return []; }
}
function saveHistory() {
  try {
    const persisted = history.map((mission, index) => {
      const routeDetails = mission.route?.routeDetails;
      if (index < 5 || !routeDetails?.mapImageDataUrl) return mission;
      return { ...mission, route: { ...mission.route, routeDetails: { ...routeDetails, mapImageDataUrl: null } } };
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(persisted));
  }
  catch { showToast("Scenario created, but browser storage is unavailable."); }
}
async function postJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "The data provider request failed.");
  return payload;
}

async function searchPlaces(kind) {
  const query = $(`#${kind}Query`).value.trim();
  const button = $(`#search${kind[0].toUpperCase()}${kind.slice(1)}`);
  const select = $(`#${kind}Place`);
  const status = $(`#${kind}Status`);
  selectedPlaces[kind] = null;
  select.disabled = true;
  select.replaceChildren(new Option("Searching…", ""));
  status.textContent = "Searching Geoapify for a real location…";
  button.disabled = true;
  try {
    const payload = await postJson("/api/places", { query });
    const results = payload.results || [];
    select.replaceChildren(new Option(results.length ? "Choose the exact result" : "No matching results", ""));
    results.forEach((place, index) => {
      const location = [place.city, place.region, place.country].filter(Boolean).join(", ");
      const label = `${place.name}${location ? ` — ${location}` : ""}${place.resultType ? ` · ${place.resultType}` : ""}`;
      select.add(new Option(label, String(index)));
    });
    select.dataset.results = JSON.stringify(results);
    select.disabled = results.length === 0;
    status.textContent = results.length
      ? `${results.length} source result${results.length === 1 ? "" : "s"}. Select one to confirm.`
      : "No place was returned for this search. Try a more specific city, address, or business name.";
  } catch (error) {
    select.replaceChildren(new Option("Search unavailable", ""));
    status.textContent = error.message;
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
}

async function searchCompany(kind) {
  const company = COMPANY_DIRECTORY.find(item => item.id === $("#companyPreset").value);
  if (!company) {
    showToast("Choose a company search suggestion first.");
    return;
  }
  const disclosure = $(".manual-location-settings");
  disclosure.open = true;
  selectedCompanyHints[kind] = company;
  $(`#${kind}Query`).value = company.query;
  await searchPlaces(kind);
}

function selectPlace(kind) {
  const select = $(`#${kind}Place`);
  const value = select.value;
  if (value === "") { selectedPlaces[kind] = null; return; }
  try {
    const results = JSON.parse(select.dataset.results || "[]");
    selectedPlaces[kind] = results[Number(value)] || null;
    const place = selectedPlaces[kind];
    $(`#${kind}Status`).textContent = place
      ? `Selected source record: ${place.address} · ${place.sourceName}`
      : "Choose a valid search result.";
  } catch {
    selectedPlaces[kind] = null;
    $(`#${kind}Status`).textContent = "Search again to refresh the source results.";
  }
}

async function loadCityCatalog() {
  const status = $("#catalogStatus");
  try {
    const response = await fetch("/src/data/geonames-cities.json", { cache: "force-cache" });
    if (!response.ok) throw new Error("The real-city catalog could not be loaded.");
    cityCatalog = await response.json();
    updateCatalogStatus();
  } catch (error) {
    status.textContent = "Random city catalog unavailable. Manual location search is still available.";
    showToast(error.message);
  }
}

function updateCatalogStatus() {
  if (!cityCatalog) return;
  const world = getWorld();
  const count = cityCatalog.cities.filter(city => city.worlds?.includes(world)).length;
  $("#catalogStatus").textContent = `${formatNum(count)} sourced city records available for ${world} · GeoNames CC BY 4.0`;
}

async function generateMission({ forceRandom = false } = {}) {
  const hasManualOrigin = Boolean(selectedPlaces.origin);
  const hasManualDestination = Boolean(selectedPlaces.destination);
  if (!forceRandom && hasManualOrigin !== hasManualDestination) {
    showToast("Choose both manual locations, or clear them to use random locations.");
    return;
  }
  const useManual = !forceRandom && hasManualOrigin && hasManualDestination;
  const submit = $(".generate-btn");
  submit.disabled = true;
  submit.setAttribute("aria-busy", "true");
  try {
    let origin = useManual ? selectedPlaces.origin : null;
    let destination = useManual ? selectedPlaces.destination : null;
    let cargoId = $("#cargo").value;
    const equipmentId = $("#equipment").value;
    let freightLane = null;
    let route = null;
    if (!useManual) {
      const lanes = FREIGHT_LANES.filter(lane => lane.world === getWorld()
        && (cargoId === "random" || lane.cargoIds.includes(cargoId))
        && (equipmentId === "random" || lane.cargoIds.some(id => CARGO[id]?.equipmentIds.includes(equipmentId))));
      const requestedLane = getFreightLane($("#freightLane").value);
      if (requestedLane) {
        if (!lanes.some(lane => lane.id === requestedLane.id)) {
          throw new Error("The selected corridor is not compatible with this cargo and trailer. Choose another corridor or a random cargo/trailer.");
        }
        freightLane = requestedLane;
      } else if (lanes.length) {
        freightLane = lanes[Math.floor(Math.random() * lanes.length)];
      } else {
        const pair = chooseRandomCityPair({ world: getWorld(), cityCatalog });
        origin = pair.origin;
        destination = pair.destination;
      }
      if (freightLane && cargoId === "random") {
        const compatibleCargo = freightLane.cargoIds.filter(id => CARGO[id]
          && (equipmentId === "random" || CARGO[id].equipmentIds.includes(equipmentId)));
        if (!compatibleCargo.length) throw new Error("No cargo in this corridor matches the selected trailer.");
        cargoId = compatibleCargo[Math.floor(Math.random() * compatibleCargo.length)];
      }
      if (freightLane) {
        if (!cityCatalog) throw new Error("The real-city catalog is still loading. Try again shortly.");
        const locate = point => cityCatalog.cities.find(city =>
          city.name === point.city && city.countryCode === point.countryCode && city.worlds?.includes(getWorld()));
        const originCity = locate(freightLane.origin);
        const destinationCity = locate(freightLane.destination);
        if (!originCity || !destinationCity) throw new Error(`The city catalog does not contain both locations for ${freightLane.label}.`);
        origin = toSourcedPlace(originCity, cityCatalog.metadata?.importedAt);
        destination = toSourcedPlace(destinationCity, cityCatalog.metadata?.importedAt);
      }
    }
    route = await postJson("/api/truck-route", {
      origin: { lat: origin.lat, lon: origin.lon },
      destination: { lat: destination.lat, lon: destination.lon },
    });
    const mission = buildMission({ world: getWorld(), origin, destination, route, cargoId, equipmentId, now: new Date() });
    mission.locationSelection = useManual ? "manual-geocoding" : freightLane ? "freight-corridor" : "random-geonames";
    if (freightLane) mission.freightLane = freightLane;
    mission.companySearchHints = useManual
      ? [selectedCompanyHints.origin, selectedCompanyHints.destination].filter(Boolean)
      : [];
    const errors = validateMission(mission);
    if (errors.length) throw new Error(`Scenario data error: ${errors.join(" ")}`);
    history.unshift(mission);
    if (history.length > 30) history.pop();
    saveHistory();
    renderMission(mission);
    $("#historyCount").textContent = history.length;
    showToast(useManual
      ? "Manual locations routed. Freight assignment is a generated scenario."
      : freightLane
        ? "Illustrative freight corridor routed with the selected cargo and trailer."
        : "General real-city route generated; no curated corridor matched this cargo and trailer.");
  } catch (error) {
    showToast(error.message);
  } finally {
    submit.disabled = false;
    submit.removeAttribute("aria-busy");
  }
}

function renderMission(mission) {
  $("#emptyState").classList.add("hidden");
  const out = $("#missionOutput");
  out.classList.remove("hidden");
  const mode = WORLD_MODES[mission.world];
  const routeUrl = safeHref(mission.route.sourceUrl, "https://apidocs.geoapify.com/docs/routing/");
  const placeUrl = "https://apidocs.geoapify.com/docs/geocoding/";
  const originUrl = safeHref(mission.origin.sourceUrl, placeUrl);
  const destinationUrl = safeHref(mission.destination.sourceUrl, placeUrl);
  const hours = Math.floor(mission.route.durationSeconds / 3600);
  const minutes = Math.round((mission.route.durationSeconds % 3600) / 60);
  out.innerHTML = `
    <div class="mission-banner">
      <div class="mission-id">${esc(mission.id)} · ${esc(mode.label)} · ${mission.locationSelection === "manual-geocoding" ? "MANUAL PLACES" : mission.freightLane ? "ILLUSTRATIVE FREIGHT CORRIDOR" : "RANDOM GEONAMES DRAW"}</div>
      <div class="mission-route">
        <div><small>ORIGIN · SOURCE PLACE</small><strong>${esc(mission.origin.name)}</strong><span class="location-address">${esc(mission.origin.address)}</span></div>
        <div class="route-arrow">→</div>
        <div><small>DESTINATION · SOURCE PLACE</small><strong>${esc(mission.destination.name)}</strong><span class="location-address">${esc(mission.destination.address)}</span></div>
      </div>
      <div class="mission-tags"><span class="tag">${esc(mission.cargo.name)}</span><span class="tag">${esc(mission.equipment.name)} · suggested</span><span class="tag">GENERATED SCENARIO</span></div>
    </div>
    ${renderLaneDetails(mission.freightLane)}
    <div class="mission-metrics">
      <div class="metric"><b>${formatNum(mission.route.distance)} ${mission.route.unit}</b><small>TRUCK ROUTE · GEOAPIFY</small></div>
      <div class="metric"><b>${hours}h ${minutes}m</b><small>ROUTED DURATION · GEOAPIFY</small></div>
      <div class="metric"><b>Not assigned</b><small>LOAD WEIGHT</small></div>
    </div>
    ${renderRoadDetails(mission.route, mission.route.unit, mission.origin.name, mission.destination.name)}
    ${renderCargoDetails(mission.cargo)}
    ${renderEquipmentDetails(mission.equipment)}
    ${renderCompanyHints(mission.companySearchHints)}
    <div class="mission-section"><h4>DATA SOURCES</h4><p>Origin record: <a href="${esc(originUrl)}" target="_blank" rel="noopener">${esc(mission.origin.sourceName)}</a>. Destination record: <a href="${esc(destinationUrl)}" target="_blank" rel="noopener">${esc(mission.destination.sourceName)}</a>. Attribution: ${esc(mission.origin.attribution || "Geoapify")}. Retrieved ${esc(new Date(mission.origin.retrievedAt || mission.createdAt).toLocaleString())}. Route: <a href="${esc(routeUrl)}" target="_blank" rel="noopener">Geoapify Routing API</a> · ${esc(mission.route.profile || "truck")} profile · retrieved ${esc(new Date(mission.route.retrievedAt).toLocaleString())}.</p></div>
    <div class="mission-section"><h4>REAL-WORLD LIMITS</h4><p>The truck profile returns a routed distance and duration, but this route is not confirmed for a specific truck, trailer, cargo, road restriction, appointment, or driver-hours rule. Confirm the actual vehicle dimensions, gross weight, permits, facility access, cargo requirements, and route before dispatch.</p></div>
    <div class="output-actions"><button class="primary" id="printReport">↧ EXPORT / PRINT REPORT</button><button id="regenerate">⟳ NEW SCENARIO</button></div>
    <p class="form-note">A real place or route result does not mean a real booking. Geoapify-provided place attributes are linked to their source where available.</p>`;
  $("#printReport").addEventListener("click", () => printMission(mission));
  $("#regenerate").addEventListener("click", () => generateMission({ forceRandom: true }));
}

function printMission(mission) {
  const win = window.open("", "_blank");
  if (!win) { showToast("Pop-up blocked. Allow pop-ups to print the scenario."); return; }
  const mode = WORLD_MODES[mission.world];
  const duration = `${Math.floor(mission.route.durationSeconds / 3600)}h ${Math.round((mission.route.durationSeconds % 3600) / 60)}m`;
  const laneSources = (mission.freightLane?.sourceIds || []).map(id => NETWORK_SOURCES[id]).filter(Boolean);
  const laneCompanies = (mission.freightLane?.companyIds || []).map(id => COMPANY_DIRECTORY.find(company => company.id === id)).filter(Boolean);
  const companyHints = (mission.companySearchHints || []).map(item => COMPANY_DIRECTORY.find(company => company.id === item?.id)).filter(Boolean);
  win.document.write(`<!doctype html><html><head><title>${esc(mission.id)} Freight Scenario</title><style>
    body{font:14px Arial,sans-serif;color:#17212a;margin:36px;line-height:1.5}header{background:#17212a;color:white;padding:25px;border-bottom:7px solid #f28c28}h1{margin:0;font-size:28px}header p{color:#d6dee4}.route{display:grid;grid-template-columns:1fr 30px 1fr;gap:12px;background:#f1f3f4;padding:18px;margin:18px 0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.card{border:1px solid #ddd;padding:12px}.muted{color:#687681;font-size:12px}.warning{background:#fff2dd;padding:12px;border-left:4px solid #f28c28}h2{font-size:15px;color:#b8641c;border-bottom:1px solid #ddd;padding-bottom:6px;margin-top:26px}.route-map-print{width:100%;max-height:420px;object-fit:contain;border:1px solid #ddd;border-radius:6px}.map-attribution{font-size:10px;color:#687681}</style></head><body>
    <header><div style="color:#ffc45b;font-size:11px;font-weight:bold;letter-spacing:2px">FREIGHT OPERATIONS SIMULATOR</div><h1>GENERATED FREIGHT SCENARIO</h1><p>${esc(mission.id)} · ${esc(mode.label)} · ${esc(new Date(mission.createdAt).toLocaleString())}</p></header>
    <div class="route"><div><small>ORIGIN</small><h2>${esc(mission.origin.name)}</h2><p>${esc(mission.origin.address)}</p></div><div>→</div><div><small>DESTINATION</small><h2>${esc(mission.destination.name)}</h2><p>${esc(mission.destination.address)}</p></div></div>
    ${mission.route.routeDetails?.mapImageDataUrl ? `<img class="route-map-print" src="${esc(mission.route.routeDetails.mapImageDataUrl)}" alt="Map from ${esc(mission.origin.name)} to ${esc(mission.destination.name)}"/><p class="map-attribution">Map: Geoapify · © OpenStreetMap contributors</p>` : ""}
    <div class="grid"><div class="card"><small>GENERATED FREIGHT CATEGORY</small><h3>${esc(mission.cargo.name)}</h3></div><div class="card"><small>SUGGESTED EQUIPMENT</small><h3>${esc(mission.equipment.name)}</h3></div><div class="card"><small>TRUCK ROUTE</small><h3>${formatNum(mission.route.distance)} ${mission.route.unit} · ${duration}</h3></div></div>
    ${mission.freightLane ? `<h2>Illustrative freight corridor</h2><p><b>${esc(mission.freightLane.label)}</b></p><p>${esc(mission.freightLane.rationale)}</p>${laneSources.length ? `<p>Background sources: ${laneSources.map(source => `<a href="${esc(safeHref(source.url, "#"))}">${esc(source.name)}</a>`).join(" · ")}</p>` : ""}${laneCompanies.length ? `<p>Relevant real brands to explore, not route parties: ${laneCompanies.map(company => `<a href="${esc(safeHref(company.website, "#"))}">${esc(company.name)}</a>`).join(" · ")}</p>` : ""}` : ""}
    <h2>Cargo detail</h2><p>${esc(mission.cargo.description)} Typical form: ${esc(mission.cargo.loadForm)}. ${esc(mission.cargo.temperature || "")}</p>
    ${mission.cargo.varietyExamples?.length ? `<p>Examples / varieties: ${mission.cargo.varietyExamples.map(esc).join(", ")}</p>` : ""}
    ${mission.cargo.handling?.length ? `<ul>${mission.cargo.handling.map(item => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}
    <h2>Trailer profile</h2><p>${esc(mission.equipment.uses || "")}</p>
    ${(mission.equipment.variants || []).length ? `<ul>${mission.equipment.variants.map(item => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}
    ${(mission.equipment.checks || []).length ? `<p>Checks: ${mission.equipment.checks.map(esc).join("; ")}</p>` : ""}
    ${companyHints.length ? `<h2>Company search suggestions</h2><ul>${companyHints.map(company => `<li><a href="${esc(safeHref(company.website, "#"))}">${esc(company.name)}</a> · ${esc(company.sector)}. Search inspiration only; the selected place is not verified as company-owned or operated.</li>`).join("")}</ul>` : ""}
    <h2>Route summary</h2><p>${esc((mission.route.routeDetails?.namedRoads || []).slice(0, 3).map(road => road.name).join(" · ") || "Main road names were not returned")}. ${esc((mission.route.routeDetails?.countries || []).join(" → ") || "Route countries unavailable")}. Tolls: ${mission.route.routeDetails?.hasTolls ? "reported" : "not reported"}; estimated traffic is approximated, not live.</p>
    <h2>Sources & limits</h2><p>Locations, road route, and map are provider data from Geoapify/OpenStreetMap. The heavy-truck profile models up to 40 t gross and 4.1 m height; it is not a specific vehicle clearance. Confirm dimensions, payload, permits, restrictions, facility access, and driver-hours rules before use.</p>
    <div class="warning"><b>GENERATED SCENARIO — NOT A SHIPMENT</b><br>No commercial relationship, contract, booking, cargo weight, or dispatch authorization is represented.</div>
    <script>window.onload=()=>window.print()</script></body></html>`);
  win.document.close();
}

$("#missionForm").addEventListener("submit", event => { event.preventDefault(); generateMission(); });
populateCompanyDirectory();
populateLaneOptions();
$("#searchOrigin").addEventListener("click", () => searchPlaces("origin"));
$("#searchDestination").addEventListener("click", () => searchPlaces("destination"));
$("#companyOrigin").addEventListener("click", () => searchCompany("origin"));
$("#companyDestination").addEventListener("click", () => searchCompany("destination"));
$("#originPlace").addEventListener("change", () => selectPlace("origin"));
$("#destinationPlace").addEventListener("change", () => selectPlace("destination"));
$("#freightLane").addEventListener("change", () => {
  populateCargoOptions();
  updateLaneStatus();
});
$("#cargo").addEventListener("change", () => {
  populateEquipmentOptions();
  populateLaneOptions();
});
$("#equipment").addEventListener("change", () => {
  populateLaneOptions();
});
$$('input[name="world"]').forEach(input => input.addEventListener("change", () => {
  populateCompanyDirectory();
  populateLaneOptions();
  updateCatalogStatus();
}));
for (const kind of ["origin", "destination"]) {
  $(`#${kind}Query`).addEventListener("input", () => {
    selectedPlaces[kind] = null;
    selectedCompanyHints[kind] = null;
    $(`#${kind}Place`).disabled = true;
    $(`#${kind}Status`).textContent = "Search again after editing this query.";
  });
}
$("#historyNav").addEventListener("click", () => {
  if (!history.length) { showToast("No saved scenarios yet. Generate a random route or choose manual places."); return; }
  renderMission(history[0]);
  showToast(`Showing latest of ${history.length} saved scenarios.`);
});
$("#databaseNav").addEventListener("click", () => $("#coverage").scrollIntoView({ behavior: "smooth", block: "center" }));
$("#historyCount").textContent = history.length;
loadCityCatalog();
