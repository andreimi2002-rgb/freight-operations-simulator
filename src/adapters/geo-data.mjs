// Loads the static geographic data used by the 2A facts (country borders, border crossings, Schengen list,
// UN/LOCODE codes). Everything is optional: when a file cannot be loaded the matching facts show "Indisponibil".
import { prepareBorders } from "../engine/border-split.mjs";

async function json(path) {
  const response = await fetch(`/src/data/${path}`, { cache: "force-cache" });
  if (!response.ok) throw new Error(path);
  return response.json();
}

// -> { geo: { borders, crossings, schengen } | null, locodes: { geonamesId: "ROBUH" } }
export async function loadGeoData() {
  const [borders, crossings, schengen, locodes] = await Promise.allSettled([
    json("geo/borders.json"), json("geo/border-crossings.json"), json("geo/schengen.json"), json("places/locodes.json"),
  ]);
  const geo = borders.status === "fulfilled"
    ? {
      borders: prepareBorders(borders.value),
      crossings: crossings.status === "fulfilled" ? crossings.value.crossings : [],
      schengen: schengen.status === "fulfilled" ? schengen.value.members : [],
    }
    : null;
  return { geo, locodes: locodes.status === "fulfilled" ? locodes.value.codes : {} };
}
