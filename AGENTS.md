# AGENTS.md: rules for anyone (human or AI) working on TruckSim Command Center

## Product
Personal companion for Euro Truck Simulator 2 and American Truck Simulator: live telemetry, Apple Maps-style map, Romanian copilot (text + voice), encyclopedia, career log. Private use, no monetisation. Plan: `docs/PLAN.md` (Romanian). Owner reads Romanian; code, comments and this file are English.

## Integrity rules (non-negotiable)
- Unknown is `null`, never 0. Stale data is never shown as live; every screen shows the data source (LIVE / DEMO / REPLAY / stale / offline).
- No invented navigation: exits, lanes and road names only from game map data, never guessed.
- The copilot only reads data through tools; it cannot drive or change the game; without live data it says so.
- Demo values are invented and always labelled DEMO.
- Game data from Truck Simulator Wiki is CC BY-SA 4.0 and keeps its attribution. No SCS logos or game images.

## Stack
- npm workspaces, Node 24+. TypeScript runs directly in Node (type stripping): no enums, no parameter properties (`erasableSyntaxOnly`), explicit `.ts` import extensions.
- `packages/core`: shared, runs in Node and the browser. No Node-only APIs there.
- `apps/bridge`: Windows bridge. Shared memory layout in `scs-layout.ts` follows RenCloud scs-sdk-plugin rev 12.
- `apps/web`: React 19 + Vite PWA. Design tokens in `src/styles.css` (Apple system colours, light/dark/Night Drive).
- Tests: `npm run check` (typecheck + `node --test`). Add a test for every bug found on a live recording.

## Working mode
- One branch per phase/task, PR into `main` (production, deployed by Netlify). Nothing is merged without the owner's approval.
- Say what was tested and what was not; live-game behaviour is confirmed only with `docs/VALIDATION.md`.
- Secrets (API keys, bridge token) stay on the PC: `var/` and env vars, never in git or the browser bundle.
