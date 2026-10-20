// Builds one city catalog per country (src/data/places/cities-<CC>.json) from the official
// GeoNames cities15000 dump.
//   node scripts/import-geonames.mjs            (the active countries from src/data/countries.mjs)
//   node scripts/import-geonames.mjs AT GR      (explicit countries; each must be listed in countries.mjs)
// Keeps every populated place with at least 15,000 inhabitants, except "sections of populated
// places" (PPLX: e.g. Bucharest sectors, Budapest districts) and historical, abandoned or destroyed
// places. Refuses to write a country whose result looks wrong. Data: GeoNames, CC BY 4.0.
import { writeFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import { ACTIVE_COUNTRIES, COUNTRIES } from "../src/data/countries.mjs";

const SOURCE = "https://download.geonames.org/export/dump/cities15000.zip";
const EXCLUDED_CODES = new Set(["PPLX", "PPLH", "PPLQ", "PPLW", "PPLCH"]);
const MIN_POPULATION = 15000;

const wanted = process.argv.slice(2).map(code => code.toUpperCase());
const codes = wanted.length ? wanted : ACTIVE_COUNTRIES;
for (const code of codes) if (!COUNTRIES[code]) { console.error(`Unknown country ${code}: add it to src/data/countries.mjs first.`); process.exit(1); }

// Minimal ZIP reader: the dump contains one deflated text file.
function unzipFirstFile(buffer) {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("Not a ZIP file");
  let pointer = buffer.readUInt32LE(eocd + 16);
  const entries = buffer.readUInt16LE(eocd + 10);
  for (let i = 0; i < entries; i += 1) {
    if (buffer.readUInt32LE(pointer) !== 0x02014b50) throw new Error("Broken ZIP directory");
    const method = buffer.readUInt16LE(pointer + 10);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const localOffset = buffer.readUInt32LE(pointer + 42);
    const name = buffer.toString("utf8", pointer + 46, pointer + 46 + nameLength);
    if (name.endsWith(".txt")) {
      const start = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
      const data = buffer.subarray(start, start + compressedSize);
      return method === 8 ? inflateRawSync(data) : data;
    }
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error("No .txt file in the ZIP");
}

const response = await fetch(SOURCE, { headers: { "user-agent": "FOS GeoNames importer (https://github.com/andreimi2002-rgb/freight-operations-simulator)" } });
if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
const text = unzipFirstFile(Buffer.from(await response.arrayBuffer())).toString("utf8");
const importedAt = new Date().toISOString();

let failed = false;
for (const code of codes) {
  const country = COUNTRIES[code];
  const cities = [];
  const excluded = [];
  for (const line of text.split("\n")) {
    const f = line.split("\t");
    if (f.length < 19 || f[8] !== code || f[6] !== "P") continue;
    const record = {
      id: Number(f[0]), name: f[1], latitude: Number(f[4]), longitude: Number(f[5]),
      countryCode: f[8], adminCode: f[10], featureCode: f[7], population: Number(f[14]), timeZone: f[17],
    };
    if (EXCLUDED_CODES.has(record.featureCode) || record.population < MIN_POPULATION) excluded.push(record);
    else cities.push(record);
  }
  cities.sort((a, b) => b.population - a.population);
  cities.forEach((city, index) => { city.countryRank = index + 1; });

  const problems = [];
  if (cities.length < country.minCities) problems.push(`only ${cities.length} cities (minimum ${country.minCities})`);
  if (!cities.some(city => city.id === country.capitalGeonamesId)) problems.push(`missing GeoNames ${country.capitalGeonamesId}`);
  for (const city of cities) {
    if (/^Sector \d|kerület$/.test(city.name)) problems.push(`district kept: ${city.name}`);
    if (!country.timeZones.includes(city.timeZone)) problems.push(`unexpected time zone: ${city.name} ${city.timeZone}`);
    if (!Number.isFinite(city.latitude) || !Number.isFinite(city.longitude)) problems.push(`bad coordinates: ${city.name}`);
  }
  if (problems.length) { console.error(`${code} not written:\n${problems.join("\n")}`); failed = true; continue; }

  const catalog = {
    metadata: {
      provider: "GeoNames",
      source: SOURCE,
      license: "CC BY 4.0",
      attribution: "GeoNames geographical database (https://www.geonames.org)",
      importedAt,
      countryCode: code,
      selection: `Populated places in ${code} with population >= ${MIN_POPULATION} from cities15000; excludes feature codes ${[...EXCLUDED_CODES].join(", ")}.`,
      count: cities.length,
    },
    cities,
  };
  await writeFile(new URL(`../src/data/${country.cityFile}`, import.meta.url), JSON.stringify(catalog) + "\n");
  console.log(`${code}: wrote ${cities.length} cities (${excluded.length} excluded)`);
}
if (failed) process.exit(1);
