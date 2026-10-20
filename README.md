# Freight Operations Simulator (FOS)

FOS is becoming a **real-world road freight load generator**: one generated truck load, as close to reality as possible and very detailed. First scope: Romania, Hungary, Bulgaria. The world is real; the load is simulated. Rules for contributors and tools are in [AGENTS.md](AGENTS.md); the roadmap and the current plan are in [docs/](docs/).

## Current version: 0.10.0 (phase 1A: redesign)

- **New look** in the Airport Live visual system: sticky top bar with recent loads and a city search (Ctrl/⌘+K or `/`), a hero with the route code (`BUC → BUD`), glance cards (map and cargo), KPI cards and the **load sheet**.
- **Provenance on every row.** Each fact is *sourced* (public dataset or service), *computed* (derived by a rule), *estimated* (reasoned approximation, with its basis) or *simulated* (the generated shipment itself). A row the engine cannot fill yet says "Indisponibil încă — Etapa N" instead of showing an invented value. Click a row for its source, formula, basis and inputs.
- **Route map** with MapLibre GL JS and OpenFreeMap vector tiles (no key). Route geometry still comes from Geoapify (temporary, behind the route function).
- **Romanian interface**, all text in `src/i18n/ro.json`, numbers and dates formatted with `Intl` (`ro-RO`). Another language means adding a JSON file, not editing components.
- **One-page print / PDF** (light theme) with a map snapshot and the provenance labels; works without a pop-up.
- Cities: the 120 GeoNames records for RO/HU/BG minus city districts (Bucharest sectors, Budapest districts). Cargo names, trailer names and families are translated; the long handling notes are still English and marked "(în engleză)".
- Still the old engine: random city pair or picked cities, Geoapify heavy-truck route, the 79-cargo catalog and trailer suggestions. The ATS/ETS2 modes are hidden in the UI (removed in phase 1B).

### Not available yet (shown as such in the UI)
Border crossing point (phase 2), temperature ranges and ADR data (phase 3), packaging, mass, loading metres, time windows and shipper role (phase 1B), cost and driver breaks (phase 6), documents (phase 7).

## Run and test

```sh
node --test                      # automated tests
node scripts/dev-server.mjs      # http://localhost:8080 with a FIXTURE route (local testing only)
netlify dev                      # real routes: needs GEOAPIFY_API_KEY in a local .env (not committed)
```

The dev server returns a synthetic route labelled "FIXTURE" and the page shows a "local test data" notice; it is never used in production.

## Configure Geoapify

The Netlify Functions read `GEOAPIFY_API_KEY` on the server. Add the key in Netlify environment variables for **Functions** scope and the Production and Deploy Previews contexts. The key is not stored in this repository or exposed in browser code. Without it the UI says the routing service is not configured.

Geoapify is temporary: routing moves to an own OpenStreetMap graph in phase 5. The Static Maps API is no longer used.

## Project layout

- `index.html` — page shell (text comes from `data-i18n` keys).
- `fonts/` — Inter and JetBrains Mono (SIL OFL 1.1, licences included).
- `src/styles.css` — design tokens and components (Airport Live system, provenance colours, print styles).
- `src/main.js` — orchestration: state, history (`localStorage`, guarded), generation, events.
- `src/i18n/` — `ro.json` and `i18n.mjs` (lookup and formatting).
- `src/view-model/` — `provenance.mjs` and `load-sheet.mjs`: **the only code that reads a mission**. The UI only reads the result of `buildLoadSheet(mission)`.
- `src/ui/` — `hero`, `panels` (cargo, KPIs, load sheet, detail), `generator`, `palette`, `about`, `print`, `layers` (drawers and focus handling), `dom`.
- `src/map/route-map.mjs` — MapLibre map and print snapshot.
- `src/data/` — cargo and corridor catalogs (unchanged), `scope.mjs` (RO/HU/BG filter, city codes and names), `selection.mjs` (cargo/trailer rules), `nst-estimates.mjs`.
- `src/mission-engine.mjs` — scenario engine (unchanged in this phase).
- `netlify/functions/` — `truck-route.mjs` (route), `search-places.mjs` (unused until phase 2).
- `scripts/` — GeoNames importer and the local dev server.
- `tests/` — `node --test` suites.
- `docs/` — phase plans and the design mockup.

## Data and licences

See [src/DATA-LICENSES.md](src/DATA-LICENSES.md). FOS is unofficial and not affiliated with SCS Software or Truck Simulator Wiki.

## Limits

The route is a heavy-truck estimate (modelled 40 t, 4.1 m). It is not confirmed for a specific vehicle, trailer, cargo, road restriction, permit, facility or driver-hours rule. Marfa and trailer suggestions are planning heuristics, not verified compatibility. Hazardous-goods status is never inferred.
