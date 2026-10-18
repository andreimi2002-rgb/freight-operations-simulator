# Data attribution and licenses

## GeoNames city catalog

`data/geonames-cities.json` is a filtered export of the official GeoNames `cities15000.zip` gazetteer. It contains the 40 highest-population available city records in the contiguous United States (ATS pool) and selected ETS2 European countries. Countries with fewer than 40 eligible records contribute all eligible records. The catalog currently contains 1,150 records. Coordinates, population, country rank, and time-zone fields retain GeoNames identifiers so each selected city links back to its source record.

- Attribution: GeoNames geographical database
- License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
- Source dump: [GeoNames cities15000.zip](https://download.geonames.org/export/dump/cities15000.zip)
- Format and selection: [GeoNames dump readme](https://download.geonames.org/export/dump/readme.txt)
- Import utility: `scripts/import-geonames-cities.ps1`

The source describes the data as provided as-is and makes no warranty of accuracy, timeliness, or completeness. Coordinates are city centroids, not freight terminals. Random scenarios therefore route between real city records, while the exact shipment, cargo assignment, and equipment suggestion remain generated.

## Curated cargo catalog

`data/cargo-catalog.mjs` is an original FOS curation of real-world commodity examples. The broad transport-goods classification reference is [UNECE NST 2007](https://unece.org/transport/statistics-transport/classification-nst-2007); the catalog does not claim that each example has an assigned NST code. Perishable-food context links to the [UNECE ATP Handbook](https://unece.org/atp-handbook), dangerous-goods cautions link to [UNECE ADR](https://unece.org/transport/dangerous-goods), and live-animal carriage links to [EU Regulation EC 1/2005](https://eur-lex.europa.eu/eli/reg/2005/1/oj/eng) as one jurisdiction-specific example.

Cargo-to-trailer pairings and handling prompts are planning heuristics written for scenario generation. They are not verified compatibility determinations, product safety instructions, or dispatch advice. Exact cargo properties, packaging, temperature setpoints, mass, dimensions, dangerous-goods status, and legal carriage conditions must come from the specific product and applicable rules. No such numeric cargo facts are fabricated by this catalog.

- Catalog content: FOS-curated examples; no external dataset copied into the file.
- Reference frameworks: UNECE NST 2007, ATP, and ADR as linked per record where relevant.
- Maintenance: keep product-specific requirements marked unknown until linked to an authoritative source and jurisdiction.

## Truck Simulator Wiki reference catalog

`data/game-reference-catalog.mjs` is a small, separately maintained selection of cargo names, trailer associations, company names, and industry labels derived from the Truck Simulator Wiki pages listed in that file.

- Attribution: Truck Simulator Wiki contributors
- License for licensable wiki text/content: [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/)
- Wiki copyright and exceptions: [Truck Simulator Wiki:Copyrights](https://trucksimulator.wiki.gg/wiki/Truck_Simulator_Wiki:Copyrights)
- Cargo references: [ATS cargo](https://trucksimulator.wiki.gg/wiki/Cargo_types/American_Truck_Simulator), [ETS2 cargo](https://trucksimulator.wiki.gg/wiki/Cargo_types/Euro_Truck_Simulator_2)
- Company references: [ATS companies](https://trucksimulator.wiki.gg/wiki/Companies/American_Truck_Simulator), [ETS2 companies](https://trucksimulator.wiki.gg/wiki/Companies/Euro_Truck_Simulator_2)

This data file is licensed under CC BY-SA 4.0. Adaptations to this file must retain attribution and use the same license. Images and logos are not included. Game titles, company names, brands, and other game material may have separate rights held by their respective owners. FOS is an unofficial fan project and is not affiliated with SCS Software or the wiki.

FOS-generated weights, distances, fuel, timings, and deadlines are separate illustrative estimates, not sourced game or real-world operating facts.
