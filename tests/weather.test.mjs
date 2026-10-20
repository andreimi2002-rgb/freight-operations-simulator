// The MET Norway sample in tests/fixtures is a recorded answer (Bucharest, 20 Oct 2026, trimmed),
// used only for tests. MET Norway data: CC BY 4.0.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { categorize, clearWeatherCache, normalizeForecast } from "../netlify/lib/weather/forecast.mjs";
import { handleWeather } from "../netlify/functions/weather.mjs";
import { setDictionary } from "../src/i18n/i18n.mjs";
import { pickAt, skyLabel, weatherView } from "../src/view-model/weather.mjs";
import { loadCities } from "./helpers/cities.mjs";

setDictionary(JSON.parse(readFileSync(new URL("../src/i18n/ro.json", import.meta.url), "utf8")));
const sample = JSON.parse(readFileSync(new URL("./fixtures/met-locationforecast-bucharest.json", import.meta.url), "utf8"));
const lookup = JSON.parse(readFileSync(new URL("../src/data/places/lookup.json", import.meta.url), "utf8"));
const NOW = Date.parse("2026-10-20T15:10:00Z");
const fakeFetch = (status = 200, body = sample) => async () => new Response(JSON.stringify(body), { status, headers: { expires: new Date(NOW + 30 * 60000).toUTCString() } });

test("MET symbol codes become eight language-neutral sky categories", () => {
  assert.deepEqual(categorize("clearsky_night"), { sky: "clear", intensity: null, night: true });
  assert.deepEqual(categorize("fair_day"), { sky: "partly", intensity: null, night: false });
  assert.deepEqual(categorize("lightrainshowers_day"), { sky: "rain", intensity: "light", night: false });
  assert.deepEqual(categorize("heavysnow"), { sky: "snow", intensity: "heavy", night: false });
  assert.deepEqual(categorize("sleetshowersandthunder_night"), { sky: "thunder", intensity: null, night: true });
  assert.equal(categorize("fog").sky, "fog");
  assert.equal(categorize("cloudy").sky, "cloudy");
  assert.equal(categorize(null).sky, null);
});

test("the forecast is reduced to now, three local days and a series", () => {
  const w = normalizeForecast(sample, { timeZone: "Europe/Bucharest", now: NOW });
  assert.equal(w.now.t, "2026-10-20T15:00:00Z");
  assert.equal(w.days.length, 3);
  assert.deepEqual(w.days.map(d => d.date), ["2026-10-21", "2026-10-22", "2026-10-23"]);
  for (const d of w.days) assert.ok(d.minC <= d.maxC && d.sky && d.precipMm >= 0, d.date);
  assert.ok(w.series.every(e => e.stepH === 1 || e.stepH === 6));
  assert.equal(w.series[0].stepH, 1);
  assert.equal(w.series.at(-1).stepH, 6, "hourly first, then 6-hourly");
  assert.ok(Date.parse(w.series.at(-1).t) - NOW <= 7 * 86400000);
  assert.ok(Number.isInteger(w.now.windKmh), "wind in km/h");
});

test("days are local calendar days: 22:00 UTC already counts as the next day in Bucharest", () => {
  const entry = (time, temp) => ({ time, data: { instant: { details: { air_temperature: temp, wind_speed: 1 } }, next_1_hours: { summary: { symbol_code: "cloudy" }, details: { precipitation_amount: 0 } } } });
  const synthetic = { properties: { meta: { updated_at: "2026-10-20T12:00:00Z" }, timeseries: [
    entry("2026-10-20T12:00:00Z", 10),
    entry("2026-10-21T10:00:00Z", 15),
    entry("2026-10-21T20:00:00Z", 30), // 23:00 in Bucharest, still 21 October
    entry("2026-10-21T22:00:00Z", -5), // 01:00 in Bucharest, already 22 October
    entry("2026-10-22T10:00:00Z", 12),
  ] } };
  const local = normalizeForecast(synthetic, { timeZone: "Europe/Bucharest", now: Date.parse("2026-10-20T12:00:00Z") });
  assert.deepEqual(local.days.map(d => [d.date, d.minC, d.maxC]), [["2026-10-21", 15, 30], ["2026-10-22", -5, 12]]);
  const utc = normalizeForecast(synthetic, { timeZone: "UTC", now: Date.parse("2026-10-20T12:00:00Z") });
  assert.deepEqual(utc.days.map(d => [d.date, d.minC, d.maxC]), [["2026-10-21", -5, 30], ["2026-10-22", 12, 12]]);
});

test("the weather at a window is the entry covering that time, or nothing", () => {
  const w = normalizeForecast(sample, { timeZone: "Europe/Bucharest", now: NOW });
  const hourly = pickAt(w.series, "2026-10-21T05:30:00Z");
  assert.equal(hourly.t, "2026-10-21T05:00:00Z");
  const sixHourly = w.series.find(e => e.stepH === 6);
  const inside = new Date(Date.parse(sixHourly.t) + 4 * 3600000).toISOString();
  assert.equal(pickAt(w.series, inside).t, sixHourly.t);
  assert.equal(pickAt(w.series, "2027-01-01T00:00:00Z"), null);
  assert.equal(pickAt(w.series, "not a date"), null);
});

test("Romanian texts for the card", () => {
  assert.equal(skyLabel({ sky: "rain", intensity: "light" }), "Ploaie slabă");
  assert.equal(skyLabel({ sky: "snow", intensity: "heavy" }), "Ninsoare puternică");
  assert.equal(skyLabel({ sky: "thunder", intensity: "heavy" }), "Furtună");
  const answer = { ok: true, source: { name: "MET Norway", url: "https://api.met.no/", license: "CC BY 4.0" }, fetchedAt: "2026-10-20T15:10:00Z", ...normalizeForecast(sample, { timeZone: "Europe/Bucharest", now: NOW }) };
  const view = weatherView(answer, { role: "origin", name: "București", timeZone: "Europe/Bucharest", weatherAt: { iso: "2026-10-21T05:30:00Z", label: "La încărcare" } });
  assert.ok(view.ok);
  assert.match(view.now.temp, /^\d+ °C$/);
  assert.match(view.now.wind, /km\/h$/);
  assert.equal(view.atWindow.label, "La încărcare");
  assert.match(view.atWindow.when, /08:30/, "window time shown in the city's local time");
  assert.equal(view.days.length, 3);
  assert.equal(view.row.level, "sourced");
  assert.ok(view.row.detail.links[0].url.startsWith("https://"));
  assert.ok(!JSON.stringify(view).includes("⟦"));
  const far = weatherView(answer, { role: "origin", name: "X", timeZone: "Europe/Bucharest", weatherAt: { iso: "2027-01-01T00:00:00Z", label: "La încărcare" } });
  assert.match(far.atWindow.unavailable, /nu acoperă/);
  assert.equal(weatherView({ ok: false, error: "weatherUnavailable" }, {}).ok, false);
});

test("the function: input check, lookup, provider errors and cache headers", async () => {
  clearWeatherCache();
  const bad = await handleWeather("abc", { fetchImpl: fakeFetch(), now: NOW });
  assert.equal(bad.status, 400);
  const unknown = await handleWeather("123", { fetchImpl: fakeFetch(), now: NOW });
  assert.equal(unknown.status, 404);
  const ok = await handleWeather("683506", { fetchImpl: fakeFetch(), now: NOW });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get("netlify-cdn-cache-control"), /s-maxage=1200/);
  const body = await ok.json();
  assert.equal(body.ok, true);
  assert.equal(body.source.license, "CC BY 4.0");
  assert.equal(body.timeZone, "Europe/Bucharest");
  clearWeatherCache();
  const down = await handleWeather("683506", { fetchImpl: fakeFetch(503, {}), now: NOW });
  assert.equal(down.status, 502);
  assert.match(down.headers.get("netlify-cdn-cache-control"), /s-maxage=60/, "errors are cached briefly only");
  assert.equal((await down.json()).ok, false);
});

test("lookup.json matches the active countries' city files", () => {
  const { cities } = loadCities();
  assert.equal(Object.keys(lookup.places).length, cities.length);
  for (const city of cities) assert.deepEqual(lookup.places[city.id], [city.latitude, city.longitude, city.timeZone, city.countryCode], city.name);
});
