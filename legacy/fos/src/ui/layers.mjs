// Drawers and the search palette are "layers". Opening one makes the page (and any layer
// underneath) inert, moves focus into it, and returns focus to the opener when it closes.
// Escape and a click on the backdrop close the top layer.
const stack = [];
const app = () => document.getElementById("app");

function focusFirst(layer) {
  const target = layer.querySelector("[data-autofocus]") || layer.querySelector("input, select, button:not([data-close]), a[href], [data-close]");
  target?.focus();
}

export function openLayer(layer, { opener = document.activeElement, onClose = null } = {}) {
  if (stack.some(entry => entry.layer === layer)) return;
  stack.at(-1)?.layer.setAttribute("inert", "");
  stack.push({ layer, opener, onClose });
  layer.removeAttribute("inert");
  layer.classList.add("open");
  app().inert = true;
  // Wait a frame so the layer is visible (focus() ignores hidden elements).
  requestAnimationFrame(() => focusFirst(layer));
}

export function closeLayer(layer) {
  const index = stack.findIndex(entry => entry.layer === layer);
  if (index < 0) return;
  const [entry] = stack.splice(index, 1);
  layer.classList.remove("open");
  entry.onClose?.();
  const top = stack.at(-1);
  if (top) top.layer.removeAttribute("inert");
  else app().inert = false;
  if (entry.opener && document.contains(entry.opener)) entry.opener.focus();
}

export const isOpen = layer => stack.some(entry => entry.layer === layer);

export function wireLayer(layer) {
  layer.addEventListener("click", event => {
    if (event.target === layer || event.target.closest("[data-close]")) closeLayer(layer);
  });
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && stack.length) {
    event.preventDefault();
    closeLayer(stack.at(-1).layer);
  }
});
