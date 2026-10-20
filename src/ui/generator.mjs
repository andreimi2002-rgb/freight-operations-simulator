// "New load" drawer: origin/destination (random or picked), cargo family, cargo, trailer.
import { CARGO } from "../mission-engine.mjs";
import { t, tOr } from "../i18n/i18n.mjs";
import { cityCode, cityName } from "../data/scope.mjs";
import { eligibleCargo, eligibleEquipment, families, resolveCargoId } from "../data/selection.mjs";
import { esc } from "./dom.mjs";

const SLOTS = ["origin", "destination"];
const familyName = family => tOr(`family.${family}`, family);
const categoryName = category => tOr(`equipCat.${category}`, category);
const equipmentName = equipment => tOr(`equip.${equipment.id}`, equipment.name);

export function createGenerator({ body, onSubmit, onPick }) {
  const cities = { origin: null, destination: null };
  body.innerHTML = `<form id="genForm" novalidate>
    ${SLOTS.map(slot => `<div class="field"><span class="label" id="${slot}Label">${esc(t(`gen.${slot}`))}</span>
      <div class="pick"><button type="button" class="pick-btn" data-pick="${slot}" aria-labelledby="${slot}Label ${slot}Value"><span class="val empty" id="${slot}Value">${esc(t("gen.random"))}</span><span class="code" id="${slot}Code"></span></button>
      <button type="button" class="iconbtn" data-clear="${slot}" hidden aria-label="${esc(t("gen.clear"))}">×</button></div></div>`).join("")}
    <div class="field"><label for="genFamily">${esc(t("gen.family"))}</label><select id="genFamily"></select></div>
    <div class="field"><label for="genCargo">${esc(t("gen.cargo"))}</label><select id="genCargo"></select></div>
    <div class="field"><label for="genTrailer">${esc(t("gen.trailer"))}</label><select id="genTrailer"></select></div>
    <p class="catalog-status" id="genStatus" aria-live="polite"></p>
    <button type="submit" class="primary wide" id="genSubmit">${esc(t("gen.submit"))}</button>
    <p class="hint">${esc(t("gen.hint"))}</p>
  </form>`;
  const $ = selector => body.querySelector(selector);
  const familySelect = $("#genFamily"), cargoSelect = $("#genCargo"), trailerSelect = $("#genTrailer");

  function fillFamilies() {
    familySelect.replaceChildren(new Option(t("gen.allFamilies"), "all"), ...families().map(family => new Option(familyName(family), family)));
  }
  function fillCargo() {
    const previous = cargoSelect.value || "random";
    cargoSelect.replaceChildren(new Option(t("gen.randomCargo"), "random"));
    const groups = new Map();
    for (const cargo of eligibleCargo({ family: familySelect.value })) {
      if (!groups.has(cargo.family)) groups.set(cargo.family, []);
      groups.get(cargo.family).push(cargo);
    }
    for (const [family, items] of groups) {
      const group = document.createElement("optgroup");
      group.label = familyName(family);
      for (const cargo of items) group.append(new Option(tOr(`cargo.${cargo.id}`, cargo.name), cargo.id));
      cargoSelect.append(group);
    }
    cargoSelect.value = previous !== "random" && CARGO[previous] && [...cargoSelect.options].some(option => option.value === previous) ? previous : "random";
  }
  function fillTrailers() {
    const previous = trailerSelect.value || "random";
    trailerSelect.replaceChildren(new Option(t("gen.randomTrailer"), "random"));
    const groups = new Map();
    for (const equipment of eligibleEquipment({ family: familySelect.value, cargoId: cargoSelect.value })) {
      if (!groups.has(equipment.category)) groups.set(equipment.category, []);
      groups.get(equipment.category).push(equipment);
    }
    for (const [category, items] of groups) {
      const group = document.createElement("optgroup");
      group.label = categoryName(category);
      for (const equipment of items) group.append(new Option(equipmentName(equipment), equipment.id));
      trailerSelect.append(group);
    }
    trailerSelect.value = [...trailerSelect.options].some(option => option.value === previous) ? previous : "random";
  }
  function renderSlot(slot) {
    const city = cities[slot];
    const value = $(`#${slot}Value`);
    value.textContent = city ? `${cityName(city)}` : t("gen.random");
    value.classList.toggle("empty", !city);
    $(`#${slot}Code`).textContent = city ? cityCode(city) : "";
    $(`[data-clear="${slot}"]`).hidden = !city;
  }

  fillFamilies(); fillCargo(); fillTrailers();
  familySelect.addEventListener("change", () => { fillCargo(); fillTrailers(); });
  cargoSelect.addEventListener("change", fillTrailers);
  body.addEventListener("click", event => {
    const pick = event.target.closest("[data-pick]");
    if (pick) { const slot = pick.dataset.pick; onPick(slot, pick, cities[slot === "origin" ? "destination" : "origin"]); return; }
    const clear = event.target.closest("[data-clear]");
    if (clear) { cities[clear.dataset.clear] = null; renderSlot(clear.dataset.clear); }
  });
  $("#genForm").addEventListener("submit", event => {
    event.preventDefault();
    const equipmentId = trailerSelect.value;
    const cargoId = resolveCargoId({ family: familySelect.value, cargoId: cargoSelect.value, equipmentId });
    onSubmit({ originCity: cities.origin, destinationCity: cities.destination, cargoId, equipmentId });
  });

  return {
    setCity(slot, city) { cities[slot] = city; renderSlot(slot); },
    cities: () => ({ ...cities }),
    setStatus(text) { $("#genStatus").textContent = text; },
    setBusy(busy) {
      const button = $("#genSubmit");
      button.disabled = busy;
      button.textContent = busy ? t("gen.busy") : t("gen.submit");
      if (busy) button.setAttribute("aria-busy", "true"); else button.removeAttribute("aria-busy");
    },
  };
}
