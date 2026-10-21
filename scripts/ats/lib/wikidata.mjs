// Real-world coordinates for game cities, from Wikidata (CC0).
// Match: English Wikipedia article "<City>, <State>" (redirects followed) →
// its Wikidata item → P625 coordinates. The item must lie in the state
// (P131*, checked with one SPARQL query), otherwise the city gets no
// coordinates and an issue is recorded.

const ENWIKI_API = 'https://en.wikipedia.org/w/api.php';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const SPARQL = 'https://query.wikidata.org/sparql';

/**
 * @param client  wiki-client instance (cache + rate limit)
 * @param cities  [{ id, name, stateName, stateQid }]
 * @returns Map(id → { lat, lon, wikidata, enwiki } | { error })
 */
export async function coordinatesFor(client, cities) {
  const result = new Map();
  const titleOf = (c) => `${c.name}, ${c.stateName}`;

  // 1. Article titles → Wikidata items (redirects followed).
  const itemByTitle = new Map();
  const titles = cities.map(titleOf);
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const sp = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', redirects: '1', prop: 'pageprops', ppprop: 'wikibase_item', titles: batch.join('|') });
    const j = await client.getJson(`${ENWIKI_API}?${sp}`);
    const norm = new Map((j.query.normalized ?? []).map((n) => [n.from, n.to]));
    const redir = new Map((j.query.redirects ?? []).map((r) => [r.from, r.to]));
    const byFinal = new Map(j.query.pages.map((p) => [p.title, p]));
    for (const t of batch) {
      let cur = norm.get(t) ?? t;
      cur = redir.get(cur) ?? cur;
      const page = byFinal.get(cur);
      if (page && !page.missing && page.pageprops?.wikibase_item) {
        itemByTitle.set(t, { qid: page.pageprops.wikibase_item, enwiki: page.title });
      }
    }
  }

  // 2. Coordinates (P625) of those items.
  const qids = [...new Set([...itemByTitle.values()].map((v) => v.qid))];
  const coords = new Map();
  for (let i = 0; i < qids.length; i += 50) {
    const sp = new URLSearchParams({ action: 'wbgetentities', format: 'json', ids: qids.slice(i, i + 50).join('|'), props: 'claims' });
    const j = await client.getJson(`${WIKIDATA_API}?${sp}`);
    for (const [qid, ent] of Object.entries(j.entities ?? {})) {
      const claims = (ent.claims?.P625 ?? []).filter((c) => c.mainsnak?.datavalue);
      const best = claims.find((c) => c.rank === 'preferred') ?? claims.find((c) => c.rank === 'normal');
      const v = best?.mainsnak.datavalue.value;
      if (v) coords.set(qid, { lat: round(v.latitude), lon: round(v.longitude) });
    }
  }

  // 3. Check each item lies in its state.
  const stateQids = [...new Set(cities.map((c) => c.stateQid))];
  const inState = new Set();
  if (qids.length) {
    const query = `SELECT ?item ?state WHERE { VALUES ?item { ${qids.map((q) => `wd:${q}`).join(' ')} } VALUES ?state { ${stateQids.map((q) => `wd:${q}`).join(' ')} } ?item wdt:P131* ?state . }`;
    const sp = new URLSearchParams({ query, format: 'json' });
    const j = await client.getJson(`${SPARQL}?${sp}`);
    for (const b of j.results.bindings) {
      inState.add(`${b.item.value.split('/').pop()}|${b.state.value.split('/').pop()}`);
    }
  }

  for (const c of cities) {
    const hit = itemByTitle.get(titleOf(c));
    if (!hit) { result.set(c.id, { error: `no English Wikipedia article "${titleOf(c)}" with a Wikidata item` }); continue; }
    if (!inState.has(`${hit.qid}|${c.stateQid}`)) { result.set(c.id, { error: `${hit.qid} is not located in ${c.stateName} on Wikidata` }); continue; }
    const xy = coords.get(hit.qid);
    if (!xy) { result.set(c.id, { error: `${hit.qid} has no coordinates (P625)` }); continue; }
    result.set(c.id, { ...xy, wikidata: hit.qid, enwiki: hit.enwiki });
  }
  return result;
}

function round(n) {
  return Math.round(n * 1e5) / 1e5;
}
