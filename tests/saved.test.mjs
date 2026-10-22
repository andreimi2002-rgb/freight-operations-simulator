import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, parseState, toggleFav, isFav, removeFav, addRecent, clearRecent, groupFavs, normUrl, MAX_RECENT } from '../src/lib/saved.mjs';

const phoenix = { type: 'city', url: '/ats/az/phoenix/', name: 'Phoenix', detail: 'Arizona' };
const butter = { type: 'cargo', url: '/ats/cargo/butter', name: 'Butter' };

test('normUrl drops the trailing slash but keeps the root', () => {
  assert.equal(normUrl('/ats/az/phoenix/'), '/ats/az/phoenix');
  assert.equal(normUrl('/'), '/');
});

test('toggleFav adds newest first and removes on the second press', () => {
  let s = toggleFav(emptyState(), phoenix, 1);
  s = toggleFav(s, butter, 2);
  assert.deepEqual(s.favs.map((x) => x.name), ['Butter', 'Phoenix']);
  assert.ok(isFav(s, '/ats/az/phoenix'));
  assert.ok(isFav(s, '/ats/az/phoenix/'));
  s = toggleFav(s, phoenix, 3);
  assert.ok(!isFav(s, '/ats/az/phoenix'));
  assert.deepEqual(removeFav(s, '/ats/cargo/butter/').favs, []);
});

test('invalid items are ignored', () => {
  const s = emptyState();
  assert.equal(toggleFav(s, { type: 'spaceship', url: '/x', name: 'X' }), s);
  assert.equal(toggleFav(s, { type: 'city', url: 'https://evil.test/', name: 'X' }), s);
  assert.equal(addRecent(s, { type: 'city', url: '/x', name: '' }), s);
});

test('addRecent moves a page to the top, without duplicates, capped', () => {
  let s = emptyState();
  for (let i = 0; i < MAX_RECENT + 5; i++) s = addRecent(s, { type: 'cargo', url: `/ats/cargo/c${i}`, name: `C${i}` }, i);
  assert.equal(s.recent.length, MAX_RECENT);
  s = addRecent(s, { type: 'cargo', url: '/ats/cargo/c10', name: 'C10' }, 99);
  assert.equal(s.recent[0].url, '/ats/cargo/c10');
  assert.equal(s.recent.filter((x) => x.url === '/ats/cargo/c10').length, 1);
  assert.equal(s.recent[0].at, 99);
  assert.deepEqual(clearRecent(s).recent, []);
});

test('parseState survives broken or hostile storage', () => {
  assert.deepEqual(parseState(null), emptyState());
  assert.deepEqual(parseState('{not json'), emptyState());
  assert.deepEqual(parseState('42'), emptyState());
  const s = parseState(JSON.stringify({ favs: [phoenix, phoenix, { type: 'city', url: 'javascript:alert(1)', name: 'x' }, 'junk'], recent: 'nope' }));
  assert.equal(s.favs.length, 1);
  assert.equal(s.favs[0].url, '/ats/az/phoenix');
  assert.deepEqual(s.recent, []);
});

test('groupFavs keeps the type order and drops empty groups', () => {
  let s = toggleFav(emptyState(), butter, 1);
  s = toggleFav(s, phoenix, 2);
  assert.deepEqual(groupFavs(s).map(([t]) => t), ['city', 'cargo']);
});
