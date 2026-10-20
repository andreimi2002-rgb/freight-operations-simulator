import { loadLanguage, t } from "./i18n/i18n.mjs";
import { GenerationError, generateLoad } from "./engine/generator.mjs";
import { validateLoad } from "./engine/load-model.mjs";
import { RouteAnswerError } from "./engine/route.mjs";
import { RouteServiceError, createGeoapifyRouter } from "./adapters/routing-geoapify.mjs";
import { createRouteMap } from "./adapters/map-maplibre.mjs";
import { buildLoadSheet, buildRecentEntry } from "./view-model/load-sheet.mjs";
import { levelLabel } from "./view-model/provenance.mjs";
import { $, applyStaticTranslations, showToast } from "./ui/dom.mjs";
import { closeLayer, openLayer, wireLayer } from "./ui/layers.mjs";
import { emptyHeroHtml, heroHtml } from "./ui/hero.mjs";
import { cargoCardHtml, detailHtml, kpisHtml, legendHtml, recentHtml, sheetHtml, warningsHtml } from "./ui/panels.mjs";
import { createGenerator } from "./ui/generator.mjs";
import { createPalette } from "./ui/palette.mjs";
import { aboutHtml } from "./ui/about.mjs";
import { printHtml } from "./ui/print.mjs";
import { VERSION } from "./version.mjs";
import { activeCountries } from "./data/countries.mjs";

// New key for the phase 1B Load model; the phase 1A history (fos-mission-history-v3) is left untouched.
const HISTORY_KEY = "fos-load-history-v1";
const MAX_HISTORY = 30;

const router = createGeoapifyRouter();
let history = [];
let current = null;
let sheet = null;
let catalog = null; // { metadata, cities }
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
    return Array.isArray(saved) ? saved.filter(item => validateLoad(item).length === 0).slice(0, MAX_HISTORY) : [];
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
  $("#warnings").innerHTML = warningsHtml(sheet);
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
function errorMessage(error) {
  if (error instanceof RouteServiceError) {
    if (error.status === 503) return t("toast.routeNotConfigured");
    if (error.status === 429) return t("toast.routeRateLimited");
    return t("toast.routeFailed");
  }
  if (error instanceof RouteAnswerError) return t("toast.routeFailed");
  if (error instanceof GenerationError) {
    if (error.code === "noCargo") return t("toast.noCargo");
    if (error.code === "noPair") return t("toast.noPair");
    console.error(error.message); // invalidLoad: details for developers
    return t("toast.invalidLoad");
  }
  console.error(error);
  return t("toast.routeFailed");
}

function setBusy(on) {
  busy = on;
  generator.setBusy(on);
  const button = $("#generateBtn");
  button.disabled = on;
  if (on) button.setAttribute("aria-busy", "true"); else button.removeAttribute("aria-busy");
}

async function generate({ originCity = null, destinationCity = null, family = "all", cargoId = "random", equipmentId = "random" } = {}) {
  if (busy) return;
  if (!catalog) { showToast(t("toast.noCatalog"), { error: true }); return; }
  setBusy(true);
  try {
    const load = await generateLoad({
      cities: catalog.cities, importedAt: catalog.metadata.importedAt, router,
      originCity, destinationCity, family, cargoId, equipmentId, now: new Date(),
    });
    history.unshift(load);
    history = history.slice(0, MAX_HISTORY);
    const saved = saveHistory();
    current = load;
    closeLayer($("#generatorLayer"));
    renderAll();
    showToast(saved ? t("toast.generated") : t("toast.storageUnavailable"));
  } catch (error) {
    showToast(errorMessage(error), { error: true });
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
  if (!catalog) { showToast(t("toast.noCatalog"), { error: true }); return; }
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

async function loadCatalog() {
  try {
    const files = await Promise.all(activeCountries().map(async country => {
      const response = await fetch(`/src/data/${country.cityFile}`, { cache: "force-cache" });
      if (!response.ok) throw new Error(country.code);
      return response.json();
    }));
    // each city keeps the import date of its own country file (shown as the retrieval date of the source)
    const cities = files.flatMap(file => file.cities.map(city => ({ ...city, importedAt: file.metadata.importedAt })));
    catalog = { metadata: files[0].metadata, cities };
    generator.setStatus(t("gen.catalogReady", { count: cities.length }));
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
    const load = history.find(item => item.id === chip.dataset.recent);
    if (load) { current = load; renderAll(); }
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
    getCities: () => catalog?.cities || [],
    onPick: onCityPicked,
  });
  wireEvents();
  generator.setStatus(t("gen.catalogLoading"));
  history = loadHistory();
  current = history[0] || null;
  renderAll();
  loadCatalog();
}

start();
