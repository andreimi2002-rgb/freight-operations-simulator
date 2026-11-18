import type { GameId } from './types.ts';

export type UnitSystem = 'metric' | 'imperial';

export const KM_PER_MILE = 1.609344;
export const L_PER_GAL = 3.785411784;
export const KG_PER_LB = 0.45359237;

export function defaultUnits(game: GameId | null): UnitSystem {
  return game === 'ats' ? 'imperial' : 'metric';
}

export function currency(game: GameId | null): 'EUR' | 'USD' {
  return game === 'ats' ? 'USD' : 'EUR';
}

const RO = 'ro-RO';

function num(v: number, digits = 0): string {
  return new Intl.NumberFormat(RO, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);
}

export function speed(kmh: number | null, units: UnitSystem): string {
  if (kmh === null) return '—';
  return units === 'imperial' ? `${num(kmh / KM_PER_MILE)} mph` : `${num(kmh)} km/h`;
}

export function speedValue(kmh: number | null, units: UnitSystem): number | null {
  if (kmh === null) return null;
  return units === 'imperial' ? kmh / KM_PER_MILE : kmh;
}

export function distance(km: number | null, units: UnitSystem): string {
  if (km === null) return '—';
  const v = units === 'imperial' ? km / KM_PER_MILE : km;
  const unit = units === 'imperial' ? 'mi' : 'km';
  if (v < 1) return units === 'imperial' ? `${num(v * 5280, 0)} ft` : `${num(km * 1000, 0)} m`;
  return `${num(v, v < 10 ? 1 : 0)} ${unit}`;
}

export function volume(l: number | null, units: UnitSystem): string {
  if (l === null) return '—';
  return units === 'imperial' ? `${num(l / L_PER_GAL)} gal` : `${num(l)} L`;
}

export function mass(kg: number | null, units: UnitSystem): string {
  if (kg === null) return '—';
  if (units === 'imperial') return `${num(kg / KG_PER_LB)} lb`;
  return kg >= 1000 ? `${num(kg / 1000, 1)} t` : `${num(kg)} kg`;
}

export function money(amount: number | null, game: GameId | null): string {
  if (amount === null) return '—';
  return new Intl.NumberFormat(RO, { style: 'currency', currency: currency(game), maximumFractionDigits: 0 }).format(amount);
}

export function percent(fraction: number | null, digits = 0): string {
  if (fraction === null) return '—';
  return `${num(fraction * 100, digits)}%`;
}

const DAYS = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

/** Game clock from absolute minutes (day 0 = Monday). */
export function gameClock(absMin: number | null): string {
  if (absMin === null) return '—';
  const m = Math.floor(absMin);
  const day = DAYS[Math.floor(m / 1440) % 7] ?? '';
  const hh = Math.floor((m % 1440) / 60).toString().padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  return `${day} ${hh}:${mm}`;
}

/** Duration in minutes as "3 h 25 min". */
export function duration(min: number | null): string {
  if (min === null) return '—';
  const sign = min < 0 ? '−' : '';
  const a = Math.abs(Math.round(min));
  const h = Math.floor(a / 60);
  const m = a % 60;
  if (h === 0) return `${sign}${m} min`;
  if (h >= 24) return `${sign}${Math.floor(h / 24)} z ${h % 24} h`;
  return `${sign}${h} h ${m.toString().padStart(2, '0')} min`;
}

/** Same as Intl, exported for UI consistency. */
export function number(v: number | null, digits = 0): string {
  return v === null ? '—' : num(v, digits);
}

export function gearLabel(gear: number | null): string {
  if (gear === null) return '—';
  if (gear === 0) return 'N';
  if (gear < 0) return `R${Math.abs(gear)}`;
  return String(gear);
}
