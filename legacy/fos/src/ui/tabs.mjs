// Tab bar behaviour (WAI-ARIA tabs pattern): click, arrows, Home/End; selection follows focus.
export function wireTabs(tabbar, onSelect) {
  tabbar.addEventListener("click", event => {
    const tab = event.target.closest("[data-tab]");
    if (tab) onSelect(tab.dataset.tab);
  });
  tabbar.addEventListener("keydown", event => {
    const tabs = [...tabbar.querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    let next = null;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    tabs[next].focus();
    onSelect(tabs[next].dataset.tab);
  });
}
