# Freight Operations Simulator (FOS)

FOS is an early real-data freight scenario generator. ATS and ETS2 are the initial world modes; the generated freight scenario is not a real booking or dispatch.

## Current version: 0.9.0 preview

- Generate illustrative, cargo-compatible industry corridors for ATS and ETS2 using city reference points from the GeoNames catalog; general random city-pair routing remains available for cargo without a curated corridor.
- Search real cities, addresses, facilities, or businesses through Geoapify Geocoding when choosing locations manually.
- Use a directory of real company brands as search suggestions, then confirm the exact place through Geoapify; the directory does not claim that a result is company-owned or a real customer lane.
- Calculate routes with Geoapify's heavy-truck profile and approximated traffic. Display a Geoapify/OpenStreetMap road map, a compact route summary, and optional collapsed road classes, surfaces, and key turns.
- Generate from a detailed commodity catalog with specific produce examples and varieties (for example Gala, Fuji, and Granny Smith apples), load forms, handling prompts, temperature caveats, and applicable reference frameworks.
- Choose from detailed trailer profiles, including reefers, multi-temperature equipment, curtainsiders, coil carriers, low-loaders, intermodal chassis, tankers, dump trailers, and vehicle carriers. The UI filters trailer suggestions to the selected cargo.
- Print corridor context, cargo varieties, and trailer configurations alongside the route map.
- Keep place and route data separate from the generated shipment scenario; do not invent a company contract, load weight, or booking.
- Save up to 30 scenarios in browser local storage and print a sourced scenario brief.

Cargo names are curated real-world examples organized with reference to UNECE NST 2007. Commodity variety examples and handling notes are planning prompts, not shipment data or product instructions. Freight corridors are illustrative regional scenarios; their city-centroid routes do not identify a company facility, specific trade flow, or contract. The real-company directory contains brand names and links to official company websites, and only supplies search terms for the provider-backed place search. It does not certify that a returned place is operated by that company. Cargo-to-trailer matches are heuristics, not verified compatibility. Hazardous-goods status is product-specific and is never inferred by the generator. Perishable-food carriage has rules and equipment requirements that depend on the product and applicable jurisdiction.

The provider's heavy-truck mode models a maximum gross weight of 40 t and height of 4.1 m. This is not a vehicle-specific clearance. Traffic is approximated, not live; routes do not verify permits, every restriction, facility access, driver-hours compliance, or actual cargo compatibility. Confirm those details before dispatch use.

## Configure Geoapify

The Netlify Functions read `GEOAPIFY_API_KEY` on the server. Add the key in Netlify project environment variables and include both **Production** and **Deploy Previews** scopes. The key is not stored in this repository or exposed in browser JavaScript. The UI reports a configuration error until the key exists.

Geoapify requires an API key for place search, routing, and static maps. Requesting `route_details` and rendering a Static Maps image use additional API credits; review current usage and terms in the [Geoapify Routing API documentation](https://apidocs.geoapify.com/docs/routing/) and [Static Maps documentation](https://apidocs.geoapify.com/docs/maps/static/).

## Real city catalog

The random city pool is sourced from the official GeoNames `cities15000` dump and filtered to the 40 most-populated available cities per country in the contiguous United States for ATS plus selected European countries for ETS2. Each city retains its GeoNames ID, coordinates, population rank, time zone, and source link. The city catalog is licensed CC BY 4.0; see [data attribution and licenses](src/DATA-LICENSES.md). Its coordinates are city centroids, not verified freight terminals.

## Deploy and develop

Netlify publishes the repository root without a build command and deploys functions from `netlify/functions`. Deploy Previews are produced for pull requests once the repository is connected.

To run locally with functions, use Netlify CLI (`netlify dev`) and set `GEOAPIFY_API_KEY` in a local environment file that is not committed. A plain static server can render the page, but it cannot execute the provider functions.

## Checks

Run the mission scenario consistency tests with:

```sh
node --test tests/mission-engine.test.mjs
```

## Provenance and licensing

The live place and route results carry the Geoapify provider name, retrieval timestamp, and source link where available. The freight category and equipment match are generated planning suggestions. They have no claim to represent a source-verified shipment.

The previous Truck Simulator Wiki reference catalog remains separate in `src/data/game-reference-catalog.mjs` under its documented CC BY-SA 4.0 attribution. It is no longer used by the generator. FOS is unofficial and is not affiliated with SCS Software or Truck Simulator Wiki.

## Project layout

- `index.html` — page structure and form controls.
- `src/styles.css` — responsive dashboard styling.
- `src/main.js` — place search, route request, scenario display, history, and print rendering.
- `src/mission-engine.mjs` — ATS/ETS2 scenario composition and generic freight/equipment taxonomy.
- `src/data/cargo-catalog.mjs` — curated commodity examples, planning notes, compatibility suggestions, and source references.
- `src/data/freight-network.mjs` — illustrative region-to-region freight corridors, company search suggestions, and public background sources.
- `src/data/geonames-cities.json` — sourced random city pools for ATS and ETS2.
- `scripts/import-geonames-cities.ps1` — GeoNames dump filter/import utility.
- `netlify/functions/search-places.mjs` — server-side Geoapify place search.
- `netlify/functions/truck-route.mjs` — server-side Geoapify truck route request.
- `netlify.toml` — Netlify publish, function, and API path configuration.
- `src/data/game-reference-catalog.mjs` — separate, unused game reference archive.
- `src/DATA-LICENSES.md` — archive attribution and reuse details.
- `tests/mission-engine.test.mjs` — scenario consistency checks.
- `CHANGELOG.md` — release notes.
