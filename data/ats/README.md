# data/ats — American Truck Simulator game data

Game data for the states listed in [`scope.json`](scope.json) (now California and Nevada), collected from **Truck Simulator Wiki** by [`scripts/ats/collect.mjs`](../../scripts/ats/collect.mjs).

## Licence and attribution

The data comes from Truck Simulator Wiki contributors (https://trucksimulator.wiki.gg) under **CC BY-SA 4.0** (https://creativecommons.org/licenses/by-sa/4.0/). These files are derived from it and are shared under the same licence. Attribution:

> Game data from Truck Simulator Wiki contributors (trucksimulator.wiki.gg), CC BY-SA 4.0.

City coordinates come from **Wikidata** (CC0 1.0). They are the coordinates of the real-world city, used for the real weather; they are not positions on the game map.

Not affiliated with SCS Software. No images from the games are stored.

## Files

| File | Content |
|---|---|
| `scope.json` | What is collected: game, states (with their wiki category and Wikidata item), wiki pages and categories, time zone abbreviations → IANA. Edited by hand. |
| `cities.json` | Current cities in scope (cities marked removed or future on the wiki are left out). Infobox data, depots, facilities, roads, neighbouring cities, landmarks, time zone, coordinates. |
| `companies.json` | Companies with at least one depot in scope. One entry per depot type, with its internal game ID (`gameId`), cities, accepted and provided cargo, and cargo added by DLCs. |
| `cargo.json` | The complete ATS cargo catalog from the wiki cargo list: weight (lb), value per km (`unit_reward_per_km`), UN number, hazmat class, skills, trailer types, DLC. |
| `trailers.json` | Trailer types named on the cargo list, each with the cargo it carries and the dealer trailer models (wiki trailer pages) that belong to it. |
| `aliases.json` | Owner-approved corrections for cargo names that do not match the cargo list (typos, a different wording, generic names mapped to every variant). Edited by hand. |
| `distances.json` | Estimated road distances (km) between every ordered pair of cities, from OSRM on OpenStreetMap roads (ODbL, © OpenStreetMap contributors). Marked as estimates; `calibrationFactor` will hold a correction once checked against in-game distances. Written by `scripts/ats/distances.mjs`. |
| `issues.json` | Everything to check by hand: empty values, contradictions between pages, names that do not match, counts that differ. |

Every file has a `meta` block with the source, licence, retrieval date, attribution and generator.

## Rules the script follows

- **Nothing is guessed.** A value the wiki does not give is `null`, with an entry in `issues.json`. Contradictions are not resolved silently.
- **Current version only.** On city pages, only the first tab of a tabbed section ("After 1.xx") is read; "Before 1.xx" tabs are ignored.
- **Depots come from the company pages** (they carry the internal game IDs and the cargo per depot type). The city page is used to cross-check; every difference is an issue.
- **Internal game IDs** are kept where the wiki gives them: company depot types (`gameId`, from the hidden comment in the Locations table or the infobox `def`). The wiki gives none for cities and cargo, so `gameId` is `null` there (listed in `issues.json`).
- **Names are matched exactly**, ignoring case and spaces. Exceptions, each recorded in `issues.json`: singular/plural spellings (`nameVariant`); a link to a disambiguation page inside a state row, matched by city name and state (`linkResolvedByName`); and the owner-approved corrections in `aliases.json` (`aliasApplied`). A generic name (e.g. "Lumber") is mapped to every variant on the cargo list and marked on the depot type in `genericNames`.
- **Trailer models** are joined to a cargo-list trailer type by the same name, or by the cargo they carry (Jaccard overlap ≥ 0.5, best unique match, recorded as `trailerModelMatch`). A type with no dealer page gets the wiki page "<Type> Trailer" when it exists (`match.by: "page title"`); these are mostly trailers the player cannot buy. When a page gives several prices, `priceUsd` is empty and `pricesUsd` lists them.
- **Coordinates:** English Wikipedia article "City, State" → its Wikidata item → P625, accepted only if Wikidata places the item in that state.

## Running it

```sh
npm run collect:ats                         # uses the local cache, fetches what is missing
node scripts/ats/collect.mjs --refresh      # fetch everything again (after a game update)
node scripts/ats/collect.mjs --offline      # cache only
```

The script makes at most one request per second per host, sends a clear User-Agent, honours `maxlag` and retries with backoff. Responses are cached in `.cache/wiki/` (not in git). A full run from an empty cache needs about 30 requests.

To add a state: add it to `scope.json` (`code`, `name`, wiki `category`, `wikidata` item) and run the script again.

## Last run (2026-10-21)

34 cities (CA 24, NV 10), 59 companies, 244 depots, 295 cargo, 32 trailer types (27 with trailer data), 112 entries in issues.json (13 of them are the approved corrections, listed for transparency).
