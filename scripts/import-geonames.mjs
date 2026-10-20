// Builds src/data/places/cities-ro-hu-bg.json from the official GeoNames cities15000 dump.
//   node scripts/import-geonames.mjs
// Keeps every populated place in Romania, Hungary and Bulgaria with at least 15,000
// inhabitants, except "sections of populated places" (PPLX: Bucharest sectors, Budapest
// districts) and historical/abandoned/destroyed places. Refuses to write if the result looks wrong.
// Data: GeoNames (https://www.geonames.org), CC BY 4.0.
import { writeFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

const SOURCE = "https://download.geonames.org/export/dump/cities15000.zip";
const OUTPUT = new URL("../src/data/places/cities-ro-hu-bg.json", import.meta.url);
const COUNTRIES = ["RO", "HU", "BG"];
const EXCLUDED_CODES = new Set(["PPLX", "PPLH", "PPLQ", "PPLW", "PPLCH"]);
const TIME_ZONES = { RO: "Europe/Bucharest", HU: "Europe/Budapest", BG: "Europe/Sofia" };
const MUST_INCLUDE = [683506, 3054643, 727011]; // Bucharest, Budapest, Sofia

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

const cities = [];
const excluded = [];
for (const line of text.split("\n")) {
  const f = line.split("\t");
  if (f.length < 19 || !COUNTRIES.includes(f[8]) || f[6] !== "P") continue;
  const record = {
    id: Number(f[0]), name: f[1], latitude: Number(f[4]), longitude: Number(f[5]),
    countryCode: f[8], adminCode: f[10], featureCode: f[7], population: Number(f[14]), timeZone: f[17],
  };
  if (EXCLUDED_CODES.has(record.featureCode) || record.population < 15000) { excluded.push(record); continue; }
  cities.push(record);
}
cities.sort((a, b) => a.countryCode.localeCompare(b.countryCode) || b.population - a.population);
const rank = {};
for (const city of cities) city.countryRank = rank[city.countryCode] = (rank[city.countryCode] || 0) + 1;

// Refuse to write a broken catalog.
const problems = [];
for (const code of COUNTRIES) if ((rank[code] || 0) < 20) problems.push(`${code}: only ${rank[code] || 0} cities`);
for (const id of MUST_INCLUDE) if (!cities.some(city => city.id === id)) problems.push(`missing GeoNames ${id}`);
for (const city of cities) {
  if (/^Sector \d|kerület$/.test(city.name)) problems.push(`district kept: ${city.name}`);
  if (city.timeZone !== TIME_ZONES[city.countryCode]) problems.push(`unexpected time zone: ${city.name} ${city.timeZone}`);
  if (!Number.isFinite(city.latitude) || !Number.isFinite(city.longitude)) problems.push(`bad coordinates: ${city.name}`);
}
if (problems.length) { console.error("Not written:\n" + problems.join("\n")); process.exit(1); }

const catalog = {
  metadata: {
    provider: "GeoNames",
    source: SOURCE,
    license: "CC BY 4.0",
    attribution: "GeoNames geographical database (https://www.geonames.org)",
    importedAt: new Date().toISOString(),
    selection: "Populated places in RO, HU, BG with population >= 15000 from cities15000; excludes feature codes PPLX (sections of populated places), PPLH, PPLQ, PPLW, PPLCH.",
    count: cities.length,
    countByCountry: rank,
  },
  cities,
};
await writeFile(OUTPUT, JSON.stringify(catalog) + "\n");
console.log(`Wrote ${cities.length} cities`, rank, `| excluded ${excluded.length}:`, excluded.map(c => `${c.name} (${c.featureCode})`).join(", "));
