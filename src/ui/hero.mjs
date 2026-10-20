import { t } from "../i18n/i18n.mjs";
import { esc } from "./dom.mjs";

const DECO = `<svg class="hero-deco" width="420" height="420" viewBox="0 0 420 420" aria-hidden="true"><circle cx="210" cy="210" r="200" fill="none" stroke="#344657"/><circle cx="210" cy="210" r="150" fill="none" stroke="#1b2a38"/><circle cx="210" cy="210" r="100" fill="none" stroke="#1b2a38"/></svg>`;

export function heroHtml(sheet) {
  const hero = sheet.hero;
  const chips = hero.chips.map(chip => `<span class="chip${chip.available ? "" : " pending"}"><small>${esc(chip.label)}</small><strong>${esc(chip.valueText)}</strong></span>`).join("");
  return `<div class="hero" role="group" aria-label="${esc(t("hero.aria"))}">${DECO}
    <div class="hero-grid">
      <div class="hero-main">
        <div class="eyebrow"><span class="live-dot" aria-hidden="true"></span><span>${esc(t("hero.eyebrow"))} · <span class="mono">${esc(sheet.displayId)}</span> · ${esc(t("hero.simulated"))}</span></div>
        <div class="hero-title">
          <h1 class="route-code" aria-label="${esc(hero.originName)} → ${esc(hero.destinationName)}">${esc(hero.originCode)} <span class="arrow" aria-hidden="true">→</span> ${esc(hero.destinationCode)}</h1>
          <div class="hero-names">
            <div class="route-names">${esc(hero.originLine)} → ${esc(hero.destinationLine)}</div>
            <div class="via">${hero.via ? `${esc(t("hero.via"))} ${esc(hero.via)}` : esc(t("hero.viaUnavailable"))}</div>
          </div>
        </div>
        <div class="chips">${chips}</div>
      </div>
      <div class="hero-side">
        <div>
          <div class="eyebrow">${esc(t("hero.loadingWindow"))}</div>
          <div class="gen-time">${esc(hero.loading.time)}</div>
          <div class="gen-date">${esc(hero.loading.date)}</div>
          <div class="pending-line mono">${esc(hero.unloadingLine)}</div>
          <div class="pending-line">${esc(t("hero.generatedAt"))}: ${esc(hero.generatedAt)}</div>
        </div>
      </div>
    </div>
  </div>`;
}

export function emptyHeroHtml() {
  return `<div class="hero">${DECO}
    <div class="hero-empty">
      <div class="eyebrow"><span class="live-dot" aria-hidden="true"></span>${esc(t("hero.simulated"))}</div>
      <h1>${esc(t("hero.emptyTitle"))}</h1>
      <p>${esc(t("hero.emptyText"))}</p>
      <div class="row">
        <button type="button" class="primary" data-action="generate">${esc(t("hero.emptyAction"))}</button>
        <button type="button" class="ghost" data-action="new-load">${esc(t("hero.emptyOther"))}</button>
      </div>
    </div>
  </div>`;
}
