import * as f from './format.ts';
import type { nearbyCity, UpcomingTurn } from './regional-map.ts';
import type { Snapshot, Trip } from './types.ts';
import { fold, type WikiIndex } from './wiki.ts';

/**
 * AI Co-Driver tools. The same tool functions back the Claude-powered
 * copilot (bridge) and the local rule-based copilot (works offline,
 * in the browser too). Tools only read data; nothing here can drive
 * the truck or change the game.
 */

export const STALE_AFTER_MS = 3000;

export interface CopilotContext {
  snapshot: Snapshot | null;
  /** Current wall-clock time, to judge staleness. */
  now: number;
  trips: (limit: number) => Trip[] | Promise<Trip[]>;
  wiki: WikiIndex | null;
  location?: () => ReturnType<typeof nearbyCity>;
  nextTurn?: () => UpcomingTurn | null;
}

export type ToolName =
  | 'get_truck_status'
  | 'get_navigation_status'
  | 'get_job'
  | 'get_game_time'
  | 'list_trips'
  | 'search_wiki'
  | 'get_location'
  | 'get_next_maneuver';

export interface ToolSpec {
  name: ToolName;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: false;
  };
}

const noInput = { type: 'object' as const, properties: {}, required: [], additionalProperties: false as const };

export const TOOL_SPECS: ToolSpec[] = [
  {
    name: 'get_truck_status',
    description:
      'Current truck state from live telemetry: speed, cruise control, fuel and range, AdBlue, damage/wear, warnings, engine. Values that are unavailable are null.',
    input_schema: noInput,
  },
  {
    name: 'get_navigation_status',
    description:
      'Distance and time left on the in-game GPS route, the estimated arrival in game time, and the current speed limit. Comes from the game GPS, not from our own routing.',
    input_schema: noInput,
  },
  {
    name: 'get_job',
    description:
      'The active delivery job: cargo, mass, source and destination city/company, payment, deadline (game time) and time left until it.',
    input_schema: noInput,
  },
  {
    name: 'get_game_time',
    description: 'In-game day and time, and the in-game time left until the driver must rest.',
    input_schema: noInput,
  },
  {
    name: 'list_trips',
    description: 'Most recent finished trips from the local career log, newest first.',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 20, description: 'How many trips (default 5).' } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'search_wiki',
    description:
      'Search the encyclopedia of the game being played (cities, companies with their depots and cargo, cargo types; from the installed game files, plus Truck Simulator Wiki details for ATS). Returns matching entries with facts.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Name or keywords, e.g. "Oakland" or "Walbert".' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_location',
    description: 'Estimate the nearest mapped in-game city and country from the truck position. Use when asked where the player is now or about the real-world counterpart. Distance is in game map coordinates.',
    input_schema: noInput,
  },
  {
    name: 'get_next_maneuver',
    description:
      'Next left or right turn inferred from the app-calculated route. This tool does not supply a lane, exit number, road sign or the official game GPS maneuver.',
    input_schema: noInput,
  },
];

interface Freshness {
  live: boolean;
  source: Snapshot['source'] | null;
  ageSeconds: number | null;
  note?: string;
}

function freshness(ctx: CopilotContext): Freshness {
  const s = ctx.snapshot;
  if (!s) return { live: false, source: null, ageSeconds: null, note: 'Nu există date de telemetrie.' };
  const age = (ctx.now - s.ts) / 1000;
  if (!s.sdkActive) return { live: false, source: s.source, ageSeconds: age, note: 'Jocul nu rulează sau pluginul nu trimite date.' };
  if (age * 1000 > STALE_AFTER_MS) return { live: false, source: s.source, ageSeconds: age, note: 'Datele sunt vechi (conexiune pierdută).' };
  return { live: true, source: s.source, ageSeconds: Math.round(age * 10) / 10 };
}

function round(v: number | null, d = 0): number | null {
  if (v === null) return null;
  const k = 10 ** d;
  return Math.round(v * k) / k;
}

export async function runTool(name: string, input: Record<string, unknown>, ctx: CopilotContext): Promise<unknown> {
  const s = ctx.snapshot;
  const fr = freshness(ctx);
  switch (name as ToolName) {
    case 'get_truck_status': {
      if (!s || !fr.live) return { available: false, ...fr };
      const t = s.truck;
      return {
        available: true, ...fr, game: s.game.id,
        truck: [t.brand, t.name].filter(Boolean).join(' ') || null,
        speedKmh: round(t.speedKmh), cruiseControl: t.cruiseControlOn ? round(t.cruiseControlKmh) : 'off',
        fuelLitres: round(t.fuelL), fuelCapacityLitres: round(t.fuelCapacityL),
        fuelPercent: t.fuelL !== null && t.fuelCapacityL ? round((t.fuelL / t.fuelCapacityL) * 100) : null,
        fuelRangeKm: round(t.fuelRangeKm), avgConsumptionLPer100km: t.fuelAvgLPerKm !== null ? round(t.fuelAvgLPerKm * 100, 1) : null,
        adbluePercent: t.adblueL !== null && t.adblueCapacityL ? round((t.adblueL / t.adblueCapacityL) * 100) : null,
        wearPercent: Object.fromEntries(Object.entries(t.wear).map(([k, v]) => [k, v === null ? null : round(v * 100, 1)])),
        cargoDamagePercent: s.job?.cargoDamage != null ? round(s.job.cargoDamage * 100, 1) : null,
        activeWarnings: Object.entries(t.warnings).filter(([, v]) => v).map(([k]) => k),
        engineOn: t.engineOn, parkingBrake: t.parkingBrake,
        oilTempC: round(t.oilTempC), waterTempC: round(t.waterTempC),
      };
    }
    case 'get_navigation_status': {
      if (!s || !fr.live) return { available: false, ...fr };
      const n = s.navigation;
      const eta = n.timeMin !== null && s.game.timeAbsMin !== null ? s.game.timeAbsMin + n.timeMin : null;
      return {
        available: n.distanceKm !== null, ...fr,
        provenance: 'in-game GPS (SDK navigation channels)',
        distanceLeftKm: round(n.distanceKm, 1),
        timeLeftGameMinutes: round(n.timeMin),
        etaGameTime: f.gameClock(eta),
        realMinutesLeftEstimate: n.timeMin !== null && s.game.timeScale ? round(n.timeMin / s.game.timeScale) : null,
        speedLimitKmh: round(n.speedLimitKmh),
        note: n.distanceKm === null ? 'Nu este setată nicio rută în GPS-ul jocului.' : undefined,
      };
    }
    case 'get_job': {
      if (!s || !fr.live) return { available: false, ...fr };
      const j = s.job;
      if (!j) return { available: false, ...fr, note: 'Nu există o cursă activă.' };
      const left = j.deadlineAbsMin !== null && s.game.timeAbsMin !== null ? j.deadlineAbsMin - s.game.timeAbsMin : null;
      return {
        available: true, ...fr, game: s.game.id,
        cargo: j.cargo, cargoMassKg: round(j.cargoMassKg),
        from: { city: j.sourceCity, company: j.sourceCompany, companyId: j.sourceCompanyId },
        to: { city: j.destinationCity, company: j.destinationCompany, companyId: j.destinationCompanyId },
        payment: j.income, currency: f.currency(s.game.id),
        plannedDistanceKm: j.plannedDistanceKm,
        deadlineGameTime: f.gameClock(j.deadlineAbsMin),
        gameMinutesUntilDeadline: left,
        market: j.market,
      };
    }
    case 'get_game_time': {
      if (!s || !fr.live) return { available: false, ...fr };
      return {
        available: true, ...fr, gameTime: f.gameClock(s.game.timeAbsMin),
        restStopInGameMinutes: s.game.restStopMin, paused: s.game.paused,
      };
    }
    case 'list_trips': {
      const limit = typeof input.limit === 'number' ? Math.min(20, Math.max(1, input.limit)) : 5;
      const trips = await ctx.trips(limit);
      return {
        count: trips.length,
        trips: trips.map((t) => ({
          status: t.status, game: t.gameId, endedAt: t.endedAt ? new Date(t.endedAt).toISOString() : null,
          cargo: t.cargo, from: t.sourceCity, to: t.destinationCity,
          drivenKm: round(t.drivenKm), revenue: t.revenue, xp: t.xp, fines: t.fines, tolls: t.tolls,
          cargoDamagePercent: t.cargoDamage !== null ? round(t.cargoDamage * 100, 1) : null,
          source: t.source,
        })),
      };
    }
    case 'search_wiki': {
      const q = typeof input.query === 'string' ? input.query : '';
      if (!ctx.wiki) return { available: false, note: 'Enciclopedia nu este încărcată.' };
      const hits = ctx.wiki.search(q, 5);
      return {
        available: true,
        game: ctx.wiki.data.game ?? 'ats',
        coverage: ctx.wiki.data.origin === 'game'
          ? 'Complete data from the installed game files (base game and installed DLCs).'
          : 'American Truck Simulator only (CA, NV, AZ, NM, OR, WA), from Truck Simulator Wiki.',
        attribution: ctx.wiki.data.meta.attribution,
        results: hits.map((h) => describeWiki(ctx.wiki!, h.kind, h.id)),
      };
    }
    case 'get_location': {
      const location = fr.live ? ctx.location?.() : null;
      return location ? { available: true, ...fr, ...location, approximate: true }
        : { available: false, ...fr, reason: 'Poziția nu poate fi asociată cu un oraș de pe harta disponibilă.' };
    }
    case 'get_next_maneuver': {
      const turn = fr.live ? ctx.nextTurn?.() : null;
      return turn ? { available: true, ...fr, ...turn, routeSource: 'app_calculated' }
        : { available: false, ...fr, reason: 'Nu am un viraj apropiat pe ruta calculată.' };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

function describeWiki(w: WikiIndex, kind: string, id: string): Record<string, unknown> {
  switch (kind) {
    case 'city': {
      const c = w.city(id)!;
      return {
        kind, name: c.name, state: c.state, dlc: c.dlc, population: c.population ?? null,
        companies: [...new Set((c.depots ?? []).map((d) => w.company(d.company)?.name ?? d.company))],
        facilities: c.facilities, roads: c.roads, neighbors: c.neighbors, landmarks: c.landmarks?.slice(0, 6), url: c.wiki?.url,
      };
    }
    case 'company': {
      const c = w.company(id)!;
      return {
        kind, name: c.name, industry: c.industry, gameIds: c.defIds,
        depots: c.depotTypes.map((d) => ({
          type: d.type,
          cities: d.cities.map((x) => w.city(x)?.name ?? x),
          provides: d.provides.slice(0, 15).map((x) => w.cargo(x)?.name ?? x),
          accepts: d.accepts.slice(0, 15).map((x) => w.cargo(x)?.name ?? x),
        })),
        url: c.wiki?.url,
      };
    }
    case 'cargo': {
      const c = w.cargo(id)!;
      return { kind, name: c.name, dlc: c.dlc, weightLb: c.weightLb, unitMassKg: c.unitMassKg ?? null, valuePerKm: c.valuePerKm, flags: c.flags, hazmatClass: c.hazmatClass, trailerTypes: c.trailerTypes, url: c.wiki?.url };
    }
    case 'truck': {
      const t = w.truck(id)!;
      return { kind, name: t.name, manufacturer: t.manufacturer, maxHp: t.maxHp, electric: t.electric, url: t.wiki?.url };
    }
    default: {
      const t = w.trailer(id);
      return { kind, name: t?.name, cargo: t?.cargo.slice(0, 15) };
    }
  }
}

// ---------------------------------------------------------------------------
// Local copilot: rule-based answers in Romanian, no network needed.
// ---------------------------------------------------------------------------

type Intent =
  | 'navigation' | 'fuel' | 'truck' | 'job' | 'speedLimit' | 'time' | 'rest' | 'trips' | 'wiki' | 'maneuver' | 'location' | 'help';

const INTENTS: Array<[Intent, RegExp]> = [
  ['location', /\b(unde sunt|unde suntem|unde ma aflu|locul unde sunt|locul in care sunt|orasul in care sunt)\b/],
  ['maneuver', /\b(iesire|iesirea|banda|benzi|viraj|virez|intersectie|urmatoarea manevra)\b/],
  ['trips', /\b(ieri|istoric|ultima cursa|ultimele curse|curse|cariera|castigat)\b/],
  ['rest', /\b(odihn|somn|dorm|obosit|pauza)/],
  ['fuel', /\b(motorin|combustibil|benzin|rezervor|autonomie|alimentez|plinul|carburant|diesel)/],
  ['speedLimit', /\b(limita|viteza maxima|cu cat am voie|cat am voie)\b/],
  ['navigation', /\b(cat mai avem|mai avem|distanta|cand ajung|cand ajungem|eta|cat mai e|cat mai este|kilometri|km)\b/],
  ['job', /\b(marfa|incarcatura|unde duc|destinatie|destinatia|cat primesc|plata|contract|cursa|termen|deadline|intarzi)\b/],
  ['time', /\b(ce ora|cat e ceasul|ora|ziua)\b/],
  ['truck', /\b(camion|avari|daune|stricat|motor|cum stam|uzura|stare|adblue)\b/],
  ['wiki', /\b(ce e|ce este|cine e|spune mi despre|despre|unde e|unde este|wiki|info)\b/],
  ['help', /\b(ajutor|ce stii|ce poti)\b/],
];

export function detectIntent(question: string): Intent | null {
  const q = fold(question);
  for (const [intent, re] of INTENTS) if (re.test(q)) return intent;
  return null;
}

function wikiQuery(question: string): string {
  return fold(question)
    .replace(/\b(ce e|ce este|cine e|spune mi despre|despre|unde e|unde este|wiki|info|compania|orasul|marfa|camionul)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NO_LIVE = 'Nu am date live acum';

export async function answerLocally(question: string, ctx: CopilotContext): Promise<string> {
  const intent = detectIntent(question);
  const s = ctx.snapshot;
  const fr = freshness(ctx);
  const units = f.defaultUnits(s?.game.id ?? null);
  const needsLive: Intent[] = ['navigation', 'fuel', 'truck', 'job', 'speedLimit', 'time', 'rest'];
  if (intent && needsLive.includes(intent) && (!s || !fr.live)) {
    return `${NO_LIVE}${fr.note ? ` (${fr.note.replace(/\.$/, '').toLowerCase()})` : ''}, așa că nu pot să-ți spun valori fără să le inventez.`;
  }
  const tag = s?.source === 'demo' ? ' (date demo)' : s?.source === 'replay' ? ' (din înregistrare)' : '';

  switch (intent) {
    case 'navigation': {
      const n = s!.navigation;
      if (n.distanceKm === null) return 'GPS-ul jocului nu are o rută setată, deci nu am distanța rămasă.';
      const eta = n.timeMin !== null && s!.game.timeAbsMin !== null ? f.gameClock(s!.game.timeAbsMin + n.timeMin) : null;
      const real = n.timeMin !== null && s!.game.timeScale ? n.timeMin / s!.game.timeScale : null;
      let out = `Mai avem ${f.distance(n.distanceKm, units)} după GPS-ul jocului${tag}.`;
      if (n.timeMin !== null) out += ` Estimare: ${f.duration(n.timeMin)} în timp de joc, sosire ${eta}`;
      if (real !== null) out += `, adică aproximativ ${f.duration(real)} de condus real.`;
      return out;
    }
    case 'fuel': {
      const t = s!.truck;
      if (t.fuelL === null) return 'Nivelul combustibilului nu este disponibil în telemetrie.';
      const pct = t.fuelCapacityL ? Math.round((t.fuelL / t.fuelCapacityL) * 100) : null;
      let out = `Ai ${f.volume(t.fuelL, units)}${pct !== null ? `, adică ${pct}% din rezervor` : ''}${tag}.`;
      if (t.fuelRangeKm !== null) out += ` Autonomie estimată de joc: ${f.distance(t.fuelRangeKm, units)}.`;
      const left = s!.navigation.distanceKm;
      if (t.fuelRangeKm !== null && left !== null) {
        out += t.fuelRangeKm > left * 1.15
          ? ' Ajunge până la destinație.'
          : ` Nu ajunge sigur până la destinație (mai sunt ${f.distance(left, units)}); alimentează pe drum.`;
      }
      return out;
    }
    case 'truck': {
      const t = s!.truck;
      const warnings = Object.entries(t.warnings).filter(([, v]) => v).map(([k]) => WARN_RO[k] ?? k);
      const wear = Object.entries(t.wear).filter(([, v]) => v !== null && v >= 0.05).map(([k, v]) => `${WEAR_RO[k] ?? k} ${f.percent(v)}`);
      let out = `${[t.brand, t.name].filter(Boolean).join(' ') || 'Camionul'}${tag}: ${f.speed(t.speedKmh, units)}`;
      if (t.fuelL !== null) out += `, ${f.volume(t.fuelL, units)} combustibil`;
      out += warnings.length ? `. Avertizări active: ${warnings.join(', ')}.` : '. Fără avertizări active.';
      out += wear.length ? ` Uzură peste 5%: ${wear.join(', ')}.` : ' Uzura este sub 5% peste tot.';
      if (s!.job?.cargoDamage != null) out += ` Marfa are ${f.percent(s!.job.cargoDamage, 1)} daune.`;
      return out;
    }
    case 'job': {
      const j = s!.job;
      if (!j) return `Nu ai o cursă activă${tag}.`;
      const from = [j.sourceCompany, j.sourceCity].filter(Boolean).join(', ') || 'necunoscut';
      const to = [j.destinationCompany ?? 'companie necunoscută', j.destinationCity].filter(Boolean).join(', ');
      let out = `Duci ${j.cargo ?? 'o marfă necunoscută'}${j.cargoMassKg !== null ? ` (${f.mass(j.cargoMassKg, units)})` : ''} de la ${from} la ${to}${tag}.`;
      if (j.income !== null) out += ` Plata: ${f.money(j.income, s!.game.id)}.`;
      if (j.deadlineAbsMin !== null && s!.game.timeAbsMin !== null) {
        const left = j.deadlineAbsMin - s!.game.timeAbsMin;
        out += left >= 0
          ? ` Termen: ${f.gameClock(j.deadlineAbsMin)}, mai ai ${f.duration(left)} de joc.`
          : ` Termenul (${f.gameClock(j.deadlineAbsMin)}) a trecut acum ${f.duration(-left)}.`;
      }
      return out;
    }
    case 'speedLimit': {
      const l = s!.navigation.speedLimitKmh;
      if (l === null || l <= 0) return 'Jocul nu raportează o limită de viteză pe porțiunea asta.';
      return `Limita este ${f.speed(l, units)}; mergi cu ${f.speed(s!.truck.speedKmh, units)}${tag}.`;
    }
    case 'time':
      return `În joc este ${f.gameClock(s!.game.timeAbsMin)}${tag}.`;
    case 'rest': {
      const r = s!.game.restStopMin;
      if (r === null) return 'Timpul până la odihnă nu este disponibil (poate oboseala e dezactivată).';
      return r <= 0 ? 'Trebuie să te odihnești acum.' : `Mai poți conduce ${f.duration(r)} în timp de joc până la odihnă${tag}.`;
    }
    case 'trips': {
      const trips = await ctx.trips(3);
      if (trips.length === 0) return 'Nu am nicio cursă salvată în jurnal încă.';
      const t = trips[0]!;
      const when = t.endedAt ? new Date(t.endedAt).toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' }) : '';
      const status = t.status === 'delivered' ? 'livrată' : t.status === 'cancelled' ? 'anulată' : 'neterminată';
      return `Ultima cursă (${when}, ${status}): ${t.cargo ?? 'marfă necunoscută'}, ${t.sourceCity ?? '?'} → ${t.destinationCity ?? '?'}, ${f.distance(t.drivenKm, f.defaultUnits(t.gameId))} condus${t.revenue !== null ? `, câștig ${f.money(t.revenue, t.gameId)}` : ''}${t.fines ? `, amenzi ${f.money(t.fines, t.gameId)}` : ''}. Am ${trips.length === 3 ? 'mai multe' : trips.length} curse în jurnal.`;
    }
    case 'location': {
      const location = fr.live ? ctx.location?.() : null;
      return location ? `Ești în zona orașului ${location.city}, după poziția din ETS2${tag}. Poziția față de oraș este aproximativă.`
        : 'Nu pot identifica un oraș apropiat din poziția disponibilă.';
    }
    case 'maneuver': {
      const turn = fr.live ? ctx.nextTurn?.() : null;
      return turn ? `Pe ruta calculată de aplicație, traseul virează ${turn.direction === 'left' ? 'la stânga' : 'la dreapta'} în ${turn.mapMetres} m pe hartă${tag}.`
        : 'Nu am un viraj apropiat pe ruta calculată și nu pot spune ieșiri sau benzi. Urmează indicațiile GPS-ului din joc.';
    }
    case 'wiki': {
      if (!ctx.wiki) return 'Enciclopedia nu este încărcată.';
      const q = wikiQuery(question);
      const hits = q ? ctx.wiki.search(q, 3) : [];
      if (hits.length === 0) return `Nu am găsit „${q}” în enciclopedie (pentru jocul curent).`;
      const h = hits[0]!;
      const d = describeWiki(ctx.wiki, h.kind, h.id);
      return wikiSentence(h.kind, d);
    }
    case 'help':
      return 'Pot să-ți spun cât mai ai până la destinație, cum stai cu combustibilul și camionul, detalii despre cursă, ora din joc, când trebuie să te odihnești, ultimele curse și informații din enciclopedie.';
    default:
      return 'Fără un AI conectat știu să răspund doar la întrebări despre joc (de exemplu „Cât mai avem?”, „Câtă motorină mai am?”, „Ce marfă duc?”). Pentru orice altă întrebare, adaugă o cheie AI (Gemini e gratuit) în Setări → Copilot AI.';
  }
}

const WARN_RO: Record<string, string> = {
  fuel: 'combustibil scăzut', adblue: 'AdBlue scăzut', airPressure: 'presiune aer', airPressureEmergency: 'presiune aer critică',
  oilPressure: 'presiune ulei', waterTemperature: 'temperatură apă', batteryVoltage: 'tensiune baterie',
};
const WEAR_RO: Record<string, string> = {
  engine: 'motor', transmission: 'transmisie', cabin: 'cabină', chassis: 'șasiu', wheels: 'roți',
};

function wikiSentence(kind: string, d: Record<string, unknown>): string {
  const list = (v: unknown, n = 5) => (Array.isArray(v) ? v.slice(0, n).join(', ') : '');
  switch (kind) {
    case 'city':
      return `${d.name} este un oraș în ${d.state}. Companii: ${list(d.companies, 6) || 'necunoscute'}. Drumuri: ${list(d.roads) || '—'}. Vecini: ${list(d.neighbors) || '—'}.`;
    case 'company':
      return `${d.name}: ${d.industry ?? 'companie'}. Depozite: ${(d.depots as Array<{ type: string; cities: string[] }>).map((x) => `${x.type} (${x.cities.join(', ')})`).slice(0, 3).join('; ')}.`;
    case 'cargo':
      return `${d.name} este o marfă${d.dlc ? ` din DLC` : ''}. Remorci: ${list(d.trailerTypes)}.${d.valuePerKm ? ` Valoare de bază (wiki): ${d.valuePerKm}.` : ''}`;
    case 'truck':
      return `${d.name} (${d.manufacturer}), până la ${d.maxHp ?? '?'} CP${d.electric ? ', electric' : ''}.`;
    default:
      return `${d.name}: remorcă pentru ${list(d.cargo, 6)}.`;
  }
}
