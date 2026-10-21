# Freight World

An ATS / ETS2 style job generator built on the real game map, with live city pages: real local time, real weather and a real city photo. Not a game and not a real freight exchange. Not affiliated with SCS Software.

This is the `v2-freight-world` branch. The plan is in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) (Romanian) and the rules for contributors and tools in [AGENTS.md](AGENTS.md). The previous product, the Freight Operations Simulator (FOS), stays on `main`; its code is kept here for reference in [legacy/fos/](legacy/fos/).

## Current version: 2.0.0-alpha.3 (stage 2: city pages)

- A page for every city at `/ats/<state>/<city>` with the real photo, live local time, real weather (Open-Meteo), depots with what they offer and accept, facilities, roads, neighbouring cities and landmarks. City list at `/ats/`. US / metric units switch.
- City photos from Wikimedia Commons, one per city (`data/photos.json`); candidates with `npm run photos:candidates`.

### Stage 1

- Game data collected from Truck Simulator Wiki (CC BY-SA 4.0) into [data/ats/](data/ats/): 34 cities, 59 companies, 244 depots, 295 cargo, 32 trailer types, owner-approved name corrections in `aliases.json`, plus `issues.json` for manual checking. City coordinates from Wikidata (CC0). See [data/ats/README.md](data/ats/README.md).
- Collector: `npm run collect:ats` (cached, one request per second).

### Stage 0

- Astro static site: home page with an empty departures board, `/about` with sources and licences, 404 page.
- Design tokens, self-hosted Inter and JetBrains Mono, header with the ATS / ETS2 ("soon") switch, footer with the required attribution.

## Run and test

Requires Node 22.12 or newer.

```sh
npm install
npm run dev       # local site at http://localhost:4321
npm run build     # static site in dist/
npm test          # node --test
npm run collect:ats   # refresh data/ats/ from the wiki (cached)
npm run photos:candidates   # photo candidates per city from Wikimedia Commons
```

## Structure

```
src/pages/         one file per URL (index, about, 404, ats/index, ats/[state]/[city])
src/lib/           data access and pure helpers for the pages (units, weather codes)
src/scripts/       browser code: clock, weather, units switch
src/layouts/       base page layout
src/components/    header, footer, game switch, departures board
src/styles/        tokens.css (design tokens), fonts.css, global.css
src/i18n/          UI text (en.json) and the t() helper
src/data/          sources.json (sources and licences shown on /about)
data/ats/          ATS game data (CC BY-SA 4.0) and scope.json
data/photos.json   chosen photo per city (Wikimedia Commons)
scripts/photos/    photo candidates from Wikimedia Commons
scripts/ats/       collector for data/ats/ (MediaWiki API, Wikidata)
public/            fonts with licences, favicon
tests/             node --test
legacy/fos/        previous product, reference only (not built)
```

## Data and licences

Game data comes from Truck Simulator Wiki contributors (trucksimulator.wiki.gg), CC BY-SA 4.0. Weather by Open-Meteo. City coordinates from Wikidata (CC0). City photos from Wikimedia Commons (author and licence on each photo). Distances estimated from OpenStreetMap (ODbL). The full list is on `/about` and in `src/data/sources.json`.
