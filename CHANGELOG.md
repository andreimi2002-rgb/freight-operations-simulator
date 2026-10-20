# Changelog

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
