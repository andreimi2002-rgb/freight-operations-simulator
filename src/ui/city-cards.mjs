// Origin and destination cards: city photo (Wikimedia Commons, credited) and its weather (MET Norway).
import { t } from "../i18n/i18n.mjs";
import { esc, safeUrl } from "./dom.mjs";
import { weatherIcon } from "./weather-icons.mjs";

function creditHtml(photo) {
  const link = (url, text) => (url ? `<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text));
  return `${esc(t("city.photoBy"))}: ${link(photo.page, photo.author || t("city.publicDomain"))} · ${link(photo.licenceUrl, photo.licence)} · Wikimedia Commons`;
}

export function cityCardsHtml(sheet) {
  return `<div class="city-cards">${sheet.cities.map(city => `
    <section class="card city2" data-city="${esc(city.role)}">
      <div class="city2-photo${city.photo ? "" : " no-photo"}" data-code="${esc(city.code)}">
        ${city.photo ? `<img src="${esc(safeUrl(city.photo.src))}" alt="${esc(t("city.photoAlt", { city: city.name }))}" loading="lazy" decoding="async" referrerpolicy="no-referrer" />` : ""}
        <div class="city2-shade" aria-hidden="true"></div>
        <div class="city2-label"><small>${esc(city.label)}</small><h3>${esc(city.name)}</h3><span>${esc(city.sub)}</span></div>
      </div>
      <div class="city2-credit">${city.photo ? creditHtml(city.photo) : esc(t("city.noPhoto"))}</div>
      <div class="city2-weather" data-weather="${esc(city.role)}" aria-live="polite"><div class="wx-loading">${esc(t("weather.loading"))}</div></div>
    </section>`).join("")}</div>`;
}

export function weatherHtml(view, role) {
  if (!view.ok) return `<div class="wx-error">${esc(view.message)} <button type="button" class="linkbtn" data-weather-retry>${esc(t("weather.retry"))}</button></div>`;
  const at = view.atWindow;
  const atHtml = at ? `<div class="wx-at"><small>${esc(at.label)} · ${esc(at.when)}</small>${at.unavailable
    ? `<span class="muted">${esc(at.unavailable)}</span>`
    : `<span class="wx-at-line">${weatherIcon(at.icon, 20)}<b>${esc(at.temp)}</b> ${esc(at.sky)} · ${esc(at.wind)} · ${esc(at.precip)}</span>`}</div>` : "";
  const days = view.days.map(d => `<div class="wx-day" title="${esc(d.sky)} · ${esc(d.precip)}"><small>${esc(d.label)}</small>${weatherIcon(d.icon, 22)}<b>${esc(d.max)}</b><span>${esc(d.min)}</span></div>`).join("");
  return `<div class="wx-now">${weatherIcon(view.now.icon, 38)}
      <div class="wx-main"><b class="wx-temp">${esc(view.now.temp)}</b><span>${esc(view.now.sky)}</span></div>
      <dl class="wx-facts"><div><dt>${esc(t("weather.wind"))}</dt><dd>${esc(view.now.wind)}</dd></div><div><dt>${esc(t("weather.precip"))}</dt><dd>${esc(view.now.precip)}</dd></div></dl>
    </div>
    ${atHtml}
    <div class="wx-days">${days}</div>
    <div class="wx-foot"><span>${esc(t("weather.credit"))} · ${esc(view.updated)}</span><button type="button" class="linkbtn" data-weather-detail="${esc(role)}">${esc(t("weather.details"))} <span aria-hidden="true">→</span></button></div>`;
}
