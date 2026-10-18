# Freight Operations Simulator (FOS)

FOS is an early browser-based freight mission generator. ATS and ETS2 are the initial geographic and gameplay frame; the product direction is to replace fictional game details with real-world places, freight, carriers, and equipment as source-backed datasets become available.

## Current prototype

Version 0.3.0 is a static HTML, CSS, and JavaScript app with no build step or backend. It generates simulated ATS/ETS2-style missions, checks sample cargo/equipment compatibility, estimates fuel and driving time, stores recent missions in browser storage, and prints a mission brief.

The current generator is still a prototype: its cities, weights, route distances, timing, fuel use, and shipment assignments are simulated. The small, separately attributed Truck Simulator Wiki catalog is reference material only. No generated mission is an actual load, booking, route, or dispatch instruction.

## Product direction

- Keep ATS and ETS2 as the initial modes; other simulator modes are out of scope for now.
- Use real-world records for cities, facilities, companies, freight categories, and trailer/equipment types as they are added.
- Store provenance, source URL, license, retrieval date, and verification status with each imported record.
- Clearly distinguish sourced facts from generated scenario details and estimates.
- Keep imported game reference material separate from real-world datasets and remove it from the generator as the real-data replacement is implemented.

## Run locally

Serve the project root with VS Code Live Server or another static server. Root-relative asset paths require a server; opening `index.html` directly with `file://` will not load app assets reliably. Netlify is configured to publish the repository root without a build command.

## Checks

Run the current mission consistency checks with:

```sh
node --test tests/mission-engine.test.mjs
```

## Data and attribution

The selected game cargo/company references are in `src/data/game-reference-catalog.mjs`, separate from the simulator engine, with CC BY-SA 4.0 attribution in `src/DATA-LICENSES.md`. Game content, names, and trademarks may have separate rights; FOS is an unofficial project and is not affiliated with SCS Software or Truck Simulator Wiki.

## Project layout

- `index.html` — page structure and form controls.
- `src/styles.css` — responsive dashboard styling.
- `src/main.js` — interface, local history, and print rendering.
- `src/mission-engine.mjs` — ATS/ETS2 sample catalog and mission rules/validation.
- `src/data/game-reference-catalog.mjs` — separate game reference dataset.
- `src/DATA-LICENSES.md` — attribution and reuse details.
- `tests/mission-engine.test.mjs` — mission consistency checks.
- `netlify.toml` — static publish configuration.
- `CHANGELOG.md` — release notes.
