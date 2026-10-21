// Fetches /api/weather/<GeoNames ID> (Netlify function in front of MET Norway).
// Answers are kept for 15 minutes in this page; a failure is not kept, so "Reîncearcă" asks again.
const memo = new Map();
const MAX_AGE_MS = 15 * 60000;

export function fetchCityWeather(geonamesId, { fetchImpl = (...args) => fetch(...args), now = Date.now() } = {}) {
  const key = String(geonamesId);
  const hit = memo.get(key);
  if (hit && now - hit.at < MAX_AGE_MS) return hit.promise;
  const promise = fetchImpl(`/api/weather/${encodeURIComponent(key)}`)
    .then(async response => {
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw Object.assign(new Error("weather"), { body: body || { ok: false, error: "weatherUnavailable" } });
      return body;
    })
    .catch(error => { memo.delete(key); return error.body || { ok: false, error: "network" }; });
  memo.set(key, { at: now, promise });
  return promise;
}

export const forgetWeather = () => memo.clear();
