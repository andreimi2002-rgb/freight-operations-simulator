import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { computed, estimated, simulated, sourced, unavailable, validateFact, collectFacts } from "../src/engine/provenance.mjs";
import { validateLoad } from "../src/engine/load-model.mjs";
import { CARGO, resolveCargoId } from "../src/engine/cargo.mjs";
import { EQUIPMENT, eligibleEquipment, isCompatible, pickEquipment } from "../src/engine/equipment.mjs";
import { midpoint, packagingFacts, palletsOnFloor, planLoad } from "../src/engine/load-planning.mjs";
import { minimumTransit } from "../src/engine/transit-time.mjs";
import { fromLocal, generateWindows, localParts, offsetMin } from "../src/engine/time-windows.mjs";
import { drawCounterpart, randomPair, straightLineKm } from "../src/engine/places.mjs";
import { GenerationError, generateLoad } from "../src/engine/generator.mjs";
import { TRAILER_FLOORS } from "../src/data/equipment/floors.mjs";
import { PACKAGING_PROFILES } from "../src/data/cargo/packaging-profiles.mjs";
import { EUR_PALLET } from "../src/data/regulations/packaging.mjs";

const catalog = JSON.parse(readFileSync(new URL("../src/data/places/cities-ro-hu-bg.json", import.meta.url), "utf8"));
const cities = catalog.cities;
const city = name => cities.find(c => c.name === name);
const seq = values => { let i = 0; return () => values[i++ % values.length]; };

// A routing adapter that answers like Geoapify would, without the network.
const fakeRouter = (durationS = 40800) => ({
  calls: 0,
  async route({ origin, destination }) {
    this.calls += 1;
    return {
      distanceM: 832000, durationS, geometry: [[[origin.lon, origin.lat], [destination.lon, destination.lat]]],
      countries: ["RO", "HU"], viaNames: ["A1", "M43"], provider: "Test router", sourceUrl: "https://example.org/route", retrievedAt: "2026-10-20T08:00:00.000Z",
    };
  },
});

// ---------- provenance ----------
test("a sourced value without its source, date or URL is rejected", () => {
  assert.ok(validateFact(sourced(1, { name: "X", url: "https://x.org" })).length);
  assert.ok(validateFact(sourced(1, { name: "X", retrievedAt: "2026-01-01" })).length);
  assert.ok(validateFact(sourced(1, { url: "https://x.org", retrievedAt: "2026-01-01" })).length);
  assert.deepEqual(validateFact(sourced(1, { name: "X", url: "https://x.org", retrievedAt: "2026-01-01" })), []);
  assert.ok(validateFact(computed(1, "f", {})).length);
  assert.ok(validateFact(estimated(1, "")).length);
  assert.ok(validateFact(simulated(1, "")).length);
  assert.ok(validateFact(unavailable("9", "x")).length);
  assert.ok(validateFact({ ...unavailable("3", "x"), value: 5 }).length, "unavailable may not carry a value");
  assert.ok(validateFact(simulated(null, "n")).length, "a level other than unavailable needs a value");
  assert.equal(collectFacts({ a: sourced(1, {}), b: { c: unavailable("2", "r") } }).length, 2);
});

// ---------- load planning ----------
test("33 EUR pallets fit on each sourced trailer floor", () => {
  for (const id of ["curtainsider", "reefer", "dryVan"]) {
    assert.deepEqual(palletsOnFloor(TRAILER_FLOORS[id]), { rows: 11, across: 3, capacity: 33 }, id);
  }
  assert.deepEqual(palletsOnFloor({ lengthMm: 13600, widthMm: 2390 }), { rows: 11, across: 2, capacity: 22 });
});

test("pallet count, mass and loading metres", () => {
  const light = planLoad({ floor: TRAILER_FLOORS.curtainsider, unitMassKg: 650 });
  assert.equal(light.count, 33);
  assert.equal(light.totalMassKg, 21450);
  assert.equal(light.loadingMetres, 13.2);
  assert.equal(light.limitedBy, "floor");
  const heavy = planLoad({ floor: TRAILER_FLOORS.reefer, unitMassKg: 1200 }); // 31,000 kg payload
  assert.equal(heavy.count, 25);
  assert.equal(heavy.limitedBy, "payload");
  assert.ok(heavy.totalMassKg <= TRAILER_FLOORS.reefer.payloadKg);
  assert.equal(heavy.loadingMetres, 10.8); // 9 rows x 1.2 m
  assert.equal(midpoint({ min: 500, max: 900 }), 700);
});

test("every pallet mass estimate stays within the EUR pallet working load", () => {
  for (const [id, profile] of Object.entries(PACKAGING_PROFILES)) {
    assert.ok(CARGO[id], `profile for unknown cargo ${id}`);
    if (profile.unitType) assert.ok(profile.unitMassKg.max <= EUR_PALLET.safeWorkingLoadKg && profile.unitMassKg.min > 0, id);
    else assert.ok(profile.reason && profile.phase, id);
  }
  for (const id of Object.keys(CARGO)) assert.ok(PACKAGING_PROFILES[id], `no packaging profile for ${id}`);
});

test("packaging is unavailable, with a reason, when the cargo or the trailer has no data", () => {
  const ok = packagingFacts(CARGO.apples, "reefer");
  assert.equal(ok.unitCount.value, 33);
  assert.equal(ok.unitMassKg.level, "estimated");
  assert.equal(ok.totalMassKg.dependsOnEstimate, true);
  assert.equal(ok.unitType.level, "sourced");
  const tank = packagingFacts(CARGO.fuel, "fuelTanker");
  assert.equal(tank.unitCount.level, "unavailable");
  assert.equal(tank.unitCount.reason, "bulk");
  const multi = packagingFacts(CARGO.apples, "multiTemperatureReefer");
  assert.equal(multi.unitCount.reason, "trailerNotPalletized");
  assert.equal(multi.unitCount.phase, "4");
});

// ---------- transit time (Reg. 561/2006, simplified) ----------
test("minimum transit time: breaks and daily rest", () => {
  assert.equal(minimumTransit(240).totalMin, 240);
  assert.equal(minimumTransit(270).totalMin, 270);            // exactly 4 h 30: no break needed
  assert.equal(minimumTransit(360).totalMin, 405);            // 4h30 + 45 + 1h30
  assert.equal(minimumTransit(540).totalMin, 585);            // 9 h in one day: one break, no rest
  const long = minimumTransit(680);                           // 11 h 20 of driving
  assert.equal(long.totalMin, 270 + 45 + 270 + 660 + 140);
  assert.equal(long.breaks, 1);
  assert.equal(long.dailyRests, 1);
  const twoDays = minimumTransit(1200);                       // 20 h: two rests
  assert.equal(twoDays.dailyRests, 2);
  assert.ok(twoDays.segments.every(s => s.type !== "drive" || s.min <= 270));
  assert.equal(minimumTransit(0).totalMin, 0);
});

// ---------- time zones and windows ----------
test("local times follow each city's time zone, including summer time", () => {
  assert.equal(offsetMin(Date.parse("2026-07-01T12:00:00Z"), "Europe/Bucharest"), 180);
  assert.equal(offsetMin(Date.parse("2026-12-01T12:00:00Z"), "Europe/Bucharest"), 120);
  assert.equal(offsetMin(Date.parse("2026-07-01T12:00:00Z"), "Europe/Budapest"), 120);
  const instant = fromLocal({ year: 2026, month: 10, day: 21, minutes: 6 * 60 + 30 }, "Europe/Bucharest");
  assert.equal(new Date(instant).toISOString(), "2026-10-21T03:30:00.000Z");
  const p = localParts(instant, "Europe/Budapest");
  assert.equal(`${p.hour}:${p.minute}`, "5:30");
});

test("windows: working days, local hours, unloading after loading plus minimum transit", () => {
  const nows = ["2026-10-20T10:00:00Z", "2026-10-23T15:00:00Z", "2026-10-24T09:00:00Z", "2026-03-27T22:00:00Z"];
  for (const now of nows) {
    for (const transitMin of [200, 700, 1385, 3000]) {
      for (const draws of [[0], [0.5], [0.99], [0.2, 0.9, 0.4]]) {
        const w = generateWindows({ now: new Date(now), originTimeZone: "Europe/Bucharest", destinationTimeZone: "Europe/Budapest", transitMin, random: seq(draws) });
        const lf = Date.parse(w.loading.from), lt = Date.parse(w.loading.to), uf = Date.parse(w.unloading.from);
        const l = localParts(lf, "Europe/Bucharest"), u = localParts(uf, "Europe/Budapest");
        assert.ok(lf > Date.parse(now), "loading is in the future");
        assert.ok(l.weekday >= 1 && l.weekday <= 5, "loading on a working day");
        assert.ok(u.weekday >= 1 && u.weekday <= 5, "unloading on a working day");
        assert.ok(l.hour * 60 + l.minute >= 360 && l.hour * 60 + l.minute <= 840, "loading starts 06:00-14:00");
        assert.ok(u.hour * 60 + u.minute >= 360 && u.hour * 60 + u.minute <= 900, "unloading starts 06:00-15:00");
        assert.equal(lt - lf, 90 * 60000);
        assert.ok(uf >= lt + transitMin * 60000, "unloading after loading + transit");
      }
    }
  }
});

// ---------- places, cargo, trailer ----------
test("city pairs are 45-1450 km apart and never the same city", () => {
  for (const r of [0.1, 0.4, 0.8]) {
    const [a, b] = randomPair(cities, seq([r, (r + 0.37) % 1]));
    const d = straightLineKm(a, b);
    assert.ok(a.id !== b.id && d >= 45 && d <= 1450);
  }
  const bucharest = city("Bucharest");
  const other = drawCounterpart(cities, bucharest, () => 0.5);
  assert.ok(other.id !== bucharest.id);
});

test("cargo and trailer stay compatible", () => {
  for (const cargo of Object.values(CARGO)) {
    for (const id of cargo.equipmentIds) assert.ok(EQUIPMENT[id], `${cargo.id} -> ${id}`);
    assert.ok(isCompatible(cargo, pickEquipment(cargo, "random", () => 0.7).id));
  }
  assert.throws(() => pickEquipment(CARGO.apples, "grainHopper"));
  assert.equal(resolveCargoId({ family: "Vehicles & livestock", equipmentId: "reefer" }), null);
  assert.equal(CARGO[resolveCargoId({ family: "Agriculture & food", equipmentId: "reefer", random: () => 0.4 })].family, "Agriculture & food");
  assert.deepEqual(eligibleEquipment({ cargoId: "apples" }).map(e => e.id).sort(), [...CARGO.apples.equipmentIds].sort());
});

// ---------- generator ----------
test("generated loads are valid for many draws across RO/HU/BG", async () => {
  const router = fakeRouter();
  const countries = new Set();
  for (let i = 0; i < 60; i += 1) {
    let x = (i * 0.6180339) % 1;
    const random = () => (x = (x * 9301 + 0.49297) % 1);
    const load = await generateLoad({ cities, importedAt: catalog.metadata.importedAt, router, now: new Date("2026-10-20T08:00:00Z"), random });
    assert.deepEqual(validateLoad(load), [], load.id);
    assert.equal(load.schemaVersion, 3);
    countries.add(load.origin.value.countryCode);
    countries.add(load.destination.value.countryCode);
  }
  assert.deepEqual([...countries].sort(), ["BG", "HU", "RO"]);
  assert.equal(router.calls, 60);
});

test("generator honours picked cities, cargo and trailer, and reports impossible choices", async () => {
  const router = fakeRouter();
  const load = await generateLoad({ cities, importedAt: "2026-10-20", router, originCity: city("Bucharest"), destinationCity: city("Budapest"), cargoId: "apples", equipmentId: "reefer", now: new Date("2026-10-20T08:00:00Z"), random: () => 0.5 });
  assert.equal(load.origin.value.name, "Bucharest");
  assert.equal(load.destination.value.name, "Budapest");
  assert.equal(load.cargo.selection.value.id, "apples");
  assert.equal(load.equipment.selection.value.id, "reefer");
  assert.equal(load.packaging.unitCount.value, 33);
  assert.equal(load.transit.value.totalMin, 1385);
  assert.ok(load.warnings.some(w => w.id === "massDependsOnEstimate"));
  await assert.rejects(generateLoad({ cities, router, family: "Vehicles & livestock", equipmentId: "reefer" }), e => e instanceof GenerationError && e.code === "noCargo");
  await assert.rejects(generateLoad({ cities, router: { route: async () => ({ distanceM: 0 }) } }));
});

test("validateLoad catches a broken load", async () => {
  const load = await generateLoad({ cities, importedAt: "2026-10-20", router: fakeRouter(), now: new Date("2026-10-20T08:00:00Z"), random: seq([0.3, 0.71, 0.12, 0.55]) });
  const broken = structuredClone(load);
  broken.origin.value.countryCode = "DE";
  broken.timeWindows.unloading.value.from = broken.timeWindows.loading.value.to;
  delete broken.packaging.unitCount;
  const problems = validateLoad(broken);
  assert.ok(problems.some(p => p.includes("origin outside")));
  assert.ok(problems.some(p => p.includes("minimum transit")));
  assert.ok(problems.some(p => p.includes("packaging.unitCount")));
});

// ---------- cleanup: no game modes left ----------
test("no ATS/ETS2 references in the engine or the UI", () => {
  const scan = dir => readdirSync(new URL(dir, import.meta.url), { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? scan(`${dir}${entry.name}/`) : /\.(mjs|js)$/.test(entry.name) ? [`${dir}${entry.name}`] : []);
  for (const file of [...scan("../src/engine/"), ...scan("../src/ui/"), ...scan("../src/view-model/")]) {
    let text;
    try { text = readFileSync(new URL(file, import.meta.url), "utf8"); } catch { continue; }
    assert.ok(!/\b(ATS|ETS2|WORLD_MODES)\b/.test(text), `${file} still mentions a game mode`);
  }
});

test("the city catalog is RO/HU/BG only, without city sections", () => {
  assert.ok(cities.length >= 200);
  assert.ok(cities.every(c => ["RO", "HU", "BG"].includes(c.countryCode) && c.population >= 15000 && c.featureCode !== "PPLX" && c.timeZone));
  assert.ok(!cities.some(c => /^Sector \d|kerület$/.test(c.name)));
  assert.equal(catalog.metadata.license, "CC BY 4.0");
});
