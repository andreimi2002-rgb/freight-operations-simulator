import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  answerLocally,
  DemoSimulator,
  DerivedEventDetector,
  detectIntent,
  emptySnapshot,
  fmt,
  makeEvent,
  runTool,
  TripTracker,
  WikiIndex,
  type Snapshot,
  type Trip,
  type WikiData,
} from '../src/index.ts';

function demoSnap(ts: number): Snapshot {
  return new DemoSimulator(0.5).snapshot(ts);
}

test('derived events: connect, job start once, game switch', () => {
  const d = new DerivedEventDetector();
  const a = d.next(demoSnap(1000));
  assert.deepEqual(a.map((e) => e.type).sort(), ['game.connected', 'job.started']);
  assert.deepEqual(d.next(demoSnap(1100)).filter((e) => e.type === 'job.started'), []);
  const off = { ...demoSnap(1200), sdkActive: false };
  assert.ok(d.next(off).some((e) => e.type === 'game.disconnected'));
});

test('speeding needs to be held, not a single spike', () => {
  const d = new DerivedEventDetector({ speedingHoldMs: 3000 });
  const base = demoSnap(0);
  const fast = (ts: number): Snapshot => ({ ...base, ts, truck: { ...base.truck, speedKmh: 110 }, navigation: { ...base.navigation, speedLimitKmh: 90 } });
  d.next(fast(0));
  assert.equal(d.next(fast(1000)).some((e) => e.type === 'speeding'), false);
  assert.equal(d.next(fast(3500)).some((e) => e.type === 'speeding'), true);
  assert.equal(d.next(fast(9000)).some((e) => e.type === 'speeding'), false, 'raised once per episode');
});

test('trip is recorded exactly once on delivery (plan test 8)', () => {
  const saved: Trip[] = [];
  const tracker = new TripTracker((t) => saved.push(t));
  const derived = new DerivedEventDetector();
  const s1 = demoSnap(1000);
  tracker.update(s1, derived.next(s1));
  const s2 = { ...demoSnap(2000), truck: { ...s1.truck, odometerKm: s1.truck.odometerKm! + 120 } };
  tracker.update(s2, derived.next(s2));
  const delivered = makeEvent('job.delivered', s2, { amount: 7840, details: { xp: 500 } });
  tracker.update(s2, [delivered]);
  tracker.update(s2, [delivered]); // duplicate flag must not create a second record
  assert.equal(saved.length, 1);
  assert.equal(saved[0]!.status, 'delivered');
  assert.equal(saved[0]!.revenue, 7840);
  assert.equal(saved[0]!.xp, 500);
  assert.equal(Math.round(saved[0]!.drivenKm!), 120);
  assert.equal(saved[0]!.sourceCompany, 'Subse');
});

test('demo simulator reaches delivery and emits one job.delivered', () => {
  const sim = new DemoSimulator(0.97);
  let delivered = 0;
  let t = 0;
  for (let i = 0; i < 3000 && delivered === 0; i++) {
    t += 100;
    const { events } = sim.tick(t);
    delivered += events.filter((e) => e.type === 'job.delivered').length;
  }
  assert.equal(delivered, 1);
});

test('copilot refuses to invent values without live data', async () => {
  const ctx = { snapshot: emptySnapshot('live', 0), now: 0, trips: () => [], wiki: null };
  const a = await answerLocally('Câtă motorină mai am?', ctx);
  assert.match(a, /Nu am date live/);
  assert.doesNotMatch(a, /\d+\s*L/);
  const stale = { snapshot: demoSnap(0), now: 10_000, trips: () => [], wiki: null };
  assert.match(await answerLocally('Cât mai avem?', stale), /Nu am date live/);
  const tool = (await runTool('get_truck_status', {}, stale)) as { available: boolean };
  assert.equal(tool.available, false);
});

test('copilot answers from telemetry', async () => {
  const s = demoSnap(0);
  const ctx = { snapshot: s, now: 0, trips: () => [], wiki: null };
  const fuel = await answerLocally('Câtă motorină mai am?', ctx);
  assert.ok(fuel.includes(fmt.volume(s.truck.fuelL, 'metric')), fuel);
  assert.match(await answerLocally('Ce marfă duc?', ctx), /Chocolate/);
  assert.match(await answerLocally('Care e următoarea ieșire?', ctx), /nu pot spune ieșiri/);
});

test('intent detection handles Romanian with and without diacritics', () => {
  assert.equal(detectIntent('Cât mai avem?'), 'navigation');
  assert.equal(detectIntent('cat mai avem'), 'navigation');
  assert.equal(detectIntent('Câtă motorină mai am?'), 'fuel');
  assert.equal(detectIntent('Cum a fost cursa de ieri?'), 'trips');
  assert.equal(detectIntent('Ce e Subse?'), 'wiki');
});

test('wiki search over the ATS data and telemetry id matching', () => {
  const root = new URL('../../../data/ats/', import.meta.url);
  const read = (f: string) => JSON.parse(readFileSync(new URL(f, root), 'utf8'));
  const cities = read('cities.json');
  const data: WikiData = {
    meta: cities.meta, cities: cities.cities, companies: read('companies.json').companies,
    cargo: read('cargo.json').cargo, trucks: read('trucks.json').trucks, trailers: read('trailers.json').trailers,
  };
  const w = new WikiIndex(data);
  assert.equal(w.search('oakland')[0]?.title, 'Oakland');
  assert.equal(w.companyByGameId('ai_car_pln')?.name, 'AI Automotive');
  assert.equal(w.city('san_francisco')?.name, 'San Francisco');
});

test('formatting', () => {
  assert.equal(fmt.gameClock(0), 'Luni 00:00');
  assert.equal(fmt.gameClock(1440 * 2 + 9 * 60 + 5), 'Miercuri 09:05');
  assert.equal(fmt.duration(125), '2 h 05 min');
  assert.equal(fmt.distance(null, 'metric'), '—');
  assert.equal(fmt.speed(160.9344, 'imperial'), '100 mph');
});
