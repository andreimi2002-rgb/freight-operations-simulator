// One-page printable sheet (light theme via @media print in styles.css). It is filled right
// before window.print() so it always matches the load on screen.
import { t } from "../i18n/i18n.mjs";
import { esc } from "./dom.mjs";
import { VERSION } from "../version.mjs";

export function printHtml(sheet, mapImage) {
  const hero = sheet.hero;
  const map = mapImage
    ? `<img class="pr-map" src="${esc(mapImage)}" alt="${esc(t("print.mapAlt", { origin: hero.originName, destination: hero.destinationName }))}" /><div class="pr-map-note">${esc(t("map.attribution"))}</div>`
    : `<div class="pr-map-note">${esc(t("print.noMap"))}</div>`;
  const rows = sheet.rows.map(row => `<tr><td>${esc(row.label)}</td><td>${esc(row.valueText)}</td><td class="pr-lv-${esc(row.level)}">${esc(row.levelLabel)}</td></tr>`).join("");
  return `<div class="pr-head">
      <div class="pr-eyebrow">${esc(t("brand.name"))} · ${esc(t("print.subtitle"))} · ${esc(sheet.displayId)}</div>
      <div class="pr-code">${esc(hero.originCode)} → ${esc(hero.destinationCode)}</div>
      <div class="pr-names">${esc(hero.originLine)} → ${esc(hero.destinationLine)}</div>
      <div class="pr-sub">${hero.via ? `${esc(t("hero.via"))} ${esc(hero.via)} · ` : ""}${esc(hero.generatedAt)}</div>
    </div>
    ${map}
    <table class="pr-table"><tbody>${rows}</tbody></table>
    <div class="pr-notice">${esc(t("print.notice"))}</div>
    <div class="pr-foot">${esc(t("footer.sources"))} · ${esc(t("footer.version", { version: VERSION }))}</div>`;
}
