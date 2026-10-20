// Small weather icons drawn for FOS (stroke style of the app; no emoji, no external icon set).
// Keys: clear, clear-night, partly, partly-night, cloudy, fog, rain, sleet, snow, thunder.
const CLOUD = '<path d="M7 18h10.5a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.6 11.1 3.5 3.5 0 0 0 7 18z"/>';
const SMALL_CLOUD = '<path d="M9 19h8.5a3.2 3.2 0 0 0 .4-6.38A4.8 4.8 0 0 0 8.8 13.4 2.8 2.8 0 0 0 9 19z"/>';
const SUN_SMALL = '<circle cx="8" cy="8" r="3"/><path d="M8 2.5v1.2M8 12.3v1.2M2.5 8h1.2M12.3 8h1.2M4.1 4.1l.9.9M11 11l.9.9M11.9 4.1l-.9.9"/>';
const MOON_SMALL = '<path d="M11 3.5A5 5 0 1 0 13.5 10a4 4 0 0 1-2.5-6.5z"/>';
const BODIES = {
  clear: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/>',
  "clear-night": '<path d="M16 4a8 8 0 1 0 4 11.5A6.5 6.5 0 0 1 16 4z"/>',
  partly: SUN_SMALL + SMALL_CLOUD,
  "partly-night": MOON_SMALL + SMALL_CLOUD,
  cloudy: CLOUD,
  fog: '<path d="M7 12h10.5a4 4 0 0 0 .2-7.98A6 6 0 0 0 6.6 5.6 3.4 3.4 0 0 0 7 12z"/><path d="M4 15.5h16M6 18.5h12M8 21.5h8"/>',
  rain: '<path d="M7 14h10.5a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.6 7.1 3.5 3.5 0 0 0 7 14z"/><path d="M8.5 17l-1 3M12.5 17l-1 3M16.5 17l-1 3"/>',
  sleet: '<path d="M7 14h10.5a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.6 7.1 3.5 3.5 0 0 0 7 14z"/><path d="M8.5 17l-1 3M15.5 17.5v3M14 19h3"/>',
  snow: '<path d="M7 14h10.5a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.6 7.1 3.5 3.5 0 0 0 7 14z"/><path d="M8 17.5v3M6.6 19h2.8M12 17.5v3M10.6 19h2.8M16 17.5v3M14.6 19h2.8"/>',
  thunder: '<path d="M7 14h10.5a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.6 7.1 3.5 3.5 0 0 0 7 14z"/><path d="M12.5 14l-2.5 4h3l-2 4"/>',
};

export function weatherIcon(key, size = 24) {
  const body = BODIES[key] || BODIES.cloudy;
  return `<svg class="wx-ic wx-ic-${key || "unknown"}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
export const WEATHER_ICON_KEYS = Object.keys(BODIES);
