import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CARGO, EQUIPMENT } from "../src/mission-engine.mjs";
import { drawCounterpart, eligibleCargo, eligibleEquipment, families, resolveCargoId } from "../src/data/selection.mjs";
import { scopeCities } from "../src/data/scope.mjs";

const catalog = JSON.parse(readFileSync(new URL("../src/data/geonames-cities.json", import.meta.url), "utf8"));
const pool = scopeCities(catalog).cities;

test("a random cargo respects the chosen family and trailer", () => {
  for (const family of families()) {
    for (const draw of [0, 0.5, 0.999]) {
      const id = resolveCargoId({ family, random: () => draw });
      assert.equal(CARGO[id].family, family);
    }
  }
  const id = resolveCargoId({ family: "Agriculture & food", equipmentId: "reefer", random: () => 0.4 });
  assert.equal(CARGO[id].family, "Agriculture & food");
  assert.ok(CARGO[id].equipmentIds.includes("reefer"));
});

test("a specific cargo is kept; an impossible family + trailer gives null", () => {
  assert.equal(resolveCargoId({ cargoId: "apples", family: "Chemicals & regulated" }), "apples");
  assert.equal(resolveCargoId({ family: "Vehicles & livestock", equipmentId: "reefer" }), null);
});

test("trailer choices follow the cargo, then the family, then everything", () => {
  assert.deepEqual(eligibleEquipment({ cargoId: "apples" }).map(e => e.id).sort(), [...CARGO.apples.equipmentIds].sort());
  const family = eligibleEquipment({ family: "Vehicles & livestock" }).map(e => e.id);
  assert.ok(family.includes("livestockTrailer") && !family.includes("reefer"));
  assert.equal(eligibleEquipment({}).length, Object.keys(EQUIPMENT).length);
  assert.equal(eligibleCargo({}).length, Object.keys(CARGO).length);
});

test("the missing end of a route is drawn 45-1450 km away and never equals the fixed city", () => {
  const bucharest = pool.find(city => city.name === "Bucharest");
  for (const draw of [0, 0.3, 0.7, 0.999]) {
    const other = drawCounterpart(pool, bucharest, () => draw);
    assert.ok(other && other.id !== bucharest.id);
    assert.ok(pool.some(city => city.id === other.id));
  }
  assert.equal(drawCounterpart([bucharest], bucharest), null);
});
