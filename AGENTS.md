# AGENTS.md — permanent project rules

## Product
Freight Operations Simulator (FOS) is a **real-world road freight load generator**, not a game: one generated truck load, as close to reality as possible and extremely detailed. First scope: Romania, Hungary, Bulgaria. Plain HTML/CSS/ES modules, no build step, Netlify publishes the repository root, tests run with `node --test`.

## Provenance (every displayed fact has exactly one level)
- **sourced**: from a named public dataset or regulation (name, URL, retrieval date).
- **computed**: derived by the engine from other values (formula and inputs viewable).
- **estimated**: a reasoned approximation; it must state its basis.
- **simulated**: the generated shipment itself (consignment, shipper role, time windows).

Never present a simulated or estimated value as sourced. Never invent regulation numbers, tariffs, specifications or codes: if a value has no source yet, store `null` and a TODO naming the needed source. A row without a value is shown as "Indisponibil încă — Etapa N" (not a provenance level).

## Data and services
- No paid APIs in core features. Allowed: OpenStreetMap (ODbL), GeoNames (CC BY 4.0), Eurostat, UNECE (UN/LOCODE, ADR, NST, ATP), EU official texts, Wikidata (CC0), OpenFreeMap tiles.
- Geoapify is temporary and must stay behind an adapter; it leaves in phase 5.
- No API keys in client code or git (Netlify environment variables only).
- Every dataset is documented in `src/DATA-LICENSES.md`. Fonts are self-hosted (licences in `fonts/`).

## Interface
- All UI text lives in `src/i18n/ro.json` (Romanian by default); components contain no literal text. Numbers and dates use `Intl` with `ro-RO`. Adding a language means adding a JSON file, not editing components.
- Keep the Airport Live visual system (tokens in `src/styles.css`). Must work on desktop and phone: no horizontal scroll at phone width, keyboard and touch input, contrast at least 4.5:1 for body text.

## Working mode
- Engine code has `node --test` tests. Update `CHANGELOG.md` and the version with every change.
- One branch and one PR per logical task; never work on `main`. Small commits with clear messages.
- Nothing is merged or reaches production without the owner's explicit approval and a reviewed Deploy Preview.
- Say what was tested and what could not be tested. Never claim something works without running it.
- Plans and reports for the owner are written in Romanian; this file and code comments are in English.
