// Estimated day-by-day schedule of a load, built ONLY from facts already in the Load:
// the loading window and the minimum-transit segments (src/engine/transit-time.mjs).
// Assumption (stated in the UI): the truck leaves when the loading window ends and drives
// the transit segments back to back. Intermediate events carry the origin's time zone (the
// zone of the departure); arrival and unloading carry the destination's.
import { computed } from "./provenance.mjs";

const iso = ms => new Date(ms).toISOString();

export function buildSchedule(load) {
  const loading = load.timeWindows.loading.value;
  const unloading = load.timeWindows.unloading.value;
  const transit = load.transit.value;
  const originZone = loading.timeZone;
  const destinationZone = unloading.timeZone;

  const events = [
    { type: "loading", from: loading.from, to: loading.to, timeZone: originZone },
    { type: "depart", at: loading.to, timeZone: originZone },
  ];
  let cursor = Date.parse(loading.to);
  for (const segment of transit.segments) {
    const end = cursor + segment.min * 60000;
    events.push({ type: segment.type, from: iso(cursor), to: iso(end), min: segment.min, timeZone: originZone });
    cursor = end;
  }
  events.push({ type: "arrival", at: iso(cursor), timeZone: destinationZone });
  if (Date.parse(unloading.from) > cursor) {
    events.push({ type: "wait", from: iso(cursor), to: unloading.from, min: Math.round((Date.parse(unloading.from) - cursor) / 60000), timeZone: destinationZone });
  }
  events.push({ type: "unloading", from: unloading.from, to: unloading.to, timeZone: destinationZone });
  return { events, departAt: loading.to, arrivalAt: iso(cursor) };
}

export function scheduleFact(load) {
  const schedule = buildSchedule(load);
  const transit = load.transit.value;
  return computed(schedule, "schedule", {
    drivingMin: transit.drivingMin,
    transitMin: transit.totalMin,
    breaks: transit.breaks,
    dailyRests: transit.dailyRests,
  });
}
