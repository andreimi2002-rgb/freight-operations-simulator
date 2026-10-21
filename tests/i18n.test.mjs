import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeT, lookup } from '../src/i18n/translate.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const en = JSON.parse(readFileSync(join(root, 'src/i18n/en.json'), 'utf8'));
const sources = JSON.parse(readFileSync(join(root, 'src/data/sources.json'), 'utf8'));

function files(dir, ext) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    return d.isDirectory() ? files(p, ext) : p.endsWith(ext) ? [p] : [];
  });
}

test('makeT fills parameters and throws on a missing key', () => {
  const t = makeT({ a: { b: 'Stage {n}' } });
  assert.equal(t('a.b', { n: 3 }), 'Stage 3');
  assert.throws(() => t('a.missing'), /missing text/);
  assert.throws(() => t('a'), /missing text/);
});

test('every literal t() key used in components exists in en.json', () => {
  const missing = [];
  for (const file of files(join(root, 'src'), '.astro')) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([\w.]+)'/g)) {
      if (typeof lookup(en, m[1]) !== 'string') missing.push(`${m[1]} (${file})`);
    }
  }
  assert.deepEqual(missing, []);
});

test('dynamic keys for the home page and sources exist', () => {
  const t = makeT(en);
  for (const col of ['time', 'cargo', 'from', 'to', 'distance', 'trailer', 'status']) t(`home.board.cols.${col}`);
  for (const p of ['city', 'board', 'job']) { t(`home.pillars.${p}.title`); t(`home.pillars.${p}.text`); }
  for (const r of ['real', 'unknown', 'ids', 'images']) t(`about.rules.${r}`);
  for (const s of [...sources.sources, ...sources.software]) {
    t(`sources.${s.id}.use`);
    t(`sources.${s.id}.licence`);
    if (s.name === null) t(`sources.${s.id}.name`);
  }
});

test('footer attribution matches the text required by the plan', () => {
  const plan = readFileSync(join(root, 'DEVELOPMENT_PLAN.md'), 'utf8');
  for (const key of ['footer.gameData', 'footer.weatherPhotos', 'footer.notAffiliated']) {
    assert.ok(plan.includes(lookup(en, key)), `${key} differs from DEVELOPMENT_PLAN.md`);
  }
});
