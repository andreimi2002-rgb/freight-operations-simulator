# Changelog

## 2.0.0-alpha.11 — 2026-10-22 (phase A: the job sheet as a game job offer)

- **Job offer card** at the top of the job sheet, in the spirit of the in-game freight market: cargo name with our own skill icons (hazmat class, heavy, fragile, high value), from → to with company, depot type and game ID, distance, time to deliver, weight, trailer, deadline.
- **Urgency and time to deliver** (Standard / Important / Urgent): a Freight World rule shown as simulated. The level is picked from the job id (60 / 30 / 10 %); the time allowed is the planned trip plus 50 / 25 / 10 % (at least 1 hour). Urgent and important jobs are marked on the departures boards too.
- **Driving plan** under US Hours of Service (FMCSA, 49 CFR 395.3): at most 11 hours of driving, a 30-minute break after 8 hours, 10 hours off before driving again (stricter than the game’s sleep every 14 in-game hours). Timeline with clock times, distance per leg, breaks and rests located near the closest city on the route; the stops are numbered on the route map. The arrival time and the weather at arrival now include the breaks.
- **Game time vs real time:** the planned trip in game hours and its real duration (1 in-game hour = 3 real minutes outside cities, Truck Simulator Wiki “Time Compression”).
- Duplicate cards removed from the sheet (pick-up, delivery and route now live in the offer and the plan).
- 6 new tests (94 in all).

## 2.0.0-alpha.10 — 2026-10-22 (map in the style of the in-game map)

- **Map** at `/ats/map`, drawn by Freight World in a style close to the ATS in-game map: near-black background, dark land, grey state borders, pale amber roads seen from afar; zoomed in, Interstate and US highways turn bright amber and the others grey, with Interstate (red/blue), US (white shield) and state (white box) road shields; amber city dots and labels with a dark halo. Pan, wheel and pinch zoom, buttons; click a city to open it. No game files are used (owner asked SCS for permission to use the real map).
- **Map on every city page** (centred on the city) and **route on every job sheet**, drawn along the real roads with a shortest path on the map’s road graph.
- `scripts/map/build-map.mjs` (`npm run map:ats`): Natural Earth 1:10m (public domain) roads, states and lakes for the states in scope, clipped, simplified and projected to `data/map/ats-map.json` (125 KB), served as `/data/ats-map.json`. A few local roads are missing at this scale (e.g. AZ-95 through Lake Havasu City).
- Header: "Map" link; the navigation wraps on phones (it no longer fits on one line).
- 3 new tests (88 in all): map layers, a route for every pair of cities (median length within 1% of the OSRM road distance), Los Angeles → Phoenix drawn along I-10.

## 2.0.0-alpha.9 — 2026-10-22 (company pages)

- **Company pages:** `/ats/companies` lists the 67 companies with depots on the starting map, grouped by category; `/ats/company/<id>` shows each one: industry, depots and cities, every depot type with its game ID, cities (and gas station locations), cargo offered and accepted (DLC cargo grouped), **where its cargo goes** and **who supplies it** (computed from the depot lists: only links that exist in the game), a job generator limited to its depots, and the wiki link. A generated two-letter monogram stands in for the logo (game artwork is not used).
- Links to company pages from city pages and job sheets; "Companies" in the header.
- `data/ats/observations.json`: jobs seen in the game by the owner, for calibrating distances and pay later (first entry: Los Angeles → Phoenix, 531 km, 6 h 22 min).
- 5 new tests (85 in all).

## 2.0.0-alpha.8 — 2026-10-22 (Arizona: the starting map is complete)

- **Arizona** (free DLC) added: 16 cities, now 50 in all (CA 24, NV 10, AZ 16), 67 companies and 347 depots. Arizona does not observe daylight saving time, so its cities use `America/Phoenix` (a per-state time zone override in `data/ats/scope.json`).
- **Photos:** 15 of the 16 Arizona cities have a photo chosen by looking at each candidate (reasons in `data/photos.json`); San Simon keeps a placeholder (no free photo on Commons passes the rules).
- **Distances** recomputed for all 2,450 city pairs (OSRM, OpenStreetMap).
- Map DLC names on city pages ("Arizona (free DLC)"), new "Airport" facility label, texts updated for the starting map.
- 2 new tests (80 in all): map DLC names, Arizona time zone. All 16 Arizona pages checked in Chrome at phone width.

## 2.0.0-alpha.7 — 2026-10-22 (Freight World, stage 4: job sheets)

- **Launched:** Freight World replaced FOS on freight-operations-simulator.netlify.app (PR #16; FOS kept as git tag `fos-final`). Work now goes to `main` through pull requests.
- **Job sheet** at `/ats/mission/<id>`, opened from the departures boards, the job generator and the route planner. The id is made of stable game ids (city, depot, cargo, destination, trailer, weight), so links survive a data refresh; a job that no longer exists says so. The sheet shows: pick-up and delivery depots with their game ids; cargo weight (or range), hazmat class and UN number (with the wiki's correction when the in-game number is flagged), special cargo flags; required DLCs (owned or not); distance, estimated drive time and arrival time if leaving now, with a night-arrival note; weather now at the start and at the destination at the arrival time; the trailer type with its dealer models (price, buyable or company trailer); recommended trucks.
- **Bad weather** at either end (snow, sleet, thunderstorm, fog, heavy rain) raises a warning; no delay is invented (owner's decision). Weekend and season rules are postponed (no game data).
- **Trucks:** the collector now reads the 19 released ATS trucks from the wiki (`data/ats/trucks.json`: make, engines with horsepower range, transmissions, cabs); 4 announced trucks are left out and listed in issues.json. **Truck recommendation**, a Freight World rule shown as simulated: at least 400 hp up to 25,000 lb, 450 hp up to 45,000 lb, 500 hp above, 550 hp for heavy cargo; brands with a dealer in the start city first; electric trucks left out.
- **My DLCs:** a header button opens a dialog to tick the cargo DLCs you own (saved in this browser). Boards dim the jobs you cannot take; the generator and the planner get "Only jobs for my DLCs".
- The weather function also returns a 72-hour series (for the arrival time). Netlify rewrites `/ats/mission/*` to the sheet page.
- 4 new tests (78 in all): sheet ids round trip and stale jobs, truck rule, sheet weather helpers, truck data.

## 2.0.0-alpha.6 — 2026-10-22 (Generate a job)

- **Generate a job** button on the home page (from any city or a chosen one) and on every city page (from that city): one real job picked at random, with route, cargo and badges, pick-up and delivery depots, trailer, weight, distance, estimated drive time and the DLCs it needs. Option "Career start: base game only". Each job has a code in the address (`?job=…`), so the same job opens for anyone; "Copy link" copies it, "All jobs on this route" opens the planner.
- `randomJob` in the generator, reproducible from its seed; 2 new tests (74 in all).

## 2.0.0-alpha.5 — 2026-10-22 (Freight World, stage 3: departures and route planner)

- **Job generator** (`src/engine/`), pure and deterministic, reusable by the companion app: the same city, local date and local hour give the same jobs to everyone. Every job is possible in the game by construction: the source depot offers the cargo, a depot in another city accepts it, the trailer is one the cargo list allows, the weight is inside the cargo's range, and the DLCs needed (cargo pack or a "With … DLC" listing) are named. No pay is shown (the game's pay inputs are not public).
- **Departures boards**, airport style: on every city page (12 jobs leaving in the next six hours, new jobs every hour) and on the home page (a different city every hour, the same for everyone). Columns: time, cargo with badges (DLC, hazmat class, heavy, fragile, high value), from, destination with depot, distance and drive time, trailer, weight. Cargo without a known weight stays out of the boards.
- **Route planner** at `/ats/planner`: from a city (or one depot), optionally to a city, with filters (career start: base game only; hazmat; trailer). Without a destination it lists every reachable city with distance and number of jobs; with one it lists every job between them. The choice is kept in the address, so a plan can be bookmarked. Each city page links to it.
- **Distances:** `scripts/ats/distances.mjs` (`npm run distances:ats`) asks the public OSRM server once for all 1,122 city pairs (OpenStreetMap roads, ODbL); `data/ats/distances.json` marks them as estimates. Drive time is distance at 55 mph (the California truck speed limit). Calibration against in-game distances is pending.
- **Job data for the browser:** `/data/ats-jobs.json`, built at build time, packed to 88 KB (18 KB compressed).
- Header link "Planner"; the board and planner react to the US / Metric switch.
- 9 new tests (72 in all): determinism, hourly change, validity of every board job in every city and of planner results, filters, packing, distances, formatting.

## 2.0.0-alpha.4 — 2026-10-22 (weather from MET Norway, monetisation model)

- **Weather** now comes from MET Norway Locationforecast (CC BY 4.0, commercial use allowed) instead of Open-Meteo (free for non-commercial use only), through a Netlify Function `/api/weather/<city>` ported from FOS: the city is looked up on the server, coordinates rounded to 4 decimals, User-Agent with contact, cached until MET's `Expires` and 20 minutes on the CDN, rate limited. The page shows now, wind, precipitation and today plus the next two days; "feels like" is gone (MET does not provide it). New sleet icon. Footer attribution and `/about` updated.
- **DEVELOPMENT_PLAN.md:** the hybrid monetisation model (free data and maps, paid service), its architecture consequences and the conditions before any income; Freight World replaces FOS in production at the end of stage 3.
- **FOS code removed** from this branch (`legacy/fos/`); it stays in git history.
- 5 new tests for the weather function (63 in all), with a recorded MET Norway answer.

## 2.0.0-alpha.3 — 2026-10-21 (Freight World, stage 2: city pages)

- **City pages** for all 34 cities, one static page each at `/ats/<state>/<city>` (e.g. `/ats/ca/sacramento`), built from `data/ats/`: hero with the real city photo, **live local time** (from the city's time zone) and **real weather** (Open-Meteo, requested by the browser, cached 15 minutes, refreshed while the page is open; now, feels-like, wind, precipitation and the next three days, with own weather icons); summary cards (state, map, depots, cargo offered and accepted, truck dealer); facilities and roads; neighbouring cities as links; every company and depot with what it offers and accepts (DLC cargo grouped by DLC, generic wiki names marked); landmarks; link to the wiki page.
- **City list** at `/ats/`, grouped by state, with photos and depot counts. Header link "Cities"; the ATS switch and the home page lead there.
- **Units:** US units by default (°F, mph, inches), with a US / Metric switch in the header, remembered in the browser.
- **Photos:** `scripts/photos/candidates.mjs` (`npm run photos:candidates`) finds 1–4 free photos per city on Wikimedia Commons (Wikivoyage banner, Wikidata image, Wikipedia lead image, Commons category; free licence with author, at least 1200 px, no maps or flags). Claude chose one per city by looking at each (the owner delegated the choice), with the reason in `data/photos.json`; 33 of 34 have a photo, Santa Maria keeps a placeholder (only a very thin banner exists). Author, licence and Commons link are shown under each photo.
- The number of depots shown is the one from the company pages, not the wiki infobox (decision from stage 1).
- 11 new tests (58 in all): page paths, city companies, units, weather codes, the Open-Meteo request, facility labels, photo entries, Commons rules and thumbnail links. All 34 pages were checked in Chrome at phone width (status, clock, weather, no horizontal scroll).

## 2.0.0-alpha.2 — 2026-10-21 (Freight World, stage 1: ATS data for California and Nevada)

- **Collector** `scripts/ats/collect.mjs` (`npm run collect:ats`): reads Truck Simulator Wiki through the MediaWiki API — at most one request per second per host, clear User-Agent, `maxlag`, retries with backoff, local cache in `.cache/wiki/` (not in git), `--refresh` / `--offline`. A full run needs about 30 requests. States, wiki categories and time zones are data in `data/ats/scope.json`.
- **Data** in `data/ats/` (CC BY-SA 4.0, attribution in every file's `meta`): 34 current cities (CA 24, NV 10; 4 removed and 1 future city left out), 59 companies with 244 depots, the complete cargo catalog (295 rows), 32 trailer types (27 with trailer data), and `issues.json` with 112 entries.
- **Cities:** infobox data, depots (from the company pages, with internal game IDs and, for gas stations, where the station is), facilities, roads, neighbouring cities, landmarks, game time zone → IANA, and real-world coordinates from **Wikidata** (CC0; matched through the Wikipedia article "City, State" and checked to lie in the state). All 34 cities have coordinates.
- **Companies:** one entry per depot type with its internal game ID (`gameId`), cities in scope, accepted and provided cargo, and cargo added by DLCs.
- **Cargo:** weight (lb), value per km, second values for tank/bulk trailers and value ranges as given, UN number (in-game and the one the wiki says is correct), hazmat class from the icon caption, skills, dynamic loading, trailer types, DLC (all 8 cargo DLCs, KRONE included). Cargo with the same name in two DLCs gets two ids.
- **Not guessed:** no internal IDs for cities and cargo on the wiki (`null`); unknown weights (`???`), contradictions between city and company pages, typos on the wiki, and the wiki summary counts that differ from its own table are all in `issues.json`.
- **Approved corrections** in `data/ats/aliases.json`: 8 cargo names written differently on the wiki (typos such as "Heat Exchangre", "Used Packages") and 5 generic names (Pickups, Boom Lift, Concrete Tubes, Lumber, Recreational Vehicle) mapped to every variant and marked on the depot type (`genericNames`). No cargo name is left unmatched.
- **Trailers:** types without a dealer page get the wiki page "<Type> Trailer" when it exists (Car Transporter, Lowboy 55L, Lowboy Boat, Frac Tank…; mostly not buyable). Pages with two prices keep both in `pricesUsd`.
- **Wikidata** added to the sources on `/about`.
- 39 new tests (48 in all): wikitext helpers, page parsers on wiki fragments, dataset assembly, and checks of the real files (licence metadata, unique ids, references between files, time zones, coordinates, values or recorded issues).

## 2.0.0-alpha.1 — 2026-10-21 (Freight World, stage 0: foundation)

First version of Freight World on the `v2-freight-world` branch. The FOS site on `main` is unchanged.

- **Astro 7.3.8** static site (owner's choice over plain HTML): one HTML file per URL, so every page works as a direct link. Netlify builds with `npm run build` and publishes `dist/` (Node 24, Astro telemetry off).
- **Design tokens** from DEVELOPMENT_PLAN.md section 4 in `src/styles/tokens.css`; a test checks the values and that every text colour reaches 4.5:1 on every surface.
- **Fonts:** Inter and JetBrains Mono, self-hosted (moved to `public/fonts/` with their SIL OFL 1.1 licences).
- **Header** with logo, navigation and the ATS / ETS2 switch (ETS2 marked "soon"); **footer** with the attribution required by the plan (checked by a test against DEVELOPMENT_PLAN.md), project links and version.
- **Pages:** home (hero, empty departures board, the three things Freight World will show, with their stages), `/about` (data rules, sources and licences table from `src/data/sources.json`, attribution, dataset licence, fonts and software, the games), 404.
- **English UI** with i18n: all text in `src/i18n/en.json`; a missing key fails the build.
- Phone and desktop: no horizontal page scroll at 320, 390 and 1366 px; wide tables scroll inside their frame; all links and buttons at least 44 px; skip link; visible focus.
- FOS code moved unchanged to `legacy/fos/` (reference only, not built). New `AGENTS.md`, `README.md`, `CLAUDE.md` for Freight World; the plan is now `DEVELOPMENT_PLAN.md`.
- 9 tests (`npm test`): tokens and contrast, i18n keys, attribution text, sources list.

# FOS changelog (main)

## 0.15.0 — 2026-10-21 (phase 2B: real loading places from OpenStreetMap)

- **Loading and unloading places** ("Loc de încărcare", "Loc de descărcare", Hartă și rută): a real place in the city from OpenStreetMap — industrial zone, port, rail terminal, logistics park or silo — chosen by the cargo (`src/data/places/site-kinds.mjs`; grain prefers a silo or port, fuel a port or industrial zone, machinery an industrial zone…). The route runs between the places and the A/B pins sit on them. Without a suitable place the route runs between the cities as before (row shows "Indisponibil" with the reason).
- **No company names.** A name is shown only when it is a public place term (`src/data/places/public-name-terms.json`: "Zonă industrială", "Parc industrial", "Port", "Ipari park", "Индустриална зона"…) plus words that cannot name a company — city names, compass words, numerals, short connecting words. Legal forms, `operator`/`brand` matches and any other word make the place generic ("Zonă industrială, Arad"). The original name is not stored.
- **Data prepared offline** by `scripts/build-locations.mjs` (Overpass, retries, optional `FOS_OVERPASS_CACHE`): `src/data/places/locations-RO/HU/BG.json` — 696 / 722 / 321 places (industrial zones, ports, silos; OSM has few tagged rail terminals and logistics parks, so those kinds are rare), at most 6 per city and kind, within 15 km of a catalog city; 111 of 112 RO, all 88 HU and 54 BG cities have at least one. Named places: 24 / 14 / 46; the rest are shown generically. ODbL 1.0, © OpenStreetMap contributors.
- Load: optional facts `originSite` / `destinationSite` (sourced with OSM link and licence, or unavailable with reason `noSite`); loads saved before this release render without them. Schema version unchanged.
- 15 new tests (`tests/sites.test.mjs`): name filter in three languages, classification, city assignment and limits, choice by cargo, routing between places, view rows, and a check of the data files for company-like names.

## 0.14.0 — 2026-10-20 (phase 2A: distance by country, border crossings, UN/LOCODE)

- **Distance by country** ("Distanță pe țări", Hartă și rută and Prezentare): the route geometry is split by country with Natural Earth 1:10m borders (public domain, simplified; point-in-polygon, border found by bisection, segments densified to ≤ 2 km). The provider's distance is shared in proportion to the geometry; kilometres add up exactly. Computed fact with formula, inputs and data sets.
- **Border crossings** ("Punct de frontieră"): where the route leaves one country and enters another, matched to the nearest OpenStreetMap border control/customs point within 5 km (name shown as mapped, never an operator); otherwise "Punct de frontieră X–Y". Each crossing shows its regime — internal Schengen or external (control) — from a list of 29 Schengen states (Romania and Bulgaria included since 1 January 2025). No waiting-time estimates. Crossings are drawn on the map and in the print snapshot.
- **UN/LOCODE** for the header codes (ARW → SOF): 241 of the 254 cities matched to GeoNames by country, name and distance; the rest keep the provisional code. Only codes are kept. The reuse terms of UN/LOCODE are not clearly stated by UNECE (see `src/DATA-LICENSES.md`); the build script uses the `datasets/un-locode` mirror or a file downloaded by hand.
- New offline scripts: `build-borders.mjs`, `build-border-crossings.mjs` (Overpass, retries), `build-locodes.mjs`; data in `src/data/geo/` and `src/data/places/locodes.json`.
- Without the geo data (file missing) both facts show "Indisponibil încă — Etapa 2" with the reason. Load schema version 3 (two new required route facts: `countryDistances`; `borderCrossings` now computed); older saved loads need regenerating.
- 12 new tests (`tests/borders.test.mjs`).

## 0.13.0 — 2026-10-20 (phase 1D: city photos and weather)

- **City cards** for the origin and the destination (Prezentare, Hartă și rută): photo, name, country, population, and the photo credit (author · licence · Wikimedia Commons, linked). A styled fallback (gradient + city code) when there is no free photo or it does not load.
- **Photos prepared offline** by `scripts/build-city-photos.mjs` (country codes as arguments): GeoNames ID → Wikidata (P1566) → P18 (preferred first) or the Wikivoyage banner (P948) → Commons information; the lead image of the city's Wikipedia article when Wikidata has none; free licences only (PD, CC0, CC BY, CC BY-SA, Attribution, FAL), ≥ 500 px, maps/flags/coats of arms/collages excluded, thumbnail link checked; several Wikidata items → only a clearly dominant one (≥ 3× sitelinks). For the 15 largest cities still without a photo (Craiova, Oradea, Suceava, Botoșani, Reșița, Bistrița, Hunedoara, Giurgiu, Hódmezővásárhely, Câmpina, Mangalia, Odorheiu Secuiesc, Sighișoara, Huși, Petrila) a file was hand-picked from Commons (`src/data/photos/curated.json`) and checked by the same rules. Files: `src/data/photos/cities-<CC>.json`.
- **Every city in the catalog now has a photo.** The 16 small or ambiguous towns left without a usable free photo were removed (owner's decision) and recorded with the reason in `src/data/places/exclusions.json`; the GeoNames importer keeps them out (`scripts/prune-cities-without-photo.mjs`). The catalog has 254 cities (RO 112, HU 88, BG 54).
- **Live weather** for both cities from MET Norway Locationforecast (CC BY 4.0, no key): now (temperature, sky, wind, precipitation), the next three local days (min/max, sky) and the forecast at the loading and unloading windows. New function `/api/weather/:id` (GeoNames ID; the city is looked up on the server in `src/data/places/lookup.json`), CDN cache 20 min, rate limit, User-Agent per MET terms; loading / error (with retry) / "actualizat HH:MM" states; refreshed every 20 minutes while the page is visible; never stored in the load. The weather drawer shows the source, licence and times.
- Own weather icons (8 sky states, day/night), °C, km/h, mm.
- `scripts/build-places-lookup.mjs` (also run by the GeoNames importer) builds the city index used by server functions.
- About the data and the footer list Wikimedia Commons and MET Norway.

## 0.12.0 — 2026-10-20 (phase 1C: tabs + countries as data)

- **Tabs:** the load page has eight tabs under the route header — Prezentare, Hartă și rută, Marfă, Camion și trailer, Program și pauze, Costuri, Documente, Surse și calcule (tablist keyboard support, active tab in the address as `#cargo`, scrollable on phones). Every fact of the Load sits in exactly one tab; "Surse și calcule" lists them all with the legend and "De verificat". Prezentare shows cards that link to the other tabs.
- **Rows for later stages** (cod CN, distanță pe țări, relief, volum, camion, taxe, motorină, cost total, CMR, document ADR…) appear as "Indisponibil încă — Etapa N" with their reason; they are listed separately from the Load's facts and are not printed.
- **Schedule:** new engine module `src/engine/schedule.mjs` builds the day-by-day timeline (loading, departure at the end of loading, drives, breaks, daily rest, arrival, wait, unloading) from the existing loading window and transit segments; shown in "Program și pauze" and as a computed row with its formula. Intermediate times are in the origin's local time, arrival and unloading in the destination's.
- One MapLibre map moves between Prezentare and Hartă și rută (resize and refit); the print snapshot stays valid from any tab. Print lists only real facts and stays on one page.
- **Countries as data:** `src/data/countries.mjs` lists the active countries; one city file per country (`cities-RO/HU/BG.json`, same 270 places); the importer takes country codes and validates per country; engine, UI, dev server and tests read the list from data; country phrases come from `{countries}`; the route language follows the interface. A test shows a new country works with data only.
- Load schema unchanged (version 3): saved loads stay valid.

## 0.11.0 — 2026-10-20 (phase 1B: foundation)

- New Load model (schema 3) where every value is a fact with provenance; `validateLoad()` rejects incomplete facts, out-of-scope places and impossible windows. Documented in `docs/LOAD-MODEL.md`.
- Engine restructured into pure, tested modules in `src/engine/` (places, cargo, equipment, load planning, transit time, time windows, parties, route, generator) with stubs for phases 4, 6 and 7. Geoapify sits behind a routing adapter (`src/adapters/routing-geoapify.mjs`); the map moved to `src/adapters/map-maplibre.mjs`.
- First load calculations: EUR pallets on the trailer floor (EPAL dimensions; typical DSV floors for curtainsider, reefer and box), limited by payload; estimated mass per pallet with its basis; total mass; loading metres. Cargo that is not palletised, or trailers without a sourced floor, show "Indisponibil încă" with the reason.
- Minimum transit time under Reg. (EC) 561/2006, simplified (45 min break after 4 h 30 min, 11 h rest after 9 h of driving), with the day-by-day sequence in the drawer.
- Simulated loading and unloading windows placed after the minimum transit time, on working days, in each city's local time (UTC offset shown); simulated shipper and consignee roles.
- City catalog rebuilt with a Node importer: 270 places of at least 15,000 inhabitants in RO/HU/BG, city sections (PPLX) excluded by feature code.
- Removed the ATS/ETS2 modes and `mission-engine.mjs`, the corridor and company data, the PowerShell importer; the game reference catalog moved to `archive/`.
- UI: 20-row load sheet, loading window in the hero, transit and stop KPIs, "De verificat" warnings (also in print), new sources in "Despre date". History uses a new key; phase 1A loads are not shown.

## 0.10.0 — 2026-10-20 (phase 1A: redesign)

- Rebuilt the interface in the Airport Live visual system (self-hosted Inter and JetBrains Mono): top bar with recent loads and city palette (Ctrl/⌘+K, `/`), hero with route code, map and cargo cards, KPI cards, and a load sheet with a provenance stripe and badge on every row.
- Added provenance levels (sourced, computed, estimated, simulated) with validation, and a single mission-to-UI conversion, `buildLoadSheet(mission)`. Rows without a value say "Indisponibil încă — Etapa N".
- Added right-side drawers (row details, new load, about the data) with focus handling, Escape and backdrop close.
- Replaced the Geoapify static map with MapLibre GL JS 4.7.1 (pinned, with integrity hash) and OpenFreeMap tiles; removed the Static Maps call from `truck-route`.
- Romanian interface from `src/i18n/ro.json` with `ro-RO` number and date formatting; cargo, trailer and family names translated.
- Search scope narrowed in the UI to Romania, Hungary and Bulgaria (city districts excluded); ATS/ETS2 modes, curated corridors and the company directory are hidden (the engine is unchanged until phase 1B).
- One-page print (`window.print()`, light theme, map snapshot with A/B pins) replaces the pop-up report.
- Added estimated NST 2007 chapters per cargo family, clearly marked as an estimate until phase 3.
- Added AGENTS.md / CLAUDE.md, a local fixture dev server, and tests (translation keys, provenance, formats, scope, selection).

## 0.9.0 — 2026-10-19

- Expanded produce and food cargo profiles with named fruit, vegetable, meat, and seafood examples plus variety examples, load forms, and product-specific handling caveats.
- Expanded trailer suggestions into detailed equipment profiles with common configurations, intended uses, and checks to confirm before dispatch; the UI filters equipment by selected cargo.
- Added nine illustrative ATS/ETS2 freight corridors with cargo-specific profiles, relevant real-brand research suggestions, and source-linked context for selected US agriculture and European port/intermodal regions.
- Added a directory of more than 20 real company brands that supplies search hints for Geoapify place search; exact addresses still require provider selection, and company ownership or a real shipment is not asserted.
- Added corridor, cargo variety, company search-suggestion, and trailer configuration details to generated and printed reports.
- Added consistency tests for cargo/trailer links, corridor locations, and official company URL records.

## 0.8.0 — 2026-10-19

- Replaced seven broad freight categories with a curated catalog of 51 real-world commodity examples across agriculture and food, building materials, industrial goods, regulated goods, retail freight, vehicles, and livestock.
- Added load forms, practical handling prompts, product-specific caution notes, and suggested trailer families to each cargo profile.
- Added random selection across the full cargo catalog and family-grouped manual selection.
- Added an expanded cargo profile to generated scenarios, including source frameworks and explicit confidence limits for trailer matches and regulated-goods classification.
- Added official UNECE references for transport-goods classification, perishable-food transport, and ADR dangerous-goods context.

## 0.7.0 — 2026-10-19

- Replaced the route-line schematic with a Geoapify/OpenStreetMap road map with fitted route geometry and A/B markers.
- Reduced the default route panel to the map, countries, toll status, traffic model, and three main roads; road classes, surfaces, and key turns are now collapsed under “More route details.”
- Simplified the printed report to include the road map and a short route summary instead of listing every route segment.
- Reduced route instructions to key maneuver entries and retained map images only for the five latest saved scenarios.
- Added disclosure that Geoapify Static Maps requests consume additional API credits.

## 0.6.0 — 2026-10-19

- Narrowed random city draws to the 40 most-populated GeoNames places per supported country; the catalog now contains 1,150 records across the current ATS/ETS2 region set.
- Added a route geometry schematic, country coverage, road-class and road-name summaries, surface data, and turn-by-turn segments to generated reports.
- Grouped consecutive Geoapify road fragments into readable stretches so long routes are not truncated near the origin; reports retain up to 300 grouped stretches and disclose the source fragment count.
- Requested Geoapify's heavy-truck route profile and approximated traffic; reports disclose the modeled 40 t / 4.1 m profile limits and that traffic is not live.
- Added route detail data to print reports and retained provider source/timestamp attribution.
- Note: Geoapify documents that `route_details` increases API credit consumption.

## 0.5.0 — 2026-10-19

- Restored random route generation using 10,264 real GeoNames city records across the ATS and ETS2 regions.
- Made manual Geoapify place selection optional and collapsed it behind a secondary control.
- Added GeoNames CC BY 4.0 attribution and a repeatable city-catalog importer.

## 0.4.0 — 2026-10-19

- Reframed ATS/ETS2 as the initial world modes for real-data freight scenarios.
- Added server-side Geoapify place search and truck-route functions; API keys stay in Netlify environment variables.
- Replaced in-game companies and static route corridors in the generator with selected provider locations and a provider-returned truck route.
- Replaced game cargo references in the live generator with generic freight categories and advisory trailer matches.
- Removed sample load weights, fuel, and deadlines from generated scenarios; shipment assignment remains clearly simulated.
- Retained the CC BY-SA 4.0 game catalog separately as an unused reference archive.

## 0.3.0 — 2026-10-19

- Limited the initial milestone to ATS and ETS2.
- Added a coherent sample mission engine and a separately attributed game reference catalog.

## 0.2.0 — 2026-10-19

- Persisted up to 30 generated missions in browser local storage.
- Improved text escaping, focus styles, and status announcements.

## 0.1.0 — Initial prototype

- Static responsive dashboard, simulated mission generation, starter sample data, and printable report.
