import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSearchIndex, searchIndex, norm } from '../src/lib/search.mjs';
import { sitePaths, sitemapXml, breadcrumbLd, websiteLd, ldJson, pageUrl, STATIC_PATHS } from '../src/lib/seo.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const load = (f) => JSON.parse(readFileSync(`${root}data/ats/${f}.json`, 'utf8'));
const data = {
  cities: load('cities').cities,
  companies: load('companies').companies,
  cargo: load('cargo').cargo,
  trailers: load('trailers').trailers,
  trucks: load('trucks').trucks,
};
const site = new URL('https://example.test');

test('norm strips accents, case and punctuation', () => {
  assert.equal(norm('  Café-Rouge  '), 'cafe rouge');
  assert.equal(norm(null), '');
});

test('search index covers every entity once and links to real paths', () => {
  const index = buildSearchIndex(data);
  const total = Object.values(data).reduce((s, l) => s + l.length, 0);
  assert.equal(index.length, total);
  const paths = new Set(sitePaths(data));
  for (const [, , , url] of index) assert.ok(paths.has(url), url);
});

test('search ranks prefix matches first and ignores accents and case', () => {
  const index = buildSearchIndex(data);
  const top = searchIndex(index, 'PHOE')[0];
  assert.equal(top[0], 'city');
  assert.equal(top[1], 'Phoenix');
  assert.ok(searchIndex(index, 'mack').every(([type]) => type === 'truck' || type === 'company'));
  assert.deepEqual(searchIndex(index, '   '), []);
  assert.deepEqual(searchIndex(index, 'zzzzqqq'), []);
  assert.ok(searchIndex(index, 'a', 5).length <= 5);
});

test('sitemap lists static pages and every entity page, without duplicates', () => {
  const paths = sitePaths(data);
  assert.equal(new Set(paths).size, paths.length);
  for (const p of STATIC_PATHS) assert.ok(paths.includes(p), p);
  assert.ok(!paths.some((p) => p.startsWith('/ats/mission')));
  assert.equal(paths.length, STATIC_PATHS.length + Object.values(data).reduce((s, l) => s + l.length, 0));
  const xml = sitemapXml(site, paths);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.equal((xml.match(/<loc>/g) ?? []).length, paths.length);
  assert.ok(xml.includes('<loc>https://example.test/ats/map/</loc>'));
  assert.ok(xml.includes('<loc>https://example.test/</loc>'));
});

test('JSON-LD helpers', () => {
  const bc = breadcrumbLd(site, [['Home', '/'], ['Cargo', '/ats/cargo'], ['Butter', '/ats/cargo/butter']]);
  assert.equal(bc['@type'], 'BreadcrumbList');
  assert.deepEqual(bc.itemListElement.map((x) => x.position), [1, 2, 3]);
  assert.equal(bc.itemListElement[2].item, 'https://example.test/ats/cargo/butter/');
  assert.equal(pageUrl(site, '/og-default.png'), 'https://example.test/og-default.png');
  assert.equal(pageUrl(site, '/ats/'), 'https://example.test/ats/');
  const ws = websiteLd(site, 'Freight World', 'desc');
  assert.equal(ws.potentialAction.target, 'https://example.test/?q={search_term_string}');
  assert.ok(!ldJson({ name: '</script>' }).includes('</script>'));
});

// Checks the built site when it exists (run `npm run build` first); skipped otherwise.
const dist = `${root}dist/`;
const htmlFiles = (dir) => readdirSync(dir).flatMap((f) => {
  const p = `${dir}${f}`;
  if (statSync(p).isDirectory()) return htmlFiles(`${p}/`);
  return f.endsWith('.html') ? [p] : [];
});

test('built pages: unique titles and descriptions, preview tags, canonical', { skip: !existsSync(dist) && 'dist/ not built' }, () => {
  const pages = htmlFiles(dist).filter((p) => !/[\\/](404|ats[\\/]mission)[\\/.]/.test(p.slice(dist.length - 1)));
  assert.ok(pages.length > 400);
  const titles = new Map();
  const descriptions = new Map();
  const canonicals = new Set();
  const meta = (html, prop) => html.match(new RegExp(`<meta (?:name|property)="${prop}" content="([^"]*)"`))?.[1];
  for (const p of pages) {
    const html = readFileSync(p, 'utf8');
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
    const desc = meta(html, 'description');
    assert.ok(title, `${p}: title`);
    assert.ok(desc && desc.length >= 50 && desc.length <= 200, `${p}: description length ${desc?.length}`);
    assert.ok(!titles.has(title), `duplicate title "${title}": ${p} and ${titles.get(title)}`);
    assert.ok(!descriptions.has(desc), `duplicate description: ${p} and ${descriptions.get(desc)}`);
    titles.set(title, p);
    descriptions.set(desc, p);
    assert.ok(meta(html, 'og:image')?.startsWith('http'), `${p}: og:image`);
    assert.ok(meta(html, 'twitter:card'), `${p}: twitter:card`);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    assert.ok(canonical?.startsWith('http') && canonical.endsWith('/'), `${p}: canonical ${canonical}`);
    canonicals.add(canonical);
  }
  // Every canonical URL is in the sitemap, written the same way.
  const xml = readFileSync(`${dist}sitemap.xml`, 'utf8');
  const inSitemap = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  for (const c of canonicals) assert.ok(inSitemap.has(c), `canonical not in sitemap: ${c}`);
  assert.equal(inSitemap.size, canonicals.size);
});
