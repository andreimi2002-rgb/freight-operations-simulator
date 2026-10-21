# Freight World

An ATS / ETS2 style job generator built on the real game map, with live city pages: real local time, real weather and a real city photo. Not a game and not a real freight exchange. Not affiliated with SCS Software.

This is the `v2-freight-world` branch. The plan is in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) (Romanian) and the rules for contributors and tools in [AGENTS.md](AGENTS.md). The previous product, the Freight Operations Simulator (FOS), stays on `main`; its code is kept here for reference in [legacy/fos/](legacy/fos/).

## Current version: 2.0.0-alpha.1 (stage 0: foundation)

- Astro static site: home page with an empty departures board, `/about` with sources and licences, 404 page.
- Design tokens, self-hosted Inter and JetBrains Mono, header with the ATS / ETS2 ("soon") switch, footer with the required attribution.
- No game data yet: it arrives in stage 1.

## Run and test

Requires Node 22.12 or newer.

```sh
npm install
npm run dev       # local site at http://localhost:4321
npm run build     # static site in dist/
npm test          # node --test
```

## Structure

```
src/pages/         one file per URL (index, about, 404)
src/layouts/       base page layout
src/components/    header, footer, game switch, departures board
src/styles/        tokens.css (design tokens), fonts.css, global.css
src/i18n/          UI text (en.json) and the t() helper
src/data/          sources.json (sources and licences shown on /about)
public/            fonts with licences, favicon
tests/             node --test
legacy/fos/        previous product, reference only (not built)
```

## Data and licences

Game data will come from Truck Simulator Wiki contributors (trucksimulator.wiki.gg), CC BY-SA 4.0. Weather by Open-Meteo. City photos from Wikimedia Commons (author and licence on each photo). Distances estimated from OpenStreetMap (ODbL). The full list is on `/about` and in `src/data/sources.json`.
