// SEO helpers: the list of indexable pages (for sitemap.xml) and schema.org JSON-LD.
import { cityPath } from './ats.mjs';
import { companyPath } from './companies.mjs';
import { cargoPath, trailerPath, truckPath } from './catalog.mjs';

/** Static pages worth indexing. The mission sheet (/ats/mission/*) and 404 are left out on purpose. */
export const STATIC_PATHS = ['/', '/about', '/ats', '/ats/map', '/ats/companies', '/ats/cargo', '/ats/trailers', '/ats/trucks', '/ats/planner'];

/** Every indexable path, without duplicates, in a stable order. */
export function sitePaths({ cities, companies, cargo, trailers, trucks }) {
  const all = [
    ...STATIC_PATHS,
    ...cities.map(cityPath),
    ...companies.map(companyPath),
    ...cargo.map(cargoPath),
    ...trailers.map(trailerPath),
    ...trucks.map(truckPath),
  ];
  return [...new Set(all)];
}

/**
 * Absolute URL of a page in the form Netlify serves it: pages are folders (build.format
 * 'directory'), so every page URL ends with a slash. Hash and query are kept.
 */
export function pageUrl(site, path) {
  const u = new URL(path, site);
  const last = u.pathname.split('/').pop();
  if (last && !last.includes('.')) u.pathname += '/';
  return u.href;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** sitemap.xml text for the given absolute site URL. */
export function sitemapXml(site, paths) {
  const urls = paths.map((p) => `  <url><loc>${esc(pageUrl(site, p))}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** schema.org BreadcrumbList; crumbs are [name, path] pairs, the last one being the page itself. */
export function breadcrumbLd(site, crumbs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: pageUrl(site, path) })),
  };
}

/** schema.org WebSite with a search action (the header search reads ?q= on any page). */
export function websiteLd(site, name, description) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    description,
    url: new URL('/', site).href,
    potentialAction: { '@type': 'SearchAction', target: `${new URL('/', site).href}?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
  };
}

/** JSON for a <script type="application/ld+json">, safe against "</script>" in names. */
const LT = String.fromCharCode(92) + 'u003c'; // the six characters backslash-u003c
export const ldJson = (obj) => JSON.stringify(obj).replace(/</g, LT);
