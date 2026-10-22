import { cities, companies, cargo, trailers, trucks } from '../lib/data.mjs';
import { sitePaths, sitemapXml } from '../lib/seo.mjs';

export function GET({ site }) {
  const xml = sitemapXml(site, sitePaths({ cities, companies, cargo, trailers, trucks }));
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
