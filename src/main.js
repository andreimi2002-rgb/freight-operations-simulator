const $ = (s) => document.querySelector(s);
import {generateMission as buildMission, validateMission, REGIONS} from "./mission-engine.mjs";

const HISTORY_KEY = "fos-mission-history-v2";
let history = loadHistory();

const $$ = (s) => [...document.querySelectorAll(s)];
function getWorld(){return $('input[name="world"]:checked')?.value || "ATS"}
function formatNum(n){return n.toLocaleString("en-US")}
function showToast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2800)}
function loadHistory(){try{const data=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");return Array.isArray(data)?data.filter(item=>validateMission(item).length===0).slice(0,30):[]}catch{return []}}
function saveHistory(){try{localStorage.setItem(HISTORY_KEY,JSON.stringify(history))}catch{showToast("Mission generated, but browser storage is unavailable.")}}
function esc(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

function generateMission(){
  let mission;
  try{mission=buildMission({world:getWorld(),region:$("#region").value,cargoId:$("#cargo").value,operatingStyle:$("#difficulty").value,includeStop:$("#includeStop").checked,includeCompanies:$("#includeCompanies").checked})}
  catch(error){showToast(error.message);return}
  const issues=validateMission(mission);
  if(issues.length){showToast(`Mission rules error: ${issues.join(" ")}`);return}
  history.unshift(mission); if(history.length>30)history.pop(); saveHistory();
  renderMission(mission);
  $("#historyCount").textContent=history.length;
  showToast("Mission generated. All shipment details are simulated.");
}

function renderMission(m){
  $("#emptyState").classList.add("hidden");
  const out=$("#missionOutput");out.classList.remove("hidden");
  const worldLabel=m.world==="ATS"?"AMERICAN TRUCK SIMULATOR":"EURO TRUCK SIMULATOR 2";
  const distanceValue=m.distance.value;
  const distanceUnit=m.distance.unit;
  const fuelLine=`<div class="metric"><b>${formatNum(m.fuel.value)} ${m.fuel.unit}</b><small>ILLUSTRATIVE FUEL · ${esc(String(m.fuel.rate))} ${esc(m.fuel.rateUnit)}</small></div>`;
  out.innerHTML=`
    <div class="mission-banner">
      <div class="mission-id">${esc(m.id)} · ${worldLabel}</div>
      <div class="mission-route">
        <div><small>ORIGIN</small><strong>${esc(m.route.from)}</strong></div>
        <div class="route-arrow">→</div>
        <div><small>DESTINATION</small><strong>${esc(m.route.to)}</strong></div>
      </div>
      <div class="mission-tags"><span class="tag">${esc(m.cargo.name)}</span><span class="tag">${esc(m.operatingStyle.toUpperCase())}</span><span class="tag">SIMULATED LOAD</span></div>
    </div>
    <div class="mission-metrics">
      <div class="metric"><b>${formatNum(m.weightKg)} kg</b><small>CARGO WEIGHT*</small></div>
      <div class="metric"><b>${formatNum(distanceValue)} ${distanceUnit}</b><small>PLANNING DISTANCE*</small></div>
      ${fuelLine}
    </div>
    <div class="mission-section"><h4>DISPATCH SUMMARY</h4><p>${m.cargo.handling.map(esc).join(" ")} Equipment concept: <b>${esc(m.equipment.name)}</b>. Illustrative driving-time model: about <b>${m.travel.drivingHours.toFixed(1)} hours</b> before breaks, traffic, route restrictions and delays. Planning deadline: <b>${new Date(m.travel.deadline).toLocaleString()}</b>. This is not a navigation ETA.</p></div>
    <div class="mission-section"><h4>IN-GAME COMPANY REFERENCE</h4><p><b>${esc(m.carrier.name)}</b> — ${esc(m.carrier.industry)}. ${esc(m.carrier.relationship)}</p></div>
    ${m.stop?`<div class="mission-section"><h4>PLANNED DRIVER STOP</h4><div class="stop-card"><div class="stop-marker">⌖</div><div><b>${esc(m.stop.name)}</b><small>${esc(m.stop.note)}</small></div></div></div>`:""}
    <div class="mission-section"><h4>OPERATIONAL CHECKPOINTS</h4><p>Confirm exact pickup/delivery facilities, route restrictions, trailer compatibility, load securement, driver hours, weather and receiving appointment. If the chosen stop is unsuitable or unverified, replace it with a verified alternative.</p></div>
    <div class="mission-section"><h4>DATA INTEGRITY</h4><p>City pair and shipment details form a generated scenario. Distance, weight, timing and fuel are illustrative calculations, not verified trip data. Cargo and company names may be references to in-game content; the fictional FOS mission does not represent an actual shipment, contract, or company involvement.</p></div>
    <div class="output-actions"><button class="primary" id="printReport">↧ EXPORT / PRINT REPORT</button><button id="regenerate">⟳ NEW MISSION</button></div>
    <p class="form-note">*Planning figures only. Do not use as an actual dispatch, bill of lading, route authorization or proof of delivery.</p>`;
  $("#printReport").addEventListener("click",()=>printMission(m));
  $("#regenerate").addEventListener("click",generateMission);
}

function printMission(m){
  const win=window.open("","_blank");
  if(!win){showToast("Pop-up blocked. Allow pop-ups to export the report.");return}
  const reportDistance=m.distance.value;
  const reportUnit=m.distance.unit;
  const stop=m.stop?`<h2>Planned stop</h2><p><b>${esc(m.stop.name)}</b><br>${esc(m.stop.note)}</p>`:"";
  win.document.write(`<!doctype html><html><head><title>${m.id} Freight Mission</title><style>
  body{font:14px Arial,sans-serif;color:#17212a;margin:36px;line-height:1.5}header{background:#17212a;color:white;padding:25px;border-bottom:7px solid #f28c28}h1{margin:0;font-size:28px}header p{color:#d6dee4}h2{font-size:15px;color:#b8641c;border-bottom:1px solid #ddd;padding-bottom:6px;margin-top:26px}.route{display:flex;justify-content:space-between;background:#f1f3f4;padding:18px;margin:18px 0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.card{border:1px solid #ddd;padding:12px}.muted{color:#687681;font-size:12px}.warning{background:#fff2dd;padding:12px;border-left:4px solid #f28c28}.footer{margin-top:35px;border-top:1px solid #ccc;padding-top:12px;font-size:11px;color:#667}</style></head><body>
  <header><div style="color:#ffc45b;font-size:11px;font-weight:bold;letter-spacing:2px">FREIGHT OPERATIONS SIMULATOR</div><h1>SIMULATED MISSION BRIEF</h1><p>${esc(m.id)} · ${esc(m.world)} · ${new Date(m.createdAt).toLocaleString()}</p></header>
  <div class="route"><div><small>ORIGIN</small><h2 style="border:0;margin:3px 0;color:#17212a">${esc(m.route.from)}</h2></div><div style="font-size:26px;color:#f28c28">→</div><div><small>DESTINATION</small><h2 style="border:0;margin:3px 0;color:#17212a">${esc(m.route.to)}</h2></div></div>
  <div class="grid"><div class="card"><small>CARGO</small><h3>${esc(m.cargo.name)}</h3></div><div class="card"><small>WEIGHT</small><h3>${formatNum(m.weightKg)} kg</h3></div><div class="card"><small>PLANNING DISTANCE</small><h3>${formatNum(reportDistance)} ${reportUnit}</h3></div></div>
  <h2>Equipment & dispatch</h2><p>${esc(m.equipment.name)}. Carrier reference: ${esc(m.carrier.name)}. ${esc(m.carrier.relationship)}</p>
  <h2>Route & timing</h2><p>Illustrative driving-time model: ${m.travel.drivingHours.toFixed(1)} hours before breaks, traffic, weather, restrictions and delays. Planning deadline: ${new Date(m.travel.deadline).toLocaleString()}. The route distance and travel time have not been verified by a routing engine.</p>
  ${stop}
  <h2>Operational checklist</h2><ul><li>Confirm pickup and delivery addresses.</li><li>Verify route, road restrictions and driver-hours compliance.</li><li>Inspect equipment and cargo securement.</li><li>Confirm receiving appointment and delivery documentation.</li></ul>
  <div class="warning"><b>SIMULATION NOTICE</b><br>This generated mission is not an actual dispatch, bill of lading, route authorization, verified quote or proof of delivery. Weight, distance, timing and fuel figures are illustrative. Real company references do not imply involvement.</div>
  <div class="footer">FOS / Freight Operations Simulator · Version 0.3.0 · Independent concept; not affiliated with SCS Software.</div>
  <script>window.onload=()=>window.print()</script></body></html>`);
  win.document.close();
}

function updateRegionOptions(){
  const select=$("#region"), world=getWorld(), current=select.value;
  select.replaceChildren(new Option("Any region","any"),...REGIONS[world].map(region=>new Option(region.label,region.id)));
  select.value=REGIONS[world].some(region=>region.id===current)?current:"any";
}

$("#missionForm").addEventListener("submit",e=>{e.preventDefault();generateMission()});
$$("input[name=\"world\"]").forEach(input=>input.addEventListener("change",updateRegionOptions));
$("#historyNav").addEventListener("click",()=>{if(!history.length){showToast("No saved missions yet. Generate your first mission.");return}renderMission(history[0]);showToast(`Showing latest of ${history.length} saved missions.`)});
$("#databaseNav").addEventListener("click",()=>{$("#coverage").scrollIntoView({behavior:"smooth",block:"center"})});
$("#historyCount").textContent=history.length;
updateRegionOptions();


