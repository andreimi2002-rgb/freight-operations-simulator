import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const data = JSON.parse(readFileSync(`${root}src/data/sources.json`, 'utf8'));

test('each source has an id, a stage and https links (or none)', () => {
  const ids = new Set();
  for (const s of [...data.sources, ...data.software]) {
    assert.match(s.id, /^[a-zA-Z]+$/);
    assert.ok(!ids.has(s.id), `duplicate id ${s.id}`);
    ids.add(s.id);
    assert.ok(Number.isInteger(s.stage) && s.stage >= 0, `${s.id}: stage`);
    for (const key of ['url', 'licenceUrl']) {
      const v = s[key];
      if (v === null) continue;
      assert.ok(v.startsWith('https://') || v.startsWith('/'), `${s.id}.${key}: ${v}`);
      if (v.startsWith('/')) assert.ok(existsSync(`${root}public${v}`), `${s.id}.${key}: missing file ${v}`);
    }
  }
});

test('the game data source is Truck Simulator Wiki under CC BY-SA 4.0', () => {
  const wiki = data.sources.find((s) => s.id === 'wiki');
  assert.equal(wiki.url, 'https://trucksimulator.wiki.gg');
  assert.equal(wiki.licenceUrl, 'https://creativecommons.org/licenses/by-sa/4.0/');
});
