# AGENTS.md — permanent project rules (Freight World, branch v2-freight-world)

## Product
Freight World is an **ATS / ETS2 style job generator** on the real game map (cities, companies, depots, cargo, trailers that exist in the game), plus **live city pages** (real local time, real weather, a real city photo). It is not a game and not a real freight exchange. The full plan, stages and decision log are in `DEVELOPMENT_PLAN.md` (Romanian); read it at the start of every stage.

First scope: American Truck Simulator, California and Nevada; full ATS cargo catalog. ETS2 comes later (shown as "soon").

The previous product (FOS, real-world RO/HU/BG loads) is still published from `main` until the launch at the end of stage 3; its code is no longer in this branch (recover it from git history, tag `fos-final` at launch).

## Stack
- Astro (static output), Node 22.12+. `npm run build` writes `dist/`, which Netlify publishes. One HTML file per URL: every URL must work as a direct link.
- Small Netlify Functions only where an external service requires it (`netlify/functions/`, e.g. `/api/weather/<city>`), with CDN caching and a rate limit.
- Tests: `npm test` (`node --test`). Engine and data code are plain ES modules testable without Astro; the job generator stays a separate module, reusable later in the companion app.
- No paid APIs, no paid services, no new dependency without the owner's approval. No API keys in client code or git.

## Data rules
- Game data only from Truck Simulator Wiki (CC BY-SA 4.0) via the MediaWiki API: at most 1 request per second, a clear User-Agent, local cache. Published game data files carry the same licence.
- Nothing invented: no cities, companies, cargo or numbers that are not in the game. Unknown = `null`; contradictions go to `data/ats/issues.json`; approximations are labelled as estimates with their basis.
- Keep internal game IDs (company files such as `oak_port`, internal cargo and city names) wherever the wiki gives them; they link pages to live telemetry later.
- Every data file has a `meta` field: source, licence, retrieval date, attribution.
- Every source and licence is listed in `src/data/sources.json` and shown on `/about`. The attribution from `DEVELOPMENT_PLAN.md` section 2 appears in the footer of every page (checked by a test).
- No logos, screenshots or other images from the games (they belong to SCS Software). No AI-generated images. City photos only from Wikimedia Commons, chosen by hand (`data/photos.json`, with the reason), with author, licence and link shown; otherwise an elegant placeholder, never a wrong photo.
- Weather from MET Norway Locationforecast (CC BY 4.0, commercial use allowed) through `/api/weather/<city>`: User-Agent with contact, coordinates rounded to 4 decimals, cache honouring `Expires`. Every external service must allow commercial use (monetisation model in `DEVELOPMENT_PLAN.md`, section 1).
- Countries, states and games are data, not code: no hard-coded lists in components or scripts.

## Interface
- UI text lives in `src/i18n/<lang>.json` (English by default); components contain no literal text and a missing key fails the build. Numbers and dates use `Intl` with the locale from the dictionary. Adding a language means adding a JSON file.
- Design tokens in `src/styles/tokens.css` are the ones in `DEVELOPMENT_PLAN.md` section 4 (checked by a test). Dark, fine borders, 10–16 px radii, amber accent, blue for cold/reefer, monospace board. No gradients, no emoji, no needless effects.
- Fonts are self-hosted in `public/fonts/` with their licences (Inter, JetBrains Mono, SIL OFL 1.1).
- Desktop and phone: no horizontal page scroll down to 320 px (wide tables scroll inside their wrapper), real `<a>`/`<button>`, targets at least 44 px, body text contrast at least 4.5:1, keyboard and touch.

## Working mode
- One branch per stage, PR into `v2-freight-world`, reviewed on a Netlify Deploy Preview. `main` (the FOS site) stays unchanged until the launch at the end of stage 3; after that, PRs go to `main`.
- Nothing is merged without the owner's explicit approval.
- Ask before important decisions (framework, data structure, deleting anything existing).
- Update `CHANGELOG.md` and the version in `package.json` with every change; record plan-changing decisions in the decision log of `DEVELOPMENT_PLAN.md`.
- Say what was tested and what could not be tested. Never claim something works without running it.
- Plans and reports for the owner are in Romanian; this file, code and comments are in English.
