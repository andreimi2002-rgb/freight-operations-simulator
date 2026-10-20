# Data attribution and licenses

Every value FOS displays carries its provenance (sourced, computed, estimated, simulated). This file lists the sources behind the sourced values and the FOS-made estimates, with their licences.

## GeoNames city catalog

`src/data/places/cities-<CC>.json` (one file per country listed in `src/data/countries.mjs`: today RO 126, HU 89, BG 55 places) is built by `scripts/import-geonames.mjs` from the official GeoNames `cities15000.zip` dump. It keeps every populated place of the country with at least 15,000 inhabitants (except the towns listed in `src/data/places/exclusions.json`: no usable free photo), excluding feature code `PPLX` (sections of populated places, e.g. Bucharest sectors and Budapest districts) and historical, abandoned or destroyed places. Each record keeps its GeoNames ID, coordinates, population, time zone and feature code.

- Attribution: GeoNames geographical database
- License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
- Source dump: [GeoNames cities15000.zip](https://download.geonames.org/export/dump/cities15000.zip)
- Format: [GeoNames dump readme](https://download.geonames.org/export/dump/readme.txt)

GeoNames provides the data as-is without warranty. Coordinates are city centroids, not loading points (real loading points come in phase 2).

## Borders, crossings and UN/LOCODE (phase 2A)
- **Natural Earth** 1:10m admin-0 countries: public domain (https://www.naturalearthdata.com/about/terms-of-use/). Simplified by `scripts/build-borders.mjs`.
- **OpenStreetMap** border control / customs points via the Overpass API: © OpenStreetMap contributors, ODbL 1.0. Only names and positions are kept (`src/data/geo/border-crossings.json`); the facts that use them link the OSM objects and the data sets are listed in the detail drawer. The ODbL share-alike and attribution terms apply to this derived database.
- **Schengen area** member list (29 states): official information of the European Commission (`src/data/geo/schengen.json`, with check date).
- **UN/LOCODE** (UNECE): the reuse terms are **not clearly stated**; UNECE blocks automated downloads and the `datasets/un-locode` mirror declares no clear licence. Only the identifier codes of our own cities are stored (`src/data/places/locodes.json`). To be confirmed with UNECE before any broader use.

## City photos (phase 1D)

`src/data/photos/cities-<CC>.json` is built by `scripts/build-city-photos.mjs` from **Wikidata** (CC0: GeoNames ID P1566 → image P18 / Wikivoyage banner P948), the lead image of the city's **Wikipedia** article when Wikidata has none, a short hand-picked list (`src/data/photos/curated.json`, 15 large cities), and **Wikimedia Commons** (author, licence, size, page of each file). Only free licences that allow display with credit are used: public domain, CC0, CC BY, CC BY-SA, Commons {{Attribution}}, Free Art License. Every photo is shown with its author, licence and a link to its Commons page; the images are loaded from Wikimedia's servers (no referrer). Every city in the catalog has a photo; towns without a usable free photo are left out of the catalog (`src/data/places/exclusions.json`). A styled panel still appears if a photo fails to load.

## Weather (phase 1D)

City weather comes live from **MET Norway — Locationforecast 2.0** (https://api.met.no/), licensed **CC BY 4.0** (credited on each card and in the weather drawer), through the Netlify function `/api/weather/:id`, which identifies itself with a User-Agent and caches answers as MET Norway's terms ask. The weather is not stored in saved loads. `tests/fixtures/met-locationforecast-bucharest.json` is a trimmed recorded MET answer used only by the tests.

## Load planning sources (phase 1B)

- **EUR pallet:** 1200 × 800 × 144 mm, safe working load 1,500 kg — [EPAL, EPAL Euro pallet (EPAL 1)](https://www.epal-pallets.org/eu-en/load-carriers/epal-euro-pallet), retrieved 2026-10-20. Stored in `src/data/regulations/packaging.mjs`.
- **Trailer floors** (`src/data/equipment/floors.mjs`), typical internal dimensions and payload from the operator DSV's public equipment pages, retrieved 2026-10-20. DSV states that dimensions vary by manufacturer and production year; FOS shows them as typical values:
  - curtainsider 13.62 × 2.48 × 2.70 m, payload 32,800 kg — [DSV curtain trailer](https://www.dsv.com/en/our-solutions/modes-of-transport/road-transport/trailer-sizes/curtain-trailer) (same floor and "33 Euro pallets" also stated by [DP World Euroliners](https://www.dpworld.com/en/supply-chain-solutions/freight-forwarding/multimodal-solutions/europe/equipment/euroliners));
  - reefer 13.31 × 2.48 × 2.60 m, payload 31,000 kg — [DSV reefer trailer](https://www.dsv.com/en/our-solutions/modes-of-transport/road-transport/trailer-sizes/reefer-trailer);
  - box 13.62 × 2.46 × 2.70 m, payload 31,400 kg — [DSV box trailer](https://www.dsv.com/en/our-solutions/modes-of-transport/road-transport/trailer-sizes/box-trailer).
  
  Directive 96/53/EC sets external limits only (16.50 m articulated length, 2.55/2.60 m width, 4.00 m height, 40 t); it does not define a "13.6 m loading length". The legal limits are not used yet (phase 4).
- **Driving time:** Regulation (EC) No 561/2006, Art. 4(g), 6, 7 and 8 — [EUR-Lex](https://eur-lex.europa.eu/eli/reg/2006/561/oj). EUR-Lex could not be fetched automatically on 2026-10-20; the values (9 h daily driving, 45 min break after 4 h 30 min, 11 h regular daily rest, 56 h weekly, 90 h fortnightly) were checked against the copy at [legislation.gov.uk](https://www.legislation.gov.uk/eur/2006/561/data.htm). Used in a simplified, conservative form (no 10 h extension, no reduced rest, no split break).

## FOS estimates (shown as "Estimat")

- **Mass per pallet** (`src/data/cargo/packaging-profiles.mjs`): a range per cargo group, reasoned from typical carton or sack weights and stack heights. The engine uses the midpoint. Not shipment data; replaced by sourced packaging in phase 3.
- **NST 2007 chapters per cargo family** (`src/data/cargo/nst-estimates.mjs`): a FOS-proposed correspondence, not a classification. The 20 chapters follow Commission Regulation (EC) No 1304/2007 (as reproduced by [CBS](https://www.cbs.nl/en-gb/our-services/methods/definitions/commodity-nomenclature-nst-2007)). Replaced in phase 3 by the Eurostat CN→NST correspondence.

## Simulated parts of a load

The cargo choice, the trailer choice, the time windows and the shipper/consignee roles (`src/data/cargo/roles.mjs`) are generated for the scenario. No real company, contract, booking or shipment is represented.

## Curated cargo and trailer catalogs

`src/data/cargo/catalog.mjs` and `src/data/equipment/catalog.mjs` are original FOS curations of real-world commodity examples and trailer types. The broad classification reference is [UNECE NST 2007](https://unece.org/transport/statistics-transport/classification-nst-2007); perishable food links to the [UNECE ATP Handbook](https://unece.org/atp-handbook), dangerous goods to [UNECE ADR](https://unece.org/transport/dangerous-goods), live animals to [EU Regulation (EC) 1/2005](https://eur-lex.europa.eu/eli/reg/2005/1/oj/eng). Cargo-to-trailer pairings and handling prompts are planning heuristics, not verified compatibility, safety instructions or dispatch advice. Hazardous-goods status is never inferred.

## Routing and map

- **Geoapify Routing API** (temporary, behind `src/adapters/routing-geoapify.mjs`): route distance, duration, countries, main roads and geometry; route data © OpenStreetMap contributors. Replaced by an own OSM router in phase 5.
- **OpenFreeMap** vector tiles (no key): map data © OpenStreetMap contributors (ODbL), tile schema © OpenMapTiles. Attribution is shown on the map and in print.
- **MapLibre GL JS** 4.7.1: BSD 3-Clause, loaded from jsDelivr with a Subresource Integrity hash.

## Fonts

**Inter** (© The Inter Project Authors) and **JetBrains Mono** (© The JetBrains Mono Project Authors): SIL Open Font License 1.1, served from `fonts/` with their licence files.

## Truck Simulator Wiki reference catalog (archived)

`archive/game-reference-catalog.mjs` is a small selection of cargo names, trailer associations, company names and industry labels derived from Truck Simulator Wiki pages. It is not used by the app; it is kept for the planned ETS2/ATS adapter (phase 8).

- Attribution: Truck Simulator Wiki contributors
- License: [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/); see [Truck Simulator Wiki:Copyrights](https://trucksimulator.wiki.gg/wiki/Truck_Simulator_Wiki:Copyrights)
- Adaptations must keep attribution and the same licence. Game titles, company names and brands may have separate rights. FOS is unofficial and not affiliated with SCS Software or the wiki.
