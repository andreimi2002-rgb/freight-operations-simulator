// Driving plan, urgency and delivery deadline for a job. Pure.
//
// Driving plan: US Hours of Service for property-carrying drivers (FMCSA, 49 CFR 395.3):
// at most 11 hours of driving after 10 consecutive hours off duty, and a 30-minute break
// after 8 cumulative hours of driving. These are stricter than the game's own rule (sleep
// every 14 in-game hours, 10 hours of rest; Truck Simulator Wiki, "Rest Stops"), so a plan
// that follows them also satisfies the game. Loading and unloading time is not included.
//
// Urgency and deadline: a Freight World rule (simulated, not the game's formula). The game
// has Standard / Important / Urgent jobs; here the level is picked deterministically from the
// job id, and the deadline adds a margin to the planned time.

import { hash, rng } from './generator.mjs';

export const HOS = { maxDriveH: 11, breakAfterH: 8, breakH: 0.5, restH: 10 };

/** In ATS one in-game hour lasts 3 real minutes outside cities (Truck Simulator Wiki, "Time Compression"). */
export const REAL_MINUTES_PER_GAME_HOUR = 3;

/**
 * Plan for `driveH` hours of driving, starting rested.
 * Returns { segments: [{ type: 'drive'|'break'|'rest', h, startH, endH, driveDoneH }], totalH, breaks, rests }.
 */
export function drivingPlan(driveH) {
  const segments = [];
  let t = 0;
  let left = Math.max(0, driveH);
  let sinceRest = 0;
  let sinceBreak = 0;
  let done = 0;
  const push = (type, h) => {
    segments.push({ type, h: round(h), startH: round(t), endH: round(t + h), driveDoneH: round(done) });
    t += h;
  };
  while (left > 1e-9) {
    const untilBreak = HOS.breakAfterH - sinceBreak;
    const untilRest = HOS.maxDriveH - sinceRest;
    const chunk = Math.min(left, untilBreak, untilRest);
    done += chunk;
    push('drive', chunk);
    left -= chunk;
    sinceBreak += chunk;
    sinceRest += chunk;
    if (left <= 1e-9) break;
    if (sinceRest >= HOS.maxDriveH - 1e-9) {
      push('rest', HOS.restH);
      sinceRest = 0;
      sinceBreak = 0;
    } else if (sinceBreak >= HOS.breakAfterH - 1e-9) {
      push('break', HOS.breakH);
      sinceBreak = 0;
    }
  }
  return {
    segments,
    totalH: round(t),
    breaks: segments.filter((s) => s.type === 'break').length,
    rests: segments.filter((s) => s.type === 'rest').length,
  };
}

export const URGENCY = {
  levels: [
    { id: 'standard', weight: 60, margin: 0.5 },
    { id: 'important', weight: 30, margin: 0.25 },
    { id: 'urgent', weight: 10, margin: 0.1 },
  ],
  minMarginH: 1,
};

/** Urgency level of a job, picked from its id (same for everyone). */
export function urgencyOf(jobId) {
  const r = rng(hash(`urgency|${jobId}`))() * 100;
  let acc = 0;
  for (const l of URGENCY.levels) {
    acc += l.weight;
    if (r < acc) return l.id;
  }
  return 'standard';
}

/** Time allowed to deliver, in hours: planned time plus the urgency margin, rounded up to 15 min. */
export function timeAllowedH(plannedH, urgency) {
  const level = URGENCY.levels.find((l) => l.id === urgency) ?? URGENCY.levels[0];
  const h = plannedH + Math.max(URGENCY.minMarginH, plannedH * level.margin);
  return Math.ceil(h * 4) / 4;
}

/** Real minutes for a number of in-game hours. */
export function realMinutes(gameH) {
  return Math.round(gameH * REAL_MINUTES_PER_GAME_HOUR);
}

function round(x) {
  return Math.round(x * 100) / 100;
}
