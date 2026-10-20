// Builds src/data/places/locodes.json: the UN/LOCODE of each catalog city (GeoNames ID -> code).
//   node scripts/build-locodes.mjs                 (downloads the open mirror)
//   node scripts/build-locodes.mjs path/to/code-list.csv   (a file you downloaded from UNECE yourself)
// Source: UN/LOCODE (UNECE) through the mirror github.com/datasets/un-locode. The REUSE LICENCE OF THE DATA
// IS UNCLEAR (the mirror says so itself); only the codes needed to label our cities are kept.
import { readFile, writeFile } from "node:fs/promises";
import { activeCountries } from "../src/data/countries.mjs";
import { matchCity, parseLocodeCsv } from "./lib/locode.mjs";

const MIRROR = "https://raw.githubusercontent.com/datasets/un-locode/main/data/code-list.csv";
const localFile = process.argv[2];
let text;
if (localFile) text = await readFile(localFile, "utf8");
else {
  const response = await fetch(MIRROR, { headers: { "user-agent": "FOS UN/LOCODE builder (https://github.com/andreimi2002-rgb/freight-operations-simulator)" } });
  if (!response.ok) throw new Error(`UN/LOCODE mirror answered HTTP ${response.status}`);
  text = await response.text();
}
const countries = activeCountries();
const entries = parseLocodeCsv(text, countries.map(c => c.code));
if (entries.length < 500) throw new Error(`only ${entries.length} UN/LOCODE entries parsed; the list looks wrong`);

const codes = {};
const unmatched = [];
let cities = 0;
for (const country of countries) {
  const catalog = JSON.parse(await readFile(new URL(`../src/data/${country.cityFile}`, import.meta.url), "utf8"));
  for (const city of catalog.cities) {
    cities += 1;
    const entry = matchCity(city, entries);
    if (entry) codes[city.id] = entry.locode;
    else unmatched.push(`${city.name} (${country.code})`);
  }
}
// A code must identify one city.
const seen = new Map();
for (const [id, code] of Object.entries(codes)) { if (seen.has(code)) throw new Error(`UN/LOCODE ${code} matched two cities (${seen.get(code)}, ${id})`); seen.set(code, id); }

const output = {
  metadata: {
    provider: "UN/LOCODE (UNECE) via the datasets/un-locode mirror",
    source: localFile ? "a file downloaded from UNECE" : MIRROR,
    licenceNote: "The reuse terms of the UN/LOCODE data are not clearly stated; only identifier codes for our cities are kept, with attribution to UNECE.",
    builtAt: new Date().toISOString(),
    cities,
    matched: Object.keys(codes).length,
    rule: "same country; exact name (accents ignored) within 25 km, or the only place-like entry within 3 km; ambiguous -> no code",
  },
  codes,
};
await writeFile(new URL("../src/data/places/locodes.json", import.meta.url), JSON.stringify(output, null, 1) + "\n");
console.log(`locodes.json: ${output.metadata.matched}/${cities} cities matched. Unmatched (${unmatched.length}): ${unmatched.slice(0, 40).join(", ")}${unmatched.length > 40 ? " …" : ""}`);
