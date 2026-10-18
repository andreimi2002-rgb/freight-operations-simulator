# Freight Operations Simulator (FOS)

FOS is an early real-data freight scenario generator. ATS and ETS2 are the initial world modes; the generated freight scenario is not a real booking or dispatch.

## Current version: 0.6.0 preview

- Generate random routes between the 40 most-populated available GeoNames cities per country for ATS and ETS2 regions; exact facility or company searches remain optional.
- Search real cities, addresses, facilities, or businesses through Geoapify Geocoding when choosing locations manually.
- Calculate routes with Geoapify's heavy-truck profile and approximated traffic. Show a route schematic, countries, road classes, named roads, surfaces, toll/ferry flags, and up to 100 route segments with instructions and road attributes.
- Generate a freight category and suggest compatible trailer equipment from a generic real-world planning taxonomy.
- Keep place and route data separate from the generated shipment scenario; do not invent a company contract, load weight, or booking.
- Save up to 30 scenarios in browser local storage and print a sourced scenario brief.

The provider's heavy-truck mode models a maximum gross weight of 40 t and height of 4.1 m. This is not a vehicle-specific clearance. Traffic is approximated, not live; routes do not verify permits, every restriction, facility access, driver-hours compliance, or actual cargo compatibility. Confirm those details before dispatch use.

## Configure Geoapify

The Netlify Functions read `GEOAPIFY_API_KEY` on the server. Add the key in Netlify project environment variables and include both **Production** and **Deploy Previews** scopes. The key is not stored in this repository or exposed in browser JavaScript. The UI reports a configuration error until the key exists.

Geoapify requires an API key for place search and routing. Requesting `route_details` increases API credit consumption; review current usage limits and terms in the [Geoapify Routing API documentation](https://apidocs.geoapify.com/docs/routing/).

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
- `src/data/geonames-cities.json` — sourced random city pools for ATS and ETS2.
- `scripts/import-geonames-cities.ps1` — GeoNames dump filter/import utility.
- `netlify/functions/search-places.mjs` — server-side Geoapify place search.
- `netlify/functions/truck-route.mjs` — server-side Geoapify truck route request.
- `netlify.toml` — Netlify publish, function, and API path configuration.
- `src/data/game-reference-catalog.mjs` — separate, unused game reference archive.
- `src/DATA-LICENSES.md` — archive attribution and reuse details.
- `tests/mission-engine.test.mjs` — scenario consistency checks.
- `CHANGELOG.md` — release notes.
