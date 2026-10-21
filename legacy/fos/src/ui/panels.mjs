// Glance cards (cargo), KPI row, legend and the load sheet. All text comes from the sheet or t().
import { t } from "../i18n/i18n.mjs";
import { esc, safeUrl } from "./dom.mjs";

export function cargoCardHtml(sheet) {
  const { cargo } = sheet;
  const lang = `<span class="lang-note">${esc(t("ui.inEnglish"))}</span>`;
  const facts = cargo.facts.map(fact => `<div class="fact"><small>${esc(fact.label)}${fact.english ? lang : ""}</small><b class="${fact.pending ? "muted" : ""}">${esc(fact.value)}</b></div>`).join("");
  const notes = cargo.notes.length
    ? `<div><div class="cargo-notes-title">${esc(t("card.notes"))}${lang}</div><ul class="cargo-notes">${cargo.notes.map(note => `<li>${esc(note)}</li>`).join("")}</ul></div>` : "";
  const verify = cargo.verify ? `<div class="verify"><b>${esc(t("card.verify"))}:</b> ${esc(cargo.verify)} ${lang}</div>` : "";
  return `<div class="eyebrow">${esc(t("card.title"))}</div>
    <div><div class="cargo-name">${esc(cargo.name)}</div><div class="cargo-sub">${esc(cargo.family)}</div></div>
    <div class="facts">${facts}</div>${verify}${notes}`;
}

export function kpisHtml(sheet) {
  return sheet.kpis.map(kpi => kpi.valueText
    ? `<div class="kpi"><div class="kpi-label">${esc(kpi.label)}</div><div class="kpi-number">${esc(kpi.valueText)}</div><div class="kpi-bar"></div>${kpi.foot ? `<div class="kpi-phase">${esc(kpi.foot)}</div>` : ""}</div>`
    : `<div class="kpi pending"><div class="kpi-label">${esc(kpi.label)}</div><div class="kpi-number">—</div><div class="kpi-phase">${esc(kpi.pendingText)}</div></div>`).join("");
}

export function warningsHtml(sheet) {
  if (!sheet.warnings.length) return "";
  return `<div class="eyebrow">${esc(t("sheet.warningsTitle"))}</div><ul>${sheet.warnings.map(text => `<li>${esc(text)}</li>`).join("")}</ul>`;
}

export function legendHtml(sheet) {
  return sheet.legend.map(item => `<span class="badge lv-${esc(item.level)}" title="${esc(item.help)}">${esc(item.label)}</span>`).join("");
}

// A list of load-sheet rows (each opens the detail drawer). Used by every tab.
export function rowListHtml(rows, selectedId = null) {
  const chevron = `<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>`;
  const head = `<div class="sheet-head" aria-hidden="true"><span>${esc(t("sheet.colField"))}</span><span>${esc(t("sheet.colValue"))}</span><span>${esc(t("sheet.colProvenance"))}</span><span></span></div>`;
  const items = rows.map(row => `<button type="button" class="frow lv-${esc(row.level)}${row.id === selectedId ? " sel" : ""}" data-row="${esc(row.id)}" aria-label="${esc(t("sheet.openRow", { label: row.label, value: row.valueText, provenance: row.levelLabel }))}">
      <span class="fl">${esc(row.label)}</span>
      <span class="fv${row.available ? " mono" : ""}">${esc(row.valueText)}</span>
      <span class="badge lv-${esc(row.level)}">${esc(row.levelLabel)}</span>${chevron}
    </button>`).join("");
  return `<div class="sheet">${head}${items}</div>`;
}

export function detailHtml(row) {
  const { fact, detail } = row;
  const sections = [];
  if (detail.explanation) sections.push(`<p class="dr-text">${esc(detail.explanation)}</p>`);
  if (fact.source) {
    sections.push(`<div class="dr-sec"><h4>${esc(t("drawer.sourceHeading"))}</h4><p>${esc(fact.source.name)}</p></div>`);
  }
  if (fact.formula) {
    sections.push(`<div class="dr-sec"><h4>${esc(t("drawer.formulaHeading"))}</h4><p>${esc(fact.formula)}</p></div>`);
    sections.push(`<div class="dr-sec"><h4>${esc(t("drawer.inputsHeading"))}</h4>${fact.inputs.map(input => `<div class="trow"><span>${esc(input.label)}</span><b>${esc(input.value)}</b></div>`).join("")}</div>`);
  }
  if (fact.basis) sections.push(`<div class="dr-sec"><h4>${esc(t("drawer.basisHeading"))}</h4><p>${esc(fact.basis)}</p></div>`);
  if (fact.note) sections.push(`<div class="dr-sec"><h4>${esc(t("drawer.noteHeading"))}</h4><p>${esc(fact.note)}</p></div>`);
  if (detail.meta.length) sections.push(`<div class="dr-sec">${detail.meta.map(item => `<div class="trow"><span>${esc(item.label)}</span><b>${esc(item.value)}</b></div>`).join("")}</div>`);
  if (detail.links.length) sections.push(`<div class="dr-links">${detail.links.map(link => `<a href="${esc(safeUrl(link.url))}" target="_blank" rel="noopener">${esc(link.label)} ↗</a>`).join("")}</div>`);
  return `<div class="dr-label">${esc(row.label)}</div><div class="dr-value ${row.available ? "mono" : ""}">${esc(row.valueText)}</div>${sections.join("")}`;
}

export function recentHtml(entries, currentId) {
  if (!entries.length) return `<span class="quick-empty">${esc(t("topbar.noRecent"))}</span>`;
  return entries.map(entry => `<button type="button" class="qchip${entry.id === currentId ? " active" : ""}" data-recent="${esc(entry.id)}" aria-label="${esc(entry.aria)}"${entry.id === currentId ? ' aria-current="true"' : ""}><b>${esc(entry.code)}</b><span>${esc(entry.label)}</span></button>`).join("");
}
