// The tab bar and the eight panels of a load. All text comes from the sheet (buildLoadSheet) or t().
import { t } from "../i18n/i18n.mjs";
import { esc } from "./dom.mjs";
import { cargoCardHtml, kpisHtml, legendHtml, rowListHtml, warningsHtml } from "./panels.mjs";
import { cityCardsHtml } from "./city-cards.mjs";

const svg = body => `<svg class="tab-ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICONS = {
  overview: svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
  map: svg('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
  cargo: svg('<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>'),
  equipment: svg('<path d="M2 6h11v9H2z"/><path d="M13 9h4l4 3.5V15h-8z"/><circle cx="6" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>'),
  schedule: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  costs: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 0 1 0 3.6h-3a1.8 1.8 0 0 0 0 3.6h4"/>'),
  documents: svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'),
  sources: svg('<path d="M4 6h16M4 12h16M4 18h10"/>'),
};

export function tabBarHtml(sheet, activeId) {
  return sheet.tabs.map(tab => {
    const on = tab.id === activeId;
    return `<button type="button" role="tab" id="tab-${esc(tab.id)}" class="tab${on ? " active" : ""}" data-tab="${esc(tab.id)}" aria-selected="${on}" aria-controls="panel-${esc(tab.id)}" tabindex="${on ? 0 : -1}">${ICONS[tab.id] || ""}<span>${esc(tab.label)}</span></button>`;
  }).join("");
}

const kv = items => `<dl class="kv">${items.map(item => `<div><dt>${esc(item.label)}</dt><dd>${esc(item.value)}</dd></div>`).join("")}</dl>`;
const card = (title, body, link = null, extraClass = "") => `<section class="card pcard ${extraClass}"><div class="pcard-head"><h3>${esc(title)}</h3>${link ? `<button type="button" class="linkbtn" data-tab="${esc(link.tab)}">${esc(t(link.label))} <span aria-hidden="true">→</span></button>` : ""}</div>${body}</section>`;
const head = id => `<div class="panel-head2"><h2>${esc(t(`panel.${id}.title`))}</h2><div class="section-note">${esc(t(`panel.${id}.note`))}</div></div>`;
const mapSlot = (id, large = false) => `<div class="map-slot${large ? " large" : ""}" data-map-slot="${esc(id)}"></div>`;

function timelineHtml(sheet) {
  const items = sheet.timeline.map(e => `<li class="tl tl-${esc(e.type)}"><span class="tl-dot" aria-hidden="true"></span>
      <div class="tl-when mono">${esc(e.when)}${e.until ? `–${esc(e.until)}` : ""}<small>${esc(e.zone)}</small></div>
      <div class="tl-what"><b>${esc(e.label)}</b>${e.duration ? `<span>${esc(e.duration)}</span>` : ""}</div></li>`).join("");
  return `<ol class="timeline">${items}</ol><p class="hint">${esc(t("schedule.assumption"))}</p>`;
}

function trailersHtml(sheet) {
  const items = sheet.trailers.map(item => `<li class="${item.chosen ? "chosen" : ""}"><span>${esc(item.name)}</span>${item.chosen ? `<em>${esc(t("equipment.chosen"))}</em>` : ""}</li>`).join("");
  return `<ul class="trailer-list">${items}</ul><p class="hint">${esc(t("equipment.listedNote"))}</p>`;
}

function overviewHtml(sheet) {
  const o = sheet.overview;
  const trailer = `<div class="cargo-name" style="font-size:20px">${esc(o.trailer.name)}</div><div class="cargo-sub">${esc(o.trailer.category)}</div>
    ${kv([{ label: t("row.floor.label"), value: o.trailer.floor || o.trailer.floorPending }])}`;
  return `<div class="ov-top">${mapSlot("overview")}<div class="ov-side">
      ${card(t("card.route"), kv(o.route), { tab: "map", label: "card.seeMap" })}
      ${card(t("card.roles"), kv(o.roles) + `<p class="hint">${esc(t("card.rolesNote"))}</p>`)}
    </div></div>
    ${cityCardsHtml(sheet)}
    <div class="ov-mid">
      <section class="card cargo-card">${cargoCardHtml(sheet)}<button type="button" class="linkbtn" data-tab="cargo">${esc(t("card.seeCargo"))} <span aria-hidden="true">→</span></button></section>
      ${card(t("card.trailer"), trailer, { tab: "equipment", label: "card.seeEquipment" })}
      ${card(t("card.schedule"), kv(o.schedule), { tab: "schedule", label: "card.seeSchedule" })}
    </div>
    <section class="kpis">${kpisHtml(sheet)}</section>`;
}

function sourcesHtml(sheet) {
  const groups = sheet.tabs.filter(tab => tab.id !== "sources").map(tab => {
    const rows = sheet.rowsByTab[tab.id].filter(row => !row.placeholder);
    return rows.length ? `<h3 class="group-title">${esc(tab.label)}</h3>${rowListHtml(rows)}` : "";
  }).join("");
  const missing = sheet.rows.filter(row => row.placeholder);
  return `<div class="legend" aria-label="${esc(t("sheet.legend"))}">${legendHtml(sheet)}</div>
    <section class="warnings" role="note" style="margin-top:14px">${warningsHtml(sheet)}</section>
    <h3 class="group-title" style="margin-top:22px">${esc(t("sources.rowsTitle"))}</h3>${groups}
    <h3 class="group-title" style="margin-top:26px">${esc(t("sources.missingTitle"))}</h3><div class="section-note" style="margin-bottom:10px">${esc(t("sources.missingNote"))}</div>${rowListHtml(missing)}`;
}

const rows = (sheet, id) => rowListHtml(sheet.rowsByTab[id]);
const BODIES = {
  overview: overviewHtml,
  map: sheet => `${mapSlot("map", true)}${cityCardsHtml(sheet)}<div style="height:16px"></div>${rows(sheet, "map")}`,
  cargo: sheet => `<section class="card cargo-card">${cargoCardHtml(sheet)}</section><div style="height:16px"></div>${rows(sheet, "cargo")}`,
  equipment: sheet => `${rows(sheet, "equipment")}<div style="height:16px"></div>${card(t("equipment.listedTitle"), trailersHtml(sheet))}`,
  schedule: sheet => `${card(t("schedule.timelineTitle"), timelineHtml(sheet))}<div style="height:16px"></div>${rows(sheet, "schedule")}`,
  costs: sheet => rows(sheet, "costs"),
  documents: sheet => rows(sheet, "documents"),
  sources: sourcesHtml,
};

export function panelsHtml(sheet, activeId) {
  return sheet.tabs.map(tab => `<section role="tabpanel" id="panel-${esc(tab.id)}" class="tabpanel" aria-labelledby="tab-${esc(tab.id)}" tabindex="0"${tab.id === activeId ? "" : " hidden"}>${tab.id === "overview" ? "" : head(tab.id)}${BODIES[tab.id](sheet)}</section>`).join("");
}
