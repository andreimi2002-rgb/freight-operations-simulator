// Turns a /api/weather answer into the few texts the city card shows. Weather is live data from
// MET Norway: it is shown with its source and time and never stored in the Load.
import { formatDate, formatNumber, formatTime, t } from "../i18n/i18n.mjs";
import { levelLabel } from "./provenance.mjs";

const WET = new Set(["rain", "sleet", "snow"]);
export function skyLabel({ sky, intensity } = {}) {
  if (!sky) return t("weather.sky.unknown");
  const base = t(`weather.sky.${sky}`);
  return intensity && WET.has(sky) ? `${base} ${t(`weather.intensity.${intensity}`)}` : base;
}
export const iconKey = ({ sky, night } = {}) => (sky === "clear" || sky === "partly") && night ? `${sky}-night` : (sky || "cloudy");
export const tempText = c => (Number.isFinite(c) ? t("fmt.celsius", { value: formatNumber(Math.round(c), { maximumFractionDigits: 0 }) }) : t("ui.noValue"));
export const windText = v => (Number.isFinite(v) ? t("fmt.kmh", { value: formatNumber(v, { maximumFractionDigits: 0 }) }) : t("ui.noValue"));
export const precipText = v => (Number.isFinite(v) ? t("fmt.mmRain", { value: formatNumber(v, { maximumFractionDigits: 1 }) }) : t("ui.noValue"));

// The forecast entry that covers a moment (each entry covers stepH hours from its time);
// otherwise the nearest entry within 3 hours; otherwise null.
export function pickAt(series, iso) {
  const at = Date.parse(iso);
  if (!Array.isArray(series) || !Number.isFinite(at)) return null;
  const covering = series.find(e => at >= Date.parse(e.t) && at < Date.parse(e.t) + (e.stepH || 1) * 3600000);
  if (covering) return covering;
  const nearest = series.reduce((best, e) => (!best || Math.abs(Date.parse(e.t) - at) < Math.abs(Date.parse(best.t) - at) ? e : best), null);
  return nearest && Math.abs(Date.parse(nearest.t) - at) <= 3 * 3600000 ? nearest : null;
}

const summary = e => ({ icon: iconKey(e), temp: tempText(e.tempC), sky: skyLabel(e), wind: windText(e.windKmh), precip: precipText(e.precipMm) });

// city: { name, timeZone, weatherAt: { iso, label } }
export function weatherView(answer, city) {
  if (!answer?.ok) return { ok: false, message: t(answer?.error === "unknownCity" ? "weather.notFound" : "weather.error") };
  const at = city.weatherAt ? pickAt(answer.series, city.weatherAt.iso) : null;
  const when = city.weatherAt ? `${formatDate(city.weatherAt.iso, { short: true, timeZone: city.timeZone })}, ${formatTime(city.weatherAt.iso, city.timeZone)}` : null;
  const now = summary(answer.now);
  const atWindow = city.weatherAt ? { label: city.weatherAt.label, when, ...(at ? summary(at) : { unavailable: t("weather.atUnavailable") }) } : null;
  const days = answer.days.map(d => ({
    label: formatDate(`${d.date}T12:00:00Z`, { short: true, timeZone: city.timeZone }).replace(/,.*$/, ""),
    icon: iconKey(d),
    sky: skyLabel(d),
    max: tempText(d.maxC),
    min: tempText(d.minC),
    precip: precipText(d.precipMm),
  }));
  const updated = t("weather.updated", { time: formatTime(answer.fetchedAt) });
  return {
    ok: true,
    now,
    atWindow,
    days,
    updated,
    // The same shape as a load-sheet row, so the detail drawer can show it.
    row: {
      id: `weather-${city.role}`,
      label: t("weather.rowLabel", { city: city.name }),
      valueText: `${now.temp} · ${now.sky}`,
      level: "sourced",
      levelLabel: levelLabel("sourced"),
      available: true,
      fact: { level: "sourced", source: { name: answer.source.name, url: answer.source.url } },
      detail: {
        explanation: t("weather.detail"),
        meta: [
          { label: t("weather.metaNow"), value: `${now.temp} · ${now.sky} · ${t("weather.wind")} ${now.wind} · ${t("weather.precip")} ${now.precip}` },
          ...(atWindow && !atWindow.unavailable ? [{ label: `${atWindow.label} (${when})`, value: `${atWindow.temp} · ${atWindow.sky} · ${atWindow.wind} · ${atWindow.precip}` }] : []),
          ...days.map(d => ({ label: d.label, value: `${d.min} / ${d.max} · ${d.sky} · ${d.precip}` })),
          { label: t("meta.license"), value: answer.source.license },
          ...(answer.updatedAt ? [{ label: t("weather.metaIssued"), value: formatDate(answer.updatedAt, { time: true, weekday: false }) }] : []),
          { label: t("weather.metaFetched"), value: formatDate(answer.fetchedAt, { time: true, weekday: false }) },
        ],
        links: [{ label: t("drawer.openSource"), url: answer.source.url }],
      },
    },
  };
}
