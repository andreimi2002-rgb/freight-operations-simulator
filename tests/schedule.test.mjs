import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drivingPlan, urgencyOf, timeAllowedH, realMinutes, HOS, URGENCY } from '../src/engine/schedule.mjs';

const driving = (p) => p.segments.filter((s) => s.type === 'drive').reduce((n, s) => n + s.h, 0);

test('short trips need no break', () => {
  const p = drivingPlan(3);
  assert.equal(p.totalH, 3);
  assert.equal(p.breaks + p.rests, 0);
});

test('a 30-minute break after 8 hours of driving', () => {
  const p = drivingPlan(10);
  assert.deepEqual(p.segments.map((s) => [s.type, s.h]), [['drive', 8], ['break', 0.5], ['drive', 2]]);
  assert.equal(p.totalH, 10.5);
});

test('never more than 11 hours of driving between rests, never more than 8 without a break', () => {
  for (const h of [11, 11.5, 19, 24, 40]) {
    const p = drivingPlan(h);
    assert.ok(Math.abs(driving(p) - h) < 0.02, `${h}: all driving planned`);
    let sinceRest = 0;
    let sinceBreak = 0;
    for (const s of p.segments) {
      if (s.type === 'drive') { sinceRest += s.h; sinceBreak += s.h; }
      if (s.type === 'rest') { assert.equal(s.h, HOS.restH); sinceRest = 0; sinceBreak = 0; }
      if (s.type === 'break') { assert.equal(s.h, HOS.breakH); sinceBreak = 0; }
      assert.ok(sinceRest <= HOS.maxDriveH + 1e-6, `${h}: ≤ 11 h before rest`);
      assert.ok(sinceBreak <= HOS.breakAfterH + 1e-6, `${h}: ≤ 8 h before a break`);
    }
    assert.notEqual(p.segments.at(-1).type, 'rest', 'the plan ends driving');
  }
});

test('urgency is stable per job and follows the stated weights', () => {
  assert.equal(urgencyOf('a.b.c'), urgencyOf('a.b.c'));
  const count = { standard: 0, important: 0, urgent: 0 };
  for (let i = 0; i < 3000; i++) count[urgencyOf(`job-${i}`)]++;
  for (const l of URGENCY.levels) assert.ok(Math.abs(count[l.id] / 3000 - l.weight / 100) < 0.04, `${l.id}: ${count[l.id]}`);
});

test('time allowed: planned trip plus the margin, at least one hour, in quarter hours', () => {
  assert.equal(timeAllowedH(10, 'standard'), 15);
  assert.equal(timeAllowedH(10, 'important'), 12.5);
  assert.equal(timeAllowedH(10, 'urgent'), 11);
  assert.equal(timeAllowedH(2, 'urgent'), 3, 'minimum margin of one hour');
  assert.equal(timeAllowedH(10.1, 'urgent') % 0.25, 0);
});

test('one in-game hour is three real minutes', () => {
  assert.equal(realMinutes(1), 3);
  assert.equal(realMinutes(6 + 22 / 60), 19);
});
