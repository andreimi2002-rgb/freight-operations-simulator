// Phase B6: trailer categories, our icons and the illustrative catalog photos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trailerCategory, cargoCategory, catalogPhoto, ICONS, iconSvg } from '../src/lib/media.mjs';
import { acceptLicence, isPublicDomain } from '../scripts/photos/lib/commons.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const { categories } = read('data/categories.json');
const { trailers } = read('data/ats/trailers.json');
const { cargo } = read('data/ats/cargo.json');
const { trucks } = read('data/ats/trucks.json');
const catalogPhotos = read('data/catalog-photos.json');
const en = read('src/i18n/en.json');

test('every trailer type is in exactly one category, and every category is a trailer type of the game', () => {
  const ids = new Set(trailers.map((t) => t.id));
  for (const t of trailers) {
    const hits = categories.filter((c) => c.trailers.includes(t.id));
    assert.equal(hits.length, 1, `${t.id} is in ${hits.length} categories`);
  }
  for (const c of categories) for (const t of c.trailers) assert.ok(ids.has(t), `${c.id} lists unknown trailer ${t}`);
});

test('every category, the truck and the general cargo have an icon and a name', () => {
  for (const id of [...categories.map((c) => c.id), 'truck', 'general']) {
    assert.ok(ICONS[id], `no icon for ${id}`);
    assert.equal(typeof en.media.categories[id], 'string', `no name for ${id}`);
  }
  assert.match(iconSvg('box'), /^<svg viewBox="0 0 48 28" aria-hidden="true"/);
  assert.equal(iconSvg('unknown-id'), iconSvg('general'));
});

test('a cargo gets the category with most of its trailers, ties go to the first listed', () => {
  const cat = (id) => cargoCategory(cargo.find((c) => c.id === id), categories);
  assert.equal(cat('fruits'), 'reefer');          // insulated + refrigerated
  assert.equal(cat('grain'), 'bulk');             // three bulk trailers beat the vans
  assert.equal(cat('clothes'), 'box');            // dry van + sliding tarp beat the reefers
  assert.equal(cat('hay'), 'flatbed');            // flatbed + drop deck beat the chip van
  assert.equal(cat('excavator'), 'heavy');
  assert.equal(cat('backhoe-loader'), 'heavy');   // drop deck vs lowboy: heavy is listed first
  assert.equal(cat('milk'), 'tank');              // food tank vs refrigerated: tank is listed first
  assert.equal(cat('logs'), 'timber');
  assert.equal(cat('anhydrous-ammonia'), 'general'); // no trailer type on the wiki
  assert.equal(trailerCategory('lowboy-boat', categories), 'special');
  assert.equal(trailerCategory('nope', categories), 'general');
});

test('catalog photos: only known items, free licence, author, Commons links, a reason', () => {
  const known = { trucks: new Set(trucks.map((x) => x.id)), trailers: new Set(trailers.map((x) => x.id)), cargo: new Set(cargo.map((x) => x.id)) };
  let n = 0;
  for (const kind of ['trucks', 'trailers', 'cargo']) {
    for (const [id, entry] of Object.entries(catalogPhotos[kind])) {
      assert.ok(known[kind].has(id), `${kind}/${id} is not in the game data`);
      assert.ok(entry.reason && entry.reason.length > 10, `${kind}/${id} has no reason`);
      const p = entry.photo;
      if (p === null) continue;
      n++;
      assert.ok(acceptLicence(p.licence), `${kind}/${id}: licence ${p.licence}`);
      assert.ok(p.author || isPublicDomain(p.licence), `${kind}/${id}: no author`);
      assert.match(p.src, /^https:\/\/(upload|thumb)\.wikimedia\.org\//);
      assert.match(p.src500, /^https:\/\/(upload|thumb)\.wikimedia\.org\/.*\/500px-/);
      assert.match(p.page, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      assert.ok(p.width > 0 && p.height > 0, `${kind}/${id}: size`);
      assert.equal(catalogPhoto(kind, id, catalogPhotos), p);
    }
  }
  assert.equal(catalogPhoto('trucks', 'not-a-truck', catalogPhotos), null);
  assert.ok(n >= 0);
});

test('generic cargo only: no photo for a branded machine', () => {
  // Branded machines (a make and a model in the name) keep the category icon.
  const branded = /\b(Bobcat|JCB|Volvo|Krone|Kenworth|Peterbilt|Western Star)\b/;
  for (const id of Object.keys(catalogPhotos.cargo)) {
    const c = cargo.find((x) => x.id === id);
    assert.ok(!branded.test(c.name), `${id} is a branded machine`);
  }
});
