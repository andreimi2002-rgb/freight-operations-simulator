// Simulated loading and unloading windows, placed after the minimum transit time.
// Local time of each city (IANA time zone from GeoNames), working days only.
import { simulated } from "./provenance.mjs";

export const WINDOW_RULES = {
  loadingDurationMin: 90,
  unloadingDurationMin: 180,
  dayStartMin: 6 * 60,
  loadingLatestStartMin: 14 * 60,
  unloadingLatestStartMin: 15 * 60,
  slotMin: 30,
  maxSlackMin: 180,
  maxExtraWorkingDays: 2,
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function localParts(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short",
  }).formatToParts(new Date(instant));
  const get = type => parts.find(part => part.type === type).value;
  return { year: +get("year"), month: +get("month"), day: +get("day"), hour: +get("hour") % 24, minute: +get("minute"), weekday: WEEKDAYS.indexOf(get("weekday")) };
}

// Minutes the zone is ahead of UTC at that instant.
export function offsetMin(instant, timeZone) {
  const p = localParts(instant, timeZone);
  const minute = Math.floor(instant / 60000) * 60000;
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - minute) / 60000);
}

// Instant (ms) of a local wall-clock time in a zone.
export function fromLocal({ year, month, day, minutes }, timeZone) {
  const wall = Date.UTC(year, month - 1, day, 0, minutes);
  let guess = wall;
  for (let i = 0; i < 3; i += 1) guess = wall - offsetMin(guess, timeZone) * 60000;
  return guess;
}

const addDays = ({ year, month, day }, n) => {
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: d.getUTCDay() };
};
const isWeekend = date => date.weekday === 0 || date.weekday === 6;
const nextWorkingDay = date => { let d = addDays(date, 1); while (isWeekend(d)) d = addDays(d, 1); return d; };
const draw = (count, random) => Math.min(count - 1, Math.floor(random() * count));

export function generateWindows({ now, originTimeZone, destinationTimeZone, transitMin, random = Math.random, rules = WINDOW_RULES }) {
  const today = localParts(now.getTime(), originTimeZone);
  let day = nextWorkingDay(today);
  for (let extra = draw(rules.maxExtraWorkingDays + 1, random); extra > 0; extra -= 1) day = nextWorkingDay(day);
  const slots = (rules.loadingLatestStartMin - rules.dayStartMin) / rules.slotMin + 1;
  const loadingStart = rules.dayStartMin + rules.slotMin * draw(slots, random);
  const loadingFrom = fromLocal({ ...day, minutes: loadingStart }, originTimeZone);
  const loadingTo = loadingFrom + rules.loadingDurationMin * 60000;

  const slackMin = rules.slotMin * draw(rules.maxSlackMin / rules.slotMin + 1, random);
  const earliest = loadingTo + (transitMin + slackMin) * 60000;
  const local = localParts(earliest, destinationTimeZone);
  let date = { year: local.year, month: local.month, day: local.day, weekday: local.weekday };
  let minutes = Math.ceil((local.hour * 60 + local.minute) / rules.slotMin) * rules.slotMin;
  if (minutes < rules.dayStartMin) minutes = rules.dayStartMin;
  if (minutes > rules.unloadingLatestStartMin) { date = addDays(date, 1); minutes = rules.dayStartMin; }
  let weekendShift = false;
  while (isWeekend(date)) { date = addDays(date, 1); minutes = rules.dayStartMin; weekendShift = true; }
  const unloadingFrom = fromLocal({ ...date, minutes }, destinationTimeZone);
  const unloadingTo = unloadingFrom + rules.unloadingDurationMin * 60000;

  const iso = ms => new Date(ms).toISOString();
  return {
    loading: { from: iso(loadingFrom), to: iso(loadingTo), timeZone: originTimeZone },
    unloading: { from: iso(unloadingFrom), to: iso(unloadingTo), timeZone: destinationTimeZone },
    slackMin,
    weekendShift,
  };
}

export function windowFacts(windows) {
  return {
    loading: simulated(windows.loading, "loadingWindow"),
    unloading: simulated({ ...windows.unloading, slackMin: windows.slackMin }, "unloadingWindow"),
  };
}
