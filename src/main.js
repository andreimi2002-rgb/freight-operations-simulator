import { generateMission as buildMission, validateMission, WORLD_MODES } from "./mission-engine.mjs";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const HISTORY_KEY = "fos-mission-history-v3";
let history = loadHistory();
const selectedPlaces = { origin: null, destination: null };

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
function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter(item => validateMission(item).length === 0).slice(0, 30) : [];
  } catch { return []; }
}
function saveHistory() {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }
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

async function generateMission() {
  const origin = selectedPlaces.origin;
  const destination = selectedPlaces.destination;
  if (!origin || !destination) {
    showToast("Search for and select an exact origin and destination first.");
    return;
  }
  const submit = $(".generate-btn");
  submit.disabled = true;
  submit.setAttribute("aria-busy", "true");
  submit.querySelector("span").textContent = "…";
  try {
    const route = await postJson("/api/truck-route", {
      origin: { lat: origin.lat, lon: origin.lon },
      destination: { lat: destination.lat, lon: destination.lon },
    });
    const mission = buildMission({ world: getWorld(), origin, destination, route, cargoId: $("#cargo").value });
    const errors = validateMission(mission);
    if (errors.length) throw new Error(`Scenario data error: ${errors.join(" ")}`);
    history.unshift(mission);
    if (history.length > 30) history.pop();
    saveHistory();
    renderMission(mission);
    $("#historyCount").textContent = history.length;
    showToast("Truck route loaded. Freight assignment is a generated scenario.");
  } catch (error) {
    showToast(error.message);
  } finally {
    submit.disabled = false;
    submit.removeAttribute("aria-busy");
    submit.querySelector("span").textContent = "✦";
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
      <div class="mission-id">${esc(mission.id)} · ${esc(mode.label)}</div>
      <div class="mission-route">
        <div><small>ORIGIN · SOURCE PLACE</small><strong>${esc(mission.origin.name)}</strong><span class="location-address">${esc(mission.origin.address)}</span></div>
        <div class="route-arrow">→</div>
        <div><small>DESTINATION · SOURCE PLACE</small><strong>${esc(mission.destination.name)}</strong><span class="location-address">${esc(mission.destination.address)}</span></div>
      </div>
      <div class="mission-tags"><span class="tag">${esc(mission.cargo.name)}</span><span class="tag">${esc(mission.equipment.name)} · suggested</span><span class="tag">GENERATED SCENARIO</span></div>
    </div>
    <div class="mission-metrics">
      <div class="metric"><b>${formatNum(mission.route.distance)} ${mission.route.unit}</b><small>TRUCK ROUTE · GEOAPIFY</small></div>
      <div class="metric"><b>${hours}h ${minutes}m</b><small>ROUTED DURATION · GEOAPIFY</small></div>
      <div class="metric"><b>Not assigned</b><small>LOAD WEIGHT</small></div>
    </div>
    <div class="mission-section"><h4>GENERATED FREIGHT SCENARIO</h4><p><b>${esc(mission.cargo.name)}</b> — ${esc(mission.cargo.description)}. Suggested equipment: <b>${esc(mission.equipment.name)}</b>. This pairing is a planning prompt; the app has not verified a real shipment, payload, facility capability, or commercial relationship.</p></div>
    <div class="mission-section"><h4>DATA SOURCES</h4><p>Origin record: <a href="${esc(originUrl)}" target="_blank" rel="noopener">${esc(mission.origin.sourceName)}</a>. Destination record: <a href="${esc(destinationUrl)}" target="_blank" rel="noopener">${esc(mission.destination.sourceName)}</a>. Attribution: ${esc(mission.origin.attribution || "Geoapify")}. Retrieved ${esc(new Date(mission.origin.retrievedAt || mission.createdAt).toLocaleString())}. Route: <a href="${esc(routeUrl)}" target="_blank" rel="noopener">Geoapify Routing API</a> · truck profile · retrieved ${esc(new Date(mission.route.retrievedAt).toLocaleString())}.</p></div>
    <div class="mission-section"><h4>REAL-WORLD LIMITS</h4><p>The truck profile returns a routed distance and duration, but this route is not confirmed for a specific truck, trailer, cargo, road restriction, appointment, or driver-hours rule. Confirm the actual vehicle dimensions, gross weight, permits, facility access, cargo requirements, and route before dispatch.</p></div>
    <div class="output-actions"><button class="primary" id="printReport">↧ EXPORT / PRINT REPORT</button><button id="regenerate">⟳ NEW SCENARIO</button></div>
    <p class="form-note">A real place or route result does not mean a real booking. Geoapify-provided place attributes are linked to their source where available.</p>`;
  $("#printReport").addEventListener("click", () => printMission(mission));
  $("#regenerate").addEventListener("click", generateMission);
}

function printMission(mission) {
  const win = window.open("", "_blank");
  if (!win) { showToast("Pop-up blocked. Allow pop-ups to print the scenario."); return; }
  const mode = WORLD_MODES[mission.world];
  const duration = `${Math.floor(mission.route.durationSeconds / 3600)}h ${Math.round((mission.route.durationSeconds % 3600) / 60)}m`;
  win.document.write(`<!doctype html><html><head><title>${esc(mission.id)} Freight Scenario</title><style>
    body{font:14px Arial,sans-serif;color:#17212a;margin:36px;line-height:1.5}header{background:#17212a;color:white;padding:25px;border-bottom:7px solid #f28c28}h1{margin:0;font-size:28px}header p{color:#d6dee4}.route{display:grid;grid-template-columns:1fr 30px 1fr;gap:12px;background:#f1f3f4;padding:18px;margin:18px 0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.card{border:1px solid #ddd;padding:12px}.muted{color:#687681;font-size:12px}.warning{background:#fff2dd;padding:12px;border-left:4px solid #f28c28}h2{font-size:15px;color:#b8641c;border-bottom:1px solid #ddd;padding-bottom:6px;margin-top:26px}</style></head><body>
    <header><div style="color:#ffc45b;font-size:11px;font-weight:bold;letter-spacing:2px">FREIGHT OPERATIONS SIMULATOR</div><h1>GENERATED FREIGHT SCENARIO</h1><p>${esc(mission.id)} · ${esc(mode.label)} · ${esc(new Date(mission.createdAt).toLocaleString())}</p></header>
    <div class="route"><div><small>ORIGIN</small><h2>${esc(mission.origin.name)}</h2><p>${esc(mission.origin.address)}</p></div><div>→</div><div><small>DESTINATION</small><h2>${esc(mission.destination.name)}</h2><p>${esc(mission.destination.address)}</p></div></div>
    <div class="grid"><div class="card"><small>GENERATED FREIGHT CATEGORY</small><h3>${esc(mission.cargo.name)}</h3></div><div class="card"><small>SUGGESTED EQUIPMENT</small><h3>${esc(mission.equipment.name)}</h3></div><div class="card"><small>TRUCK ROUTE</small><h3>${formatNum(mission.route.distance)} ${mission.route.unit} · ${duration}</h3></div></div>
    <h2>Source & limits</h2><p>Locations returned by Geoapify Geocoding API. Distance and duration returned by Geoapify Routing API using a truck profile. Verify vehicle dimensions, payload, permits, restrictions, facility access, and driver-hours rules before use.</p>
    <div class="warning"><b>GENERATED SCENARIO — NOT A SHIPMENT</b><br>No commercial relationship, contract, booking, cargo weight, or dispatch authorization is represented.</div>
    <script>window.onload=()=>window.print()</script></body></html>`);
  win.document.close();
}

$("#missionForm").addEventListener("submit", event => { event.preventDefault(); generateMission(); });
$("#searchOrigin").addEventListener("click", () => searchPlaces("origin"));
$("#searchDestination").addEventListener("click", () => searchPlaces("destination"));
$("#originPlace").addEventListener("change", () => selectPlace("origin"));
$("#destinationPlace").addEventListener("change", () => selectPlace("destination"));
for (const kind of ["origin", "destination"]) {
  $(`#${kind}Query`).addEventListener("input", () => {
    selectedPlaces[kind] = null;
    $(`#${kind}Place`).disabled = true;
    $(`#${kind}Status`).textContent = "Search again after editing this query.";
  });
}
$("#historyNav").addEventListener("click", () => {
  if (!history.length) { showToast("No saved scenarios yet. Search two places and generate one."); return; }
  renderMission(history[0]);
  showToast(`Showing latest of ${history.length} saved scenarios.`);
});
$("#databaseNav").addEventListener("click", () => $("#coverage").scrollIntoView({ behavior: "smooth", block: "center" }));
$("#historyCount").textContent = history.length;
