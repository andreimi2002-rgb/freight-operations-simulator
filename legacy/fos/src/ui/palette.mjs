// City search palette (Ctrl/Cmd+K or "/"). Searches the active countries' city pool on the device.
import { countryName, formatNumber, t } from "../i18n/i18n.mjs";
import { cityCode, cityName } from "../data/scope.mjs";
import { closeLayer, openLayer, wireLayer } from "./layers.mjs";
import { activeCountriesText, esc } from "./dom.mjs";

const fold = text => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const PIN = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>`;

export function searchCities(cities, query, limit = 30) {
  const q = fold(query).trim();
  if (!q) return [...cities].sort((a, b) => b.population - a.population).slice(0, 12);
  const scored = [];
  for (const city of cities) {
    const names = [fold(cityName(city)), fold(city.name)];
    const rank = names.some(name => name.startsWith(q)) ? 0 : names.some(name => name.includes(q)) ? 1 : fold(countryName(city.countryCode)).includes(q) ? 2 : -1;
    if (rank >= 0) scored.push({ city, rank });
  }
  return scored.sort((a, b) => a.rank - b.rank || b.city.population - a.city.population).slice(0, limit).map(item => item.city);
}

export function createPalette({ layer, input, list, modeElement, getCities, onPick }) {
  let results = [];
  let active = 0;
  let exclude = null;

  function render() {
    const query = input.value;
    results = searchCities(getCities().filter(city => city.id !== exclude), query);
    let html = "";
    if (!results.length) html = `<div class="option-empty">${esc(t("palette.empty", { query: query.trim() }))}</div>`;
    else {
      if (!query.trim()) html += `<div class="option-group">${esc(t("palette.popular"))}</div>`;
      html += results.map((city, index) => `<button type="button" class="option" role="option" id="city-opt-${index}" data-i="${index}" aria-selected="false">
        <span class="ic">${PIN}</span>
        <span class="tx"><strong>${esc(cityName(city))}</strong><small>${esc(countryName(city.countryCode))} · ${esc(formatNumber(city.population, { maximumFractionDigits: 0 }))}</small></span>
        <code>${esc(cityCode(city))}</code></button>`).join("");
    }
    if (!query.trim()) html += `<div class="option-hint">${esc(t("palette.hint"))}</div>`;
    list.innerHTML = html;
    active = 0;
    highlight();
  }
  function highlight() {
    list.querySelectorAll(".option").forEach(el => {
      const on = Number(el.dataset.i) === active;
      el.classList.toggle("active", on);
      el.setAttribute("aria-selected", String(on));
      if (on) el.scrollIntoView({ block: "nearest" });
    });
    if (results.length) input.setAttribute("aria-activedescendant", `city-opt-${active}`); else input.removeAttribute("aria-activedescendant");
  }
  function choose(city) {
    if (!city) return;
    closeLayer(layer);
    onPick(city);
  }

  input.placeholder = t("palette.placeholder", { countries: activeCountriesText() });
  wireLayer(layer);
  input.addEventListener("input", render);
  input.addEventListener("keydown", event => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!results.length) return;
      active = (active + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
      highlight();
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[active]);
    }
  });
  list.addEventListener("click", event => {
    const button = event.target.closest("[data-i]");
    if (button) choose(results[Number(button.dataset.i)]);
  });

  // mode: "origin" | "destination" | null (the top bar search: the city goes to the first empty slot).
  return {
    open({ mode = null, excludeId = null, opener = document.activeElement } = {}) {
      exclude = excludeId;
      modeElement.textContent = mode ? t(mode === "origin" ? "palette.forOrigin" : "palette.forDestination") : "";
      input.value = "";
      render();
      openLayer(layer, { opener });
    },
  };
}
