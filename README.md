# Freight World

An ATS / ETS2 style job generator built on the real game map, with live city pages: real local time, real weather and a real city photo. Not a game and not a real freight exchange. Not affiliated with SCS Software.

This is the `v2-freight-world` branch. The plan is in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) (Romanian) and the rules for contributors and tools in [AGENTS.md](AGENTS.md). The previous product, the Freight Operations Simulator (FOS), stays on `main`; its code is kept here for reference in [legacy/fos/](legacy/fos/).

## Current version: 2.0.0-alpha.2 (stage 1: ATS data for California and Nevada)

- Game data collected from Truck Simulator Wiki (CC BY-SA 4.0) into [data/ats/](data/ats/): 34 cities, 59 companies, 244 depots, 295 cargo, 32 trailer types, plus `issues.json` for manual checking. City coordinates from Wikidata (CC0). See [data/ats/README.md](data/ats/README.md).
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
```

## Structure

```
src/pages/         one file per URL (index, about, 404)
src/layouts/       base page layout
src/components/    header, footer, game switch, departures board
src/styles/        tokens.css (design tokens), fonts.css, global.css
src/i18n/          UI text (en.json) and the t() helper
src/data/          sources.json (sources and licences shown on /about)
data/ats/          ATS game data (CC BY-SA 4.0) and scope.json
scripts/ats/       collector for data/ats/ (MediaWiki API, Wikidata)
public/            fonts with licences, favicon
tests/             node --test
legacy/fos/        previous product, reference only (not built)
```

## Data and licences

Game data comes from Truck Simulator Wiki contributors (trucksimulator.wiki.gg), CC BY-SA 4.0. Weather by Open-Meteo. City coordinates from Wikidata (CC0). City photos from Wikimedia Commons (author and licence on each photo). Distances estimated from OpenStreetMap (ODbL). The full list is on `/about` and in `src/data/sources.json`.
