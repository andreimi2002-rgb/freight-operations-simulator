// Polite MediaWiki API client: at most one request per second per host, a
// clear User-Agent, maxlag, retries with backoff, and a local file cache
// (.cache/wiki/, not in git) so re-runs do not hit the wiki again.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const USER_AGENT =
  'FreightWorldDataBot/0.1 (https://github.com/andreimi2002-rgb/freight-operations-simulator; fan project data collection)';

const lastRequest = new Map();

export function createClient({ cacheDir, minIntervalMs = 1000, offline = false, refresh = false, log = () => {} }) {
  mkdirSync(cacheDir, { recursive: true });
  let requests = 0;
  let cacheHits = 0;

  async function getJson(url) {
    const file = join(cacheDir, `${createHash('sha1').update(url).digest('hex')}.json`);
    if (!refresh && existsSync(file)) {
      cacheHits++;
      return JSON.parse(readFileSync(file, 'utf8')).body;
    }
    if (offline) throw new Error(`offline and not cached: ${url}`);
    const host = new URL(url).host;
    for (let attempt = 1; ; attempt++) {
      const wait = (lastRequest.get(host) ?? 0) + minIntervalMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastRequest.set(host, Date.now());
      requests++;
      let res;
      try {
        res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
      } catch (err) {
        if (attempt >= 4) throw err;
        await backoff(attempt, log, url, err.message);
        continue;
      }
      const retryAfter = Number(res.headers.get('retry-after') ?? 0);
      if (res.status === 429 || res.status >= 500) {
        if (attempt >= 4) throw new Error(`${res.status} for ${url}`);
        await backoff(attempt, log, url, String(res.status), retryAfter);
        continue;
      }
      if (!res.ok) throw new Error(`${res.status} for ${url}`);
      const body = await res.json();
      if (body?.error?.code === 'maxlag') {
        if (attempt >= 4) throw new Error(`maxlag for ${url}`);
        await backoff(attempt, log, url, 'maxlag', retryAfter);
        continue;
      }
      if (body?.error) throw new Error(`API error ${body.error.code}: ${body.error.info}`);
      writeFileSync(file, JSON.stringify({ url, retrieved: new Date().toISOString(), body }));
      return body;
    }
  }

  return { getJson, stats: () => ({ requests, cacheHits }) };
}

async function backoff(attempt, log, url, why, retryAfterS = 0) {
  const ms = Math.max(retryAfterS * 1000, 2000 * 2 ** (attempt - 1));
  log(`retry ${attempt} in ${ms} ms (${why}): ${url}`);
  await new Promise((r) => setTimeout(r, ms));
}

/** MediaWiki helpers on top of a client. */
export function mediaWiki(client, api) {
  const q = (params) => {
    const sp = new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params });
    return client.getJson(`${api}?${sp}`);
  };

  /** All members of a category (pages only), following continuation. */
  async function categoryMembers(category) {
    const out = [];
    let cont = {};
    do {
      const j = await q({ action: 'query', list: 'categorymembers', cmtitle: `Category:${category}`, cmtype: 'page', cmlimit: '500', ...cont });
      out.push(...j.query.categorymembers.map((m) => m.title));
      cont = j.continue ?? null;
    } while (cont);
    return out;
  }

  /** Latest wikitext of many pages (batches of 20), with revision id and timestamp. */
  async function pages(titles) {
    const out = new Map();
    for (let i = 0; i < titles.length; i += 20) {
      const batch = titles.slice(i, i + 20);
      const j = await q({ action: 'query', prop: 'revisions', rvprop: 'content|ids|timestamp', rvslots: 'main', titles: batch.join('|') });
      const norm = new Map((j.query.normalized ?? []).map((n) => [n.to, n.from]));
      for (const p of j.query.pages) {
        const rev = p.revisions?.[0];
        const requested = norm.get(p.title) ?? p.title;
        out.set(requested, rev ? { title: p.title, text: rev.slots.main.content, revid: rev.revid, timestamp: rev.timestamp } : null);
      }
    }
    return out;
  }

  /** Resolve redirects: Map(requested title → final title, or null when missing). */
  async function resolve(titles) {
    const out = new Map();
    for (let i = 0; i < titles.length; i += 50) {
      const batch = titles.slice(i, i + 50);
      const j = await q({ action: 'query', titles: batch.join('|'), redirects: '1' });
      const norm = new Map((j.query.normalized ?? []).map((n) => [n.from, n.to]));
      const redir = new Map((j.query.redirects ?? []).map((r) => [r.from, r.to]));
      const missing = new Set(j.query.pages.filter((p) => p.missing).map((p) => p.title));
      for (const t of batch) {
        let cur = norm.get(t) ?? t;
        cur = redir.get(cur) ?? cur;
        out.set(t, missing.has(cur) ? null : cur);
      }
    }
    return out;
  }

  return { q, categoryMembers, pages, resolve };
}
