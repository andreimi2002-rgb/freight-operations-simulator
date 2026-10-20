# Freight Operations Simulator (FOS)

FOS is becoming a **real-world road freight load generator**: one generated truck load, as close to reality as possible and very detailed. First scope: Romania, Hungary, Bulgaria. The world is real; the load is simulated. Rules for contributors and tools are in [AGENTS.md](AGENTS.md); plans and the Load model are in [docs/](docs/).

## Current version: 0.14.0 (phase 2A: distance by country, border crossings, UN/LOCODE)

- **Distance by country** and **border crossings** (internal/external Schengen, OpenStreetMap names) computed from the route geometry and Natural Earth borders; crossings on the map. Header codes from **UN/LOCODE**. Data prepared offline: `node scripts/build-borders.mjs`, `build-border-crossings.mjs`, `build-locodes.mjs`.

### Phase 1D

- **City cards** for origin and destination with a Wikimedia Commons photo (credited; every one of the 254 cities has one, a styled panel appears only if a photo fails to load) and **live weather** from MET Norway: now, the next three days and the forecast at the loading and unloading windows.
- `node scripts/build-city-photos.mjs` prepares the photos (free licences only, checked links); `/api/weather/:id` serves the weather (cached, rate limited).

### Phase 1C

- **Eight tabs** under the route header: Prezentare, Hartă și rută, Marfă, Camion și trailer, Program și pauze, Costuri, Documente, Surse și calcule. The active tab is in the address (`#cargo`). Things the finished product will show but FOS cannot compute yet appear as "Indisponibil încă — Etapa N".
- **Schedule:** a day-by-day timeline (loading, departure, drives, breaks, daily rest, arrival, wait, unloading) computed from the loading window and the minimum-transit segments.
- **Countries are data** (`src/data/countries.mjs`, one city file per country): adding a country needs data, not code.

### Phase 1B (kept below)

- **Load sheet with provenance on every row.** Each fact is *sourced* (public dataset, regulation or service), *computed* (derived by a rule, with formula and inputs), *estimated* (reasoned approximation, with its basis) or *simulated* (the generated shipment itself). A row without a value says "Indisponibil încă — Etapa N" and why. Click any row for the details.
- **Cities:** 270 places with at least 15,000 inhabitants in the active countries, today Romania, Hungary and Bulgaria (GeoNames), random or picked with the city search (Ctrl/⌘+K or `/`).
- **Route:** heavy-truck route from Geoapify (temporary, behind an adapter), drawn with MapLibre on OpenFreeMap tiles.
- **Packaging and mass:** EUR pallets (EPAL) on the trailer floor (typical DSV floors for curtainsider, reefer and box), limited by payload; estimated mass per pallet; total mass; loading metres.
- **Minimum transit time** under Reg. (EC) 561/2006, simplified (45 min break after 4 h 30 min, 11 h rest after 9 h of driving).
- **Time windows** for loading and unloading on working days, in each city's local time; simulated shipper and consignee roles.
- Romanian interface (`src/i18n/ro.json`, `ro-RO` formats), one-page print / PDF, works on desktop and phone.

### Not available yet (shown as such in the UI)
Border crossing point (phase 2), CN code, temperature ranges and ADR data (phase 3), packaging for bulk, tank, vehicle and other non-pallet cargo (phases 3–4), real truck and trailer models and legal mass limits (phase 4), full driver-hours plan, weekend bans and costs (phase 6), documents (phase 7).

## Run and test

```sh
node --test                      # automated tests
node scripts/dev-server.mjs      # http://localhost:8080 with a FIXTURE route (local testing only)
netlify dev                      # real routes: needs GEOAPIFY_API_KEY in a local .env (not committed)
node scripts/import-geonames.mjs # rebuild the city files of the active countries (or: ... AT GR); refuses to write a broken result
node scripts/build-city-photos.mjs # prepare city photos from Wikidata/Wikipedia/Wikimedia Commons + curated.json (or: ... AT GR)
node scripts/prune-cities-without-photo.mjs # leave out cities without a usable photo (recorded in exclusions.json)
node scripts/build-places-lookup.mjs # rebuild the city index used by /api/weather (no download)
```

The dev server answers `/api/weather/:id` with real MET Norway data and returns a synthetic route labelled "FIXTURE" and the page shows a "local test data" notice; it is never used in production.

## Configure Geoapify

The Netlify Functions read `GEOAPIFY_API_KEY` on the server. Add the key in Netlify environment variables for **Functions** scope and the Production and Deploy Previews contexts. The key is not stored in this repository or exposed in browser code. Without it the UI says the routing service is not configured. Geoapify is temporary: routing moves to an own OpenStreetMap graph in phase 5.

## Project layout

- `index.html` — page shell (text comes from `data-i18n` keys); `fonts/` — Inter and JetBrains Mono (SIL OFL 1.1).
- `src/engine/` — pure, tested modules: `provenance`, `load-model`, `places`, `cargo`, `equipment`, `load-planning`, `transit-time`, `time-windows`, `schedule`, `parties`, `route`, `generator`; stubs `trucks`, `driver-hours`, `costs`, `documents`.
- `src/adapters/` — `routing-geoapify.mjs` (route contract, temporary provider) and `map-maplibre.mjs` (map and print snapshot).
- `src/data/` — `countries.mjs` (active countries), `places/` (one city file per country), `cargo/` (catalog, pallet profiles, NST estimates, roles), `equipment/` (catalog, sourced floors), `regulations/` (EUR pallet, Reg. 561/2006), `scope.mjs` (city codes and names).
- `src/view-model/` — `load-sheet.mjs`: **the only code that reads a Load for the UI**; `provenance.mjs` labels.
- `src/ui/` — `hero`, `panels` (rows, cards), `tab-panels` and `tabs` (tab bar and the eight panels), `generator`, `palette`, `about`, `print`, `layers`, `dom`; `src/main.js` — state, history, events.
- `src/i18n/` — `ro.json` and `i18n.mjs`.
- `netlify/functions/` — `truck-route.mjs`; `search-places.mjs` (unused until phase 2).
- `scripts/` — GeoNames importer and the local dev server. `archive/` — game reference catalog (phase 8).
- `tests/` — `node --test` suites. `docs/` — phase plans, `LOAD-MODEL.md`, the design mockup.

## Data and licences

See [src/DATA-LICENSES.md](src/DATA-LICENSES.md). FOS is unofficial and not affiliated with SCS Software or Truck Simulator Wiki.

## Limits

The route is a heavy-truck estimate (modelled 40 t, 4.1 m) with approximated traffic. Masses depend on estimated pallet masses. The transit time is a simplified minimum for one driver, not a legal driving plan. Nothing is confirmed for a specific vehicle, trailer, cargo, road restriction, permit, facility or company. Hazardous-goods status is never inferred.
