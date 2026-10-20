# The Load model (schema version 3)

One generated truck load. Built by `generateLoad()` in `src/engine/generator.mjs`, checked by `validateLoad()` in `src/engine/load-model.mjs`, shown through `buildLoadSheet()` in `src/view-model/load-sheet.mjs` (the only code that reads a Load for the UI).

## Facts and provenance

Every value is a **fact** (`src/engine/provenance.mjs`):

| Level | Shape | Meaning |
|---|---|---|
| `sourced` | `{ value, level, source: { name, url, retrievedAt, license?, note? } }` | From a named public dataset, regulation or service |
| `computed` | `{ value, level, formula, inputs: {…}, dependsOnEstimate? }` | Derived by the engine; `formula` is an id, `inputs` the values used |
| `estimated` | `{ value, level, basis, range? }` | Reasoned approximation; `basis` is an id naming the reasoning |
| `simulated` | `{ value, level, note }` | Part of the generated shipment itself |
| `unavailable` | `{ value: null, level, phase, reason }` | No value yet; `phase` says when it comes, `reason` why |

Ids (formula, basis, note, reason, source note) are language-neutral; the UI translates them (`formula.*`, `basis.*`, `note.*`, `reason.*`, `sourceNote.*` in `src/i18n/ro.json`). A coherent record from one source (a city, the route answer) is one fact whose value is an object.

`validateFact()` rejects: a sourced fact without name, http(s) URL or retrieval date; a computed fact without formula or inputs; an estimated fact without basis; a simulated fact without note; an unavailable fact with a value or an unknown phase; any other fact without a value.

## Shape

```
id                       "FOS-2026-XXXXX"
createdAt                ISO time
schemaVersion            3
scope.countries          the active countries (src/data/countries.mjs)
origin / destination     sourced  { geonamesId, name, countryCode, lat, lon, timeZone, population,
                                    placeType: "city", locode: null }            GeoNames, CC BY 4.0
route.summary            sourced  { distanceKm, durationS, countries[], viaNames[], geometry,
                                    profile, trafficModel, hasTolls, provider }   routing adapter
route.borderCrossings    unavailable (phase 2)
cargo.selection          simulated { id, name, family, loadForm, handling[], regulatoryReview,
                                     equipmentIds[] }
cargo.nstChapters        estimated ["01","04"]            (phase 3: Eurostat CN→NST)
cargo.cnCode / adr / temperature   unavailable (phase 3)
packaging.unitType       sourced  EUR pallet (EPAL)       or unavailable
packaging.unitCount      computed palletsOnFloor | palletsByPayload
packaging.unitMassKg     estimated unitMass.<group>, range {min,max}
packaging.totalMassKg    computed totalMass, dependsOnEstimate: true
packaging.loadingMetres  computed loadingMetres
equipment.selection      computed { id, name, category, checks[] }  trailerRuleRandom | trailerRuleChosen
equipment.floor          sourced  { lengthMm, widthMm, heightMm, payloadKg }  DSV  or unavailable (phase 4)
transit                  computed { drivingMin, totalMin, breaks, dailyRests, segments[], exceedsWeeklyLimit }
                                  minimumTransit, regulation: Reg. (EC) 561/2006
timeWindows.loading      simulated { from, to, timeZone }
timeWindows.unloading    simulated { from, to, timeZone, slackMin }
parties.shipperRole      simulated role id
parties.consigneeRole    simulated role id
truck: null (phase 4) · driver: null (phase 6) · costs: null (phase 6) · documents: [] (phase 7)
warnings[]               [{ id }]  routeDurationNotTachograph, massDependsOnEstimate,
                                   weekendUnloading, weeklyDrivingLimit, regulatoryReview
```

## Derived views (not stored in the Load)

- **Schedule** (`src/engine/schedule.mjs`, `scheduleFact(load)`): a computed fact built from `timeWindows.loading` and `transit.segments`: loading, departure at the end of the loading window, each drive/break/daily-rest segment back to back, arrival, an optional wait until the unloading window, unloading. Formula id `schedule`; inputs: driving, transit, breaks, daily rests. Times of the segments carry the origin's time zone; arrival, wait and unloading the destination's.
- **Tabs:** `buildLoadSheet` groups the Load's facts into eight tabs (each fact in exactly one). Rows for later stages (placeholders) are defined in the view model with their phase and reason; they are not facts of the Load.

## Rules

- **Packaging:** EUR pallets lie lengthwise; count = min(⌊L/1200⌋ × ⌊W/800⌋, ⌊payload / mass per pallet⌋). Only cargo with a pallet profile on a trailer with a sourced floor (curtainsider, reefer, box). Otherwise all packaging facts are unavailable with the reason (`bulk`, `specialUnit`, `dangerousGoods`, `container`, `trailerNotPalletized`).
- **Minimum transit (simplified Reg. 561/2006):** route driving time; 45 min break after every 4 h 30 min of driving; 11 h daily rest after 9 h of driving in a day. One driver, no extensions, no reduced rest.
- **Windows:** loading on a working day 1–3 working days after generation, starting 06:00–14:00 local time at the origin, 90 min long; unloading starts no earlier than loading end + minimum transit + a simulated slack (0–3 h), rounded up to 30 min, 06:00–15:00 local time at the destination, 3 h long, moved past weekends (with a warning).
- **Validation:** required paths present, every fact valid, both ends in RO/HU/BG with coordinates, trailer listed for the cargo, unloading not before loading end + transit.

## Storage

The browser keeps up to 30 loads in `localStorage` under `fos-load-history-v1`; anything that fails `validateLoad()` is skipped. The phase 1A history (`fos-mission-history-v3`) is left untouched and not shown.
