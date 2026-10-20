import { chooseRandomCityPair, generateMission as buildMission, toSourcedPlace, validateMission } from "./mission-engine.mjs";
import { loadLanguage, t } from "./i18n/i18n.mjs";
import { inScope, scopeCities } from "./data/scope.mjs";
import { drawCounterpart } from "./data/selection.mjs";
import { buildLoadSheet, buildRecentEntry } from "./view-model/load-sheet.mjs";
import { levelLabel } from "./view-model/provenance.mjs";
import { createRouteMap } from "./map/route-map.mjs";
import { $, applyStaticTranslations, esc, showToast } from "./ui/dom.mjs";
import { closeLayer, openLayer, wireLayer } from "./ui/layers.mjs";
import { emptyHeroHtml, heroHtml } from "./ui/hero.mjs";
import { cargoCardHtml, detailHtml, kpisHtml, legendHtml, recentHtml, sheetHtml } from "./ui/panels.mjs";
import { createGenerator } from "./ui/generator.mjs";
import { createPalette } from "./ui/palette.mjs";
import { aboutHtml } from "./ui/about.mjs";
import { printHtml } from "./ui/print.mjs";
import { VERSION } from "./version.mjs";

const HISTORY_KEY = "fos-mission-history-v3";
const MAX_HISTORY = 30;
const WORLD = "ETS2"; // internal engine setting until phase 1B removes the world modes

let history = [];
let current = null;
let sheet = null;
let pool = null; // RO/HU/BG cities
let busy = false;
let pickSlot = null; // which generator field the palette is filling (null: from the top bar)
let lastSnapshot = null;
let generator = null;
let palette = null;
let routeMap = null;

// ---------- history (localStorage; every access guarded) ----------
function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved
      .filter(item => validateMission(item).length === 0 && inScope(item.origin) && inScope(item.destination))
      .map(item => (item.route?.routeDetails?.mapImageDataUrl ? { ...item, route: { ...item.route, routeDetails: { ...item.route.routeDetails, mapImageDataUrl: null } } } : item))
      .slice(0, MAX_HISTORY);
  } catch { return []; }
}
function saveHistory() {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); return true; } catch { return false; }
}

// ---------- rendering ----------
function renderRecent() {
  $("#recent").innerHTML = recentHtml(history.slice(0, 8).map(buildRecentEntry), current?.id);
}

function renderAll() {
  renderRecent();
  const results = $("#results");
  if (!current) {
    sheet = null;
    $("#hero").innerHTML = emptyHeroHtml();
    results.hidden = true;
    return;
  }
  sheet = buildLoadSheet(current);
  $("#hero").innerHTML = heroHtml(sheet);
  $("#cargoCard").innerHTML = cargoCardHtml(sheet);
  $("#kpis").innerHTML = kpisHtml(sheet);
  $("#legend").innerHTML = legendHtml(sheet);
  $("#sheet").innerHTML = sheetHtml(sheet);
  results.hidden = false;
  showFixtureBanner(sheet.fixture);
  const shown = sheet;
  lastSnapshot = null;
  routeMap.show(sheet.map).then(() => routeMap.snapshot()).then(image => { if (sheet === shown) lastSnapshot = image; });
}

function showFixtureBanner(on) {
  let banner = $("#fixtureBanner");
  if (!on) { banner?.remove(); return; }
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "fixtureBanner";
    banner.className = "fixture-banner";
    $("#mapCard").append(banner);
  }
  banner.textContent = t("ui.fixtureNotice");
}

// ---------- detail drawer ----------
function openDetail(rowId, opener) {
  const row = sheet?.rows.find(item => item.id === rowId);
  if (!row) return;
  $("#detailBody").innerHTML = detailHtml(row);
  const badge = $("#detailBadge");
  badge.className = `badge lv-${row.level}`;
  badge.textContent = levelLabel(row.level);
  $("#sheet").querySelectorAll(".frow").forEach(el => el.classList.toggle("sel", el.dataset.row === rowId));
  openLayer($("#detailLayer"), { opener, onClose: () => $("#sheet").querySelectorAll(".frow.sel").forEach(el => el.classList.remove("sel")) });
}

// ---------- generation ----------
class RouteError extends Error { constructor(message, status) { super(message); this.status = status; } }
async function fetchRoute(origin, destination) {
  let response;
  try {
    response = await fetch("/api/truck-route", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ origin: { lat: origin.lat, lon: origin.lon }, destination: { lat: destination.lat, lon: destination.lon } }),
    });
  } catch { throw new RouteError(t("toast.routeFailed"), 0); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = response.status === 503 ? t("toast.routeNotConfigured") : response.status === 429 ? t("toast.routeRateLimited") : t("toast.routeFailed");
    throw new RouteError(message, response.status);
  }
  return payload;
}

function setBusy(on) {
  busy = on;
  generator.setBusy(on);
  const button = $("#generateBtn");
  button.disabled = on;
  if (on) button.setAttribute("aria-busy", "true"); else button.removeAttribute("aria-busy");
}

async function generate({ originCity = null, destinationCity = null, cargoId = "random", equipmentId = "random" } = {}) {
  if (busy) return;
  if (!pool) { showToast(t("toast.noCatalog"), { error: true }); return; }
  if (cargoId === null) { showToast(t("toast.noCargo"), { error: true }); return; }
  setBusy(true);
  try {
    let originPick = originCity;
    let destinationPick = destinationCity;
    if (originPick && !destinationPick) destinationPick = drawCounterpart(pool.cities, originPick);
    else if (destinationPick && !originPick) originPick = drawCounterpart(pool.cities, destinationPick);
    const importedAt = pool.metadata?.importedAt;
    let origin; let destination;
    if (originPick && destinationPick) {
      origin = toSourcedPlace(originPick, importedAt);
      destination = toSourcedPlace(destinationPick, importedAt);
    } else if (originCity || destinationCity) {
      throw new Error(t("toast.noPair"));
    } else {
      ({ origin, destination } = chooseRandomCityPair({ world: WORLD, cityCatalog: pool }));
    }
    const route = await fetchRoute(origin, destination);
    const mission = buildMission({ world: WORLD, origin, destination, route, cargoId, equipmentId, now: new Date() });
    mission.locationSelection = originCity || destinationCity ? "picked-geonames" : "random-geonames";
    const errors = validateMission(mission);
    if (errors.length) throw new Error(t("toast.dataError", { message: errors.join(" ") }));
    history.unshift(mission);
    history = history.slice(0, MAX_HISTORY);
    const saved = saveHistory();
    current = mission;
    closeLayer($("#generatorLayer"));
    renderAll();
    showToast(saved ? t("toast.generated") : t("toast.storageUnavailable"));
  } catch (error) {
    showToast(error instanceof RouteError ? error.message : (error.message || t("toast.routeFailed")), { error: true });
  } finally {
    setBusy(false);
  }
}

// ---------- print ----------
async function printReport() {
  if (!sheet) return;
  const mine = sheet;
  showToast(t("print.prepare"));
  const image = (await routeMap.snapshot()) || lastSnapshot;
  if (sheet !== mine) return;
  const target = $("#printSheet");
  target.innerHTML = printHtml(sheet, image);
  const img = target.querySelector("img");
  if (img) await img.decode().catch(() => {});
  window.print();
}

// ---------- setup ----------
function openGenerator(opener) { openLayer($("#generatorLayer"), { opener }); }

function openPalette({ slot = null, opener = document.activeElement } = {}) {
  if (!pool) { showToast(t("toast.noCatalog"), { error: true }); return; }
  pickSlot = slot;
  const cities = generator.cities();
  const other = slot ? cities[slot === "origin" ? "destination" : "origin"] : null;
  palette.open({ mode: slot, excludeId: other?.id ?? null, opener });
}

function onCityPicked(city) {
  const cities = generator.cities();
  const slot = pickSlot || (!cities.origin ? "origin" : !cities.destination ? "destination" : "origin");
  generator.setCity(slot, city);
  if (!pickSlot) openGenerator($("#searchBtn"));
}

async function loadCityPool() {
  try {
    const response = await fetch("/src/data/geonames-cities.json", { cache: "force-cache" });
    if (!response.ok) throw new Error("catalog");
    pool = scopeCities(await response.json());
    generator.setStatus(t("gen.catalogReady", { count: pool.cities.length }));
  } catch {
    generator.setStatus(t("gen.catalogError"));
    showToast(t("gen.catalogError"), { error: true });
  }
}

function wireEvents() {
  for (const id of ["detailLayer", "generatorLayer", "aboutLayer"]) wireLayer($(`#${id}`));
  $("#generateBtn").addEventListener("click", () => generate());
  $("#newLoadBtn").addEventListener("click", event => openGenerator(event.currentTarget));
  $("#aboutBtn").addEventListener("click", event => openLayer($("#aboutLayer"), { opener: event.currentTarget }));
  $("#searchBtn").addEventListener("click", event => openPalette({ opener: event.currentTarget }));
  $("#printBtn").addEventListener("click", printReport);
  $("#sheet").addEventListener("click", event => {
    const row = event.target.closest("[data-row]");
    if (row) openDetail(row.dataset.row, row);
  });
  $("#recent").addEventListener("click", event => {
    const chip = event.target.closest("[data-recent]");
    if (!chip) return;
    const mission = history.find(item => item.id === chip.dataset.recent);
    if (mission) { current = mission; renderAll(); }
  });
  $("#hero").addEventListener("click", event => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "generate") generate();
    if (action === "new-load") openGenerator(event.target.closest("[data-action]"));
  });
  document.addEventListener("keydown", event => {
    const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "");
    if (!typing && (event.key === "/" || (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)))) {
      event.preventDefault();
      openPalette({ opener: $("#searchBtn") });
    }
  });
  // Ctrl+P / browser print menu: make sure the print sheet reflects the load on screen.
  window.addEventListener("beforeprint", () => { if (sheet) $("#printSheet").innerHTML = printHtml(sheet, lastSnapshot); });
}

async function start() {
  try { await loadLanguage("ro"); } catch {
    document.body.textContent = "Translations could not be loaded.";
    return;
  }
  document.title = `${t("brand.name")} · ${t("brand.tagline")}`;
  applyStaticTranslations();
  $("#versionLabel").textContent = t("footer.version", { version: VERSION });
  $("#aboutBody").innerHTML = aboutHtml();
  routeMap = createRouteMap({ container: $("#routeMap"), statusElement: $("#mapStatus") });
  generator = createGenerator({
    body: $("#generatorBody"),
    onSubmit: generate,
    onPick: (slot, opener) => openPalette({ slot, opener }),
  });
  palette = createPalette({
    layer: $("#paletteLayer"),
    input: $("#paletteInput"),
    list: $("#paletteList"),
    modeElement: $("#paletteMode"),
    getCities: () => pool?.cities || [],
    onPick: onCityPicked,
  });
  wireEvents();
  generator.setStatus(t("gen.catalogLoading"));
  history = loadHistory();
  current = history[0] || null;
  renderAll();
  loadCityPool();
}

start();
