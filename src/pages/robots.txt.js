// robots.txt with the sitemap URL taken from the configured site.
export function GET({ site }) {
  const body = `User-agent: *\nAllow: /\nDisallow: /ats/mission/\n\nSitemap: ${new URL('/sitemap.xml', site).href}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
