# Freight World

An ATS / ETS2 style job generator built on the real game map, with live city pages: real local time, real weather and a real city photo. Not a game and not a real freight exchange. Not affiliated with SCS Software.

Live at https://freight-operations-simulator.netlify.app (from `main`). The plan is in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) (Romanian) and the rules for contributors and tools in [AGENTS.md](AGENTS.md). The previous product, the Freight Operations Simulator (FOS), is kept as the git tag `fos-final`.

## Current version: 2.0.0-alpha.14 (saved pages and history)

- Star any city, company, cargo, trailer, truck or job sheet; `/saved` lists them with the recently opened pages. Only in this browser (localStorage), no account.

### Search and SEO

- Search in the header (`/` or Ctrl+K): cities, companies, cargo, trailers, trucks.
- sitemap.xml, robots.txt, link previews (Open Graph / Twitter) and schema.org structured data. The default preview image is `public/og-default.png`; after the data changes, regenerate it with `node scripts/og/card.mjs out.html` and a 1200x630 headless Chrome screenshot.

### Cargo, trailer and truck pages


- A page for every cargo (who offers it, who accepts it, where it can go), trailer and truck; lists with filter.

### Phase A

- The job sheet opens with a job offer card like the in-game market, with urgency and time to deliver, a driving plan under US Hours of Service (breaks and rests shown on the route map) and the next jobs from the destination.
- Map icons: city facilities and companies when zoomed in.

### Map

- Map in the style of the in-game map (`/ats/map`), on city pages and with the route on job sheets; drawn from Natural Earth (public domain), `npm run map:ats`.

### Company pages

- A page for every company on the starting map (`/ats/company/<id>`): depots, cargo, where its cargo goes and who supplies it.

### Arizona

- Arizona added (16 cities): the starting map of ATS (California, Nevada, Arizona) is complete with 50 cities. Other states come later.

### Stage 4

- A full sheet for every job at `/ats/mission/<id>`: depots with game ids, cargo, hazmat, trailer with dealer models, recommended trucks, distance and arrival time, weather at both ends with bad-weather warnings, required DLCs.
- "Generate a job" button; "My DLCs" saved in the browser and used by boards, generator and planner.
- ATS trucks collected from the wiki (`data/ats/trucks.json`).

### Stage 3

- Live departures boards on every city page and on the home page, from a deterministic job generator (`src/engine/`): only jobs possible in the game, new ones every hour. Route planner at `/ats/planner`.
- Estimated road distances between all cities (`data/ats/distances.json`, OpenStreetMap via OSRM); `npm run distances:ats`.

### Stage 2

- A page for every city at `/ats/<state>/<city>` with the real photo, live local time, real weather (MET Norway), depots with what they offer and accept, facilities, roads, neighbouring cities and landmarks. City list at `/ats/`. US / metric units switch.
- City photos from Wikimedia Commons, one per city (`data/photos.json`); candidates with `npm run photos:candidates`.

### Stage 1

- Game data collected from Truck Simulator Wiki (CC BY-SA 4.0) into [data/ats/](data/ats/): 34 cities, 59 companies, 244 depots at the time (now 50 cities with Arizona), 295 cargo, 32 trailer types, owner-approved name corrections in `aliases.json`, plus `issues.json` for manual checking. City coordinates from Wikidata (CC0). See [data/ats/README.md](data/ats/README.md).
- Collector: `npm run collect:ats` (cached, one request per second).

### Stage 0

- Astro static site: home page with an empty departures board, `/about` with sources and licences, 404 page.
- Design tokens, self-hosted Inter and JetBrains Mono, header with the ATS / ETS2 ("soon") switch, footer with the required attribution.

## Run and test

Requires Node 22.12 or newer.

```sh
npm install
npm run dev       # local site at http://localhost:4321 (the weather needs `netlify dev`)
npm run build     # static site in dist/
npm test          # node --test
npm run collect:ats   # refresh data/ats/ from the wiki (cached)
npm run photos:candidates   # photo candidates per city from Wikimedia Commons
npm run distances:ats       # estimated road distances between cities (OSRM)
npm run map:ats             # map layers from Natural Earth (data/map/ats-map.json)
```

## Structure

```
src/pages/         one file per URL (index, about, 404, ats/index, ats/[state]/[city], ats/planner, ats/mission)
src/engine/        job generator and job dataset (pure, reusable)
src/lib/           data access and pure helpers for the pages (units, weather, formatting)
src/scripts/       browser code: clock, weather, units switch, departures boards, route planner
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
netlify/           weather function (/api/weather/<city>, MET Norway)
```

## Data and licences

Game data comes from Truck Simulator Wiki contributors (trucksimulator.wiki.gg), CC BY-SA 4.0. Weather data from MET Norway (CC BY 4.0). City coordinates from Wikidata (CC0). City photos from Wikimedia Commons (author and licence on each photo). Distances estimated from OpenStreetMap (ODbL). The full list is on `/about` and in `src/data/sources.json`.
