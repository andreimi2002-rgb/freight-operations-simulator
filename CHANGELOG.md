# Changelog

## 0.6.0 — 2026-10-19

- Narrowed random city draws to the 40 most-populated GeoNames places per supported country; the catalog now contains 1,150 records across the current ATS/ETS2 region set.
- Added a route geometry schematic, country coverage, road-class and road-name summaries, surface data, and turn-by-turn segments to generated reports.
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
