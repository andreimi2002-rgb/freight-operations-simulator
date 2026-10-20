import { t } from "../i18n/i18n.mjs";

export const $ = (selector, root = document) => root.querySelector(selector);
export const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
export const safeUrl = value => (/^https?:\/\//i.test(String(value || "")) ? String(value) : "#");

// Fills every element marked with data-i18n* from the dictionary.
export function applyStaticTranslations(root = document) {
  root.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  for (const attribute of ["aria-label", "placeholder", "title"]) {
    root.querySelectorAll(`[data-i18n-${attribute}]`).forEach(el => el.setAttribute(attribute, t(el.getAttribute(`data-i18n-${attribute}`))));
  }
}

let toastTimer = 0;
export function showToast(message, { error = false } = {}) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.toggle("error", error);
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), error ? 6500 : 4200);
}
