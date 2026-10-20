// "About the data": provenance legend, sources and licences, limits.
import { t } from "../i18n/i18n.mjs";
import { LEVELS, UNAVAILABLE, levelHelp, levelLabel } from "../view-model/provenance.mjs";
import { activeCountriesText, esc, safeUrl } from "./dom.mjs";

const SOURCES = [
  { id: "geonames", url: "https://www.geonames.org/" },
  { id: "geoapify", url: "https://apidocs.geoapify.com/docs/routing/" },
  { id: "openfreemap", url: "https://openfreemap.org/" },
  { id: "maplibre", url: "https://maplibre.org/" },
  { id: "commons", url: "https://commons.wikimedia.org/" },
  { id: "met", url: "https://api.met.no/" },
  { id: "epal", url: "https://www.epal-pallets.org/eu-en/load-carriers/epal-euro-pallet" },
  { id: "dsv", url: "https://www.dsv.com/en/our-solutions/modes-of-transport/road-transport/trailer-sizes" },
  { id: "reg561", url: "https://eur-lex.europa.eu/eli/reg/2006/561/oj" },
  { id: "unece", url: "https://unece.org/transport/statistics-transport/classification-nst-2007" },
  { id: "catalog", url: null },
  { id: "fonts", url: "https://github.com/rsms/inter" },
];

export function aboutHtml() {
  const legend = [...LEVELS, UNAVAILABLE].map(level => `<div><span class="badge lv-${level}">${esc(levelLabel(level))}</span><span>${esc(levelHelp(level))}</span></div>`).join("");
  const sources = SOURCES.map(source => {
    const name = esc(t(`about.src.${source.id}.name`));
    return `<div class="src"><b>${source.url ? `<a href="${esc(safeUrl(source.url))}" target="_blank" rel="noopener">${name} ↗</a>` : name}</b>
      <span>${esc(t(`about.src.${source.id}.usage`, { countries: activeCountriesText() }))}</span><span>${esc(t(`about.src.${source.id}.license`))}</span></div>`;
  }).join("");
  return `<p class="dr-text" style="margin-top:0">${esc(t("about.intro"))}</p>
    <div class="dr-sec"><h4>${esc(t("about.legendTitle"))}</h4><div class="about-legend">${legend}</div></div>
    <div class="dr-sec"><h4>${esc(t("about.sourcesTitle"))}</h4>${sources}</div>
    <div class="dr-sec"><h4>${esc(t("about.limitsTitle"))}</h4><p>${esc(t("about.limits"))}</p></div>`;
}
