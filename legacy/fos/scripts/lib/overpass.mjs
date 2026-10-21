// Overpass API client for the offline data scripts: two endpoints, retries with backoff.
// Data © OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright).
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function overpass(query, userAgent) {
  let lastError = "";
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    for (const url of OVERPASS) {
      try {
        const response = await fetch(url, { method: "POST", headers: { "user-agent": userAgent, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(240000) });
        if (response.ok) { const json = await response.json(); if (Array.isArray(json.elements)) return json; }
        lastError = `${url}: HTTP ${response.status}`;
      } catch (error) { lastError = `${url}: ${error.message}`; }
    }
    console.error(`  attempt ${attempt} failed (${lastError}); waiting`);
    await sleep(15000 * attempt);
  }
  throw new Error(`Overpass did not answer: ${lastError}`);
}
