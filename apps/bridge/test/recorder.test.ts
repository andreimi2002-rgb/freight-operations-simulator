import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { emptySnapshot } from '@trucksim/core';
import { Recorder } from '../src/recorder.ts';

test('records a drive, short pause, menu gap and resume in a single replay', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'trucksim-recorder-'));
  const recorder = new Recorder(dir, true);
  const start = Date.now();
  const drive = { ...emptySnapshot('live', start), sdkActive: true };
  const scs = {
    time: '42', sdkActive: true, paused: false, onJob: true,
    jobFinished: false, jobDelivered: false, jobCancelled: false,
  };
  try {
    recorder.push(drive, [], scs);
    const first = recorder.current!;
    recorder.push({ ...drive, ts: start + 50, game: { ...drive.game, paused: true } }, [], { ...scs, paused: true });
    recorder.push(emptySnapshot('live', start + 3_000), [], { ...scs, paused: true });
    recorder.push(emptySnapshot('live', start + 10_000), []);
    recorder.push({ ...drive, ts: start + 20_000 }, [], { ...scs, time: '43' });
    assert.equal(recorder.current, first);
    recorder.push(emptySnapshot('live', start + 80_000), []);
    assert.equal(recorder.current, null);
    recorder.push({ ...drive, ts: start + 80_050 }, [], scs);
    assert.notEqual(recorder.current, first);
    recorder.close();

    // Closing the recorder ends the gzip stream asynchronously.
    let recording: string | undefined;
    for (let i = 0; i < 100 && !recording; i++) {
      try {
        recording = gunzipSync(await readFile(join(dir, first))).toString();
      } catch {
        await setTimeout(20);
      }
    }
    assert.ok(recording);
    const rows = recording.trim().split('\n').slice(1).map((line) => JSON.parse(line));
    assert.deepEqual(rows.map(({ t }) => t), [0, 50, 3000, 10000, 20000, 80000]);
    assert.equal(rows[1].s.game.paused, true);
    assert.equal(rows[2].s.sdkActive, false);
    assert.equal(rows[2].scs.sdkActive, true);
    assert.equal(rows[3].scs, undefined);
    assert.equal(rows[4].scs.time, '43');
  } finally {
    recorder.close();
    await rm(dir, { recursive: true, force: true });
  }
});
