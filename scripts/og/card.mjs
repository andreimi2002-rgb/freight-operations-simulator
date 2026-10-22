// Writes the HTML for the default link-preview card (public/og-default.png, 1200x630).
// Text comes from src/i18n/en.json and the counts from data/ats, so nothing is typed by hand.
// Usage: node scripts/og/card.mjs <out.html>, then screenshot it at 1200x630 in Chrome
// (playwright-core is not a project dependency; any headless Chrome screenshot works).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const json = (p) => JSON.parse(readFileSync(root + p, 'utf8'));
const en = json('src/i18n/en.json');
const n = {
  cities: json('data/ats/cities.json').cities.length,
  companies: json('data/ats/companies.json').companies.length,
  cargo: json('data/ats/cargo.json').cargo.length,
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const stat = (s) => esc(s).replace(/\{(\w+)\}/g, (_, k) => `<b>${n[k]}</b>`);
const font = (f) => `url("${pathToFileURL(root + `public/fonts/${f}`).href}")`;
const logo = readFileSync(root + 'public/favicon.svg', 'utf8');

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: Inter; src: ${font('inter-latin-wght-normal.woff2')}; font-weight: 100 900; }
@font-face { font-family: Mono; src: ${font('jetbrains-mono-latin-wght-normal.woff2')}; font-weight: 100 900; }
html, body { margin: 0; width: 1200px; height: 630px; background: #0B0F14; color: #E6EDF3; font-family: Inter; }
.card { box-sizing: border-box; width: 1200px; height: 630px; padding: 72px 80px; display: grid; align-content: space-between;
  background: radial-gradient(900px 500px at 100% 0%, rgba(245,165,36,.14), transparent 60%), #0B0F14; border-bottom: 10px solid #F5A524; }
.brand { display: flex; gap: 22px; align-items: center; font-size: 40px; font-weight: 700; letter-spacing: -0.01em; }
.brand svg { width: 64px; height: 64px; }
h1 { margin: 0; font-size: 64px; line-height: 1.08; font-weight: 700; letter-spacing: -0.02em; max-width: 960px; }
.stats { display: flex; gap: 48px; font-family: Mono; font-size: 26px; color: #B7C2CD; text-transform: uppercase; letter-spacing: .06em; }
.stats b { color: #F5A524; font-weight: 700; margin-right: 10px; }
</style><div class="card">
<div class="brand">${logo}<span>${esc(en.site.name)}</span></div>
<h1>${esc(en.site.tagline)}</h1>
<div class="stats"><span>${stat(en.og.cities)}</span><span>${stat(en.og.companies)}</span><span>${stat(en.og.cargo)}</span><span>ATS</span></div>
</div>`;
writeFileSync(process.argv[2] ?? 'og-card.html', html);
