// Minimum transit time under Reg. (EC) 561/2006, SIMPLIFIED (phase 1B):
// one driver, a 45-minute break after every 4 h 30 min of driving, a regular 11-hour daily rest
// after 9 h of driving in a day. Conservative: no 10-hour extension, no reduced rest, no split breaks.
// The full plan (extensions, reduced rests, weekend bans per country) comes in phase 6.
import { REG_561 } from "../data/regulations/driving-time.mjs";
import { computed } from "./provenance.mjs";

export function minimumTransit(drivingMin, rules = REG_561) {
  const driving = Math.max(0, Math.round(drivingMin));
  const segments = [];
  let remaining = driving, total = 0, dayDriving = 0, sinceBreak = 0, breaks = 0, dailyRests = 0;
  while (remaining > 0) {
    const chunk = Math.min(remaining, rules.drivingBeforeBreakMin - sinceBreak, rules.maxDailyDrivingMin - dayDriving);
    segments.push({ type: "drive", min: chunk });
    total += chunk; remaining -= chunk; dayDriving += chunk; sinceBreak += chunk;
    if (remaining <= 0) break;
    if (dayDriving >= rules.maxDailyDrivingMin) {
      segments.push({ type: "dailyRest", min: rules.regularDailyRestMin });
      total += rules.regularDailyRestMin; dayDriving = 0; sinceBreak = 0; dailyRests += 1;
    } else if (sinceBreak >= rules.drivingBeforeBreakMin) {
      segments.push({ type: "break", min: rules.breakMin });
      total += rules.breakMin; sinceBreak = 0; breaks += 1;
    }
  }
  return { drivingMin: driving, totalMin: total, breaks, dailyRests, segments, exceedsWeeklyLimit: driving > rules.weeklyDrivingMaxMin };
}

export function transitFact(drivingSeconds, rules = REG_561) {
  const result = minimumTransit(drivingSeconds / 60, rules);
  return computed(result, "minimumTransit", {
    drivingMin: result.drivingMin,
    drivingBeforeBreakMin: rules.drivingBeforeBreakMin,
    breakMin: rules.breakMin,
    maxDailyDrivingMin: rules.maxDailyDrivingMin,
    regularDailyRestMin: rules.regularDailyRestMin,
  }, { regulation: rules.source });
}
