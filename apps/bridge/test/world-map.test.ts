import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { findInstall } from '../src/gamedata/store.ts';
import { buildWorldFiles, decodeRouter, simplify } from '../src/map/world-build.ts';
import { WorldRouter } from '../src/map/world-router.ts';

test('simplify keeps the shape and drops collinear points', () => {
  const line: Array<[number, number]> = [[0, 0], [10, 0], [20, 0], [30, 0], [30, 10], [30, 20]];
  assert.deepEqual(simplify(line, 0.5), [[0, 0], [30, 0], [30, 20]]);
});

const ets2 = findInstall('ets2');
test('whole ETS2 map: every sector, tiles, and routes across Europe', { skip: ets2 ? false : 'ETS2 not installed', timeout: 120_000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'trucksim-world-'));
  try {
    const meta = buildWorldFiles(ets2!, dir);
    assert.ok(meta.sectors > 1000, `all sectors (${meta.sectors})`);
    assert.ok(meta.tiles.length > 200);
    assert.ok(meta.cities.length >= 360, `city labels (${meta.cities.length})`);
    const tile = JSON.parse(gunzipSync(readFileSync(join(dir, 'tiles', `${meta.tiles[0]}.json.gz`))).toString());
    assert.ok(Array.isArray(tile.roads) && Array.isArray(tile.junctions));

    const router = new WorldRouter(decodeRouter(readFileSync(join(dir, 'router.bin'))));
    const at = (id: string) => meta.cities.find((c) => c.id === id)!.position;
    // Representative corridors, different DLCs: Road to the Black Sea, Iberia, Scandinavia, Baltic.
    for (const [a, b] of [['brasov', 'ruse'], ['madrid', 'lisboa'], ['stockholm', 'oslo'], ['warszawa', 'vilnius'], ['lisboa', 'bucuresti']]) {
      const plan = router.route(at(a!), null, at(b!));
      assert.ok(plan && plan.points.length > 10, `${a} -> ${b}`);
    }
    // Great Britain needs a ferry or the tunnel: not part of the road graph yet.
    assert.equal(router.route(at('calais'), null, at('london')), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
