import type { Trip } from '@trucksim/core';

/** Trips made in the in-browser demo, kept in this browser only. */
const KEY = 'trucksim.demoTrips.v1';
const MAX = 30;

export function loadLocalTrips(): Trip[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Trip[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalTrip(trip: Trip): void {
  try {
    const list = [{ ...trip, path: trip.path.filter((_, i) => i % 3 === 0) }, ...loadLocalTrips()].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full or unavailable */
  }
}

export function clearLocalTrips(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
