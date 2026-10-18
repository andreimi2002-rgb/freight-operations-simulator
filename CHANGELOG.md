# Changelog

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
