import test from "node:test";
import assert from "node:assert/strict";
import { generateLoad } from "../src/engine/generator.mjs";
import { buildSchedule, scheduleFact } from "../src/engine/schedule.mjs";
import { validateFact } from "../src/engine/provenance.mjs";
import { loadCities } from "./helpers/cities.mjs";

const catalog = loadCities();
const city = name => catalog.cities.find(c => c.name === name);
const router = durationS => ({
  async route({ origin, destination }) {
    return { distanceM: 800000, durationS, geometry: [[[origin.lon, origin.lat], [destination.lon, destination.lat]]], countries: ["RO", "HU"], viaNames: [], provider: "Test router", sourceUrl: "https://example.org/route", retrievedAt: "2026-10-20T08:00:00.000Z" };
  },
});
const make = (durationS, extra = {}) => generateLoad({
  cities: catalog.cities, importedAt: "2026-10-20T00:00:00.000Z", router: router(durationS),
  originCity: city("Bucharest"), destinationCity: city("Budapest"), cargoId: "apples", equipmentId: "reefer",
  now: new Date("2026-10-20T08:00:00.000Z"), random: () => 0.5, ...extra,
});

test("schedule for a 680-minute drive: the exact sequence", async () => {
  const load = await make(680 * 60);
  const { events, departAt, arrivalAt } = buildSchedule(load);
  assert.equal(departAt, load.timeWindows.loading.value.to);
  assert.deepEqual(events.map(e => e.type), ["loading", "depart", "drive", "break", "drive", "dailyRest", "drive", "arrival", "wait", "unloading"].filter(type => type !== "wait" || events.some(e => e.type === "wait")));
  const parts = events.filter(e => ["drive", "break", "dailyRest"].includes(e.type)).map(e => [e.type, e.min]);
  assert.deepEqual(parts, [["drive", 270], ["break", 45], ["drive", 270], ["dailyRest", 660], ["drive", 140]]);
  assert.equal(Date.parse(arrivalAt) - Date.parse(departAt), load.transit.value.totalMin * 60000);
});

test("schedule invariants hold across many random loads", async () => {
  for (let i = 0; i < 40; i += 1) {
    let x = (i * 0.754877666) % 1;
    const random = () => (x = (x * 9301 + 0.49297) % 1);
    const load = await make(3600 * (1 + (i % 28)), { originCity: null, destinationCity: null, random });
    const { events, departAt, arrivalAt } = buildSchedule(load);
    const transit = load.transit.value;
    // chronological, never overlapping
    let last = -Infinity;
    for (const e of events) {
      const start = Date.parse(e.from ?? e.at);
      const end = Date.parse(e.to ?? e.at);
      assert.ok(start >= last, `${load.id}: ${e.type} starts before the previous event ends`);
      assert.ok(end >= start);
      last = end;
    }
    assert.equal(events[0].type, "loading");
    assert.equal(events.at(-1).type, "unloading");
    assert.equal(events[1].type, "depart");
    assert.equal(events[1].at, load.timeWindows.loading.value.to);
    const sum = type => events.filter(e => e.type === type).reduce((n, e) => n + e.min, 0);
    assert.equal(sum("drive"), transit.drivingMin);
    assert.equal(events.filter(e => e.type === "break").length, transit.breaks);
    assert.equal(events.filter(e => e.type === "dailyRest").length, transit.dailyRests);
    assert.equal(Date.parse(arrivalAt), Date.parse(departAt) + transit.totalMin * 60000);
    // unloading never starts before arrival; the wait fills the gap exactly
    const unloading = load.timeWindows.unloading.value;
    assert.ok(Date.parse(unloading.from) >= Date.parse(arrivalAt));
    const wait = events.find(e => e.type === "wait");
    assert.equal(wait ? wait.min : 0, Math.round((Date.parse(unloading.from) - Date.parse(arrivalAt)) / 60000));
    // time zones: the origin's zone until arrival, the destination's after
    const origin = load.origin.value.timeZone, destination = load.destination.value.timeZone;
    for (const e of events) {
      const beforeArrival = !["arrival", "wait", "unloading"].includes(e.type);
      assert.equal(e.timeZone, beforeArrival ? origin : destination, `${e.type} time zone`);
    }
  }
});

test("scheduleFact is a valid computed fact that names its inputs", async () => {
  const fact = scheduleFact(await make(500 * 60));
  assert.deepEqual(validateFact(fact), []);
  assert.equal(fact.level, "computed");
  assert.equal(fact.formula, "schedule");
  assert.deepEqual(Object.keys(fact.inputs).sort(), ["breaks", "dailyRests", "drivingMin", "transitMin"]);
});
