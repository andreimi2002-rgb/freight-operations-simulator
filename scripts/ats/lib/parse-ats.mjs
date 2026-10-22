// Parsers for Truck Simulator Wiki pages about American Truck Simulator.
// Each takes page wikitext and returns plain data; nothing here touches the
// network, so every rule is covered by tests/ats-parse.test.mjs.

import {
  findTemplates, strip, linkTargets, getSection, currentTab, listItems,
  parseTables, splitTopLevel, slug, normTitle,
} from './wikitext.mjs';

const ATSDATA_PARAM = /\{\{\s*ATSData\s*\|\s*([^}|]+?)\s*\}\}/i;

function infobox(text, nameRe) {
  return findTemplates(text, nameRe)[0]?.params ?? null;
}

/** "{{ATSData|CA city}}" → "CA". */
export function stateCode(value) {
  const m = String(value ?? '').match(ATSDATA_PARAM);
  const code = m && m[1].match(/^([A-Z]{2}) city$/);
  return code ? code[1] : null;
}

/** DLC field of a city: "{{ATSData|BaseGame}} ({{Update|ATS|1.53}})" → { dlc: "base", addedInUpdate: "1.53" }. */
export function cityDlc(value) {
  const raw = String(value ?? '');
  const m = raw.match(ATSDATA_PARAM);
  const name = m ? m[1] : strip(raw.replace(/\(.*\)/, ''));
  const dlc = /^base\s*game$/i.test(name) ? 'base' : (name ? slug(name) : null);
  const upd = raw.match(/\{\{\s*Update\s*\|\s*ATS\s*\|\s*([\d.]+)/i);
  return { dlc, addedInUpdate: upd ? upd[1] : null };
}

/** Facility templates in the "features" field: {{Garage|ATS}} → "garage"; {{Dealer|Mack|ATS}} → dealer "Mack". */
export function cityFeatures(value) {
  const facilities = new Set();
  const dealers = new Set();
  for (const tpl of findTemplates(String(value ?? ''), /.*/)) {
    const name = tpl.name.trim();
    if (/^dealer$/i.test(name)) {
      facilities.add('dealer');
      if (tpl.params[1]) dealers.add(strip(tpl.params[1]));
    } else if (/^[A-Za-z]+$/.test(name)) {
      facilities.add(name.toLowerCase());
    }
  }
  return { facilities: [...facilities].sort(), dealers: [...dealers] };
}

/** Roads in the infobox "connections" field. */
export function cityRoads(value) {
  const items = listItems(value);
  const raw = items.length ? items : splitTopLevel(String(value ?? ''), ',');
  return raw.map((s) => strip(s)).filter(Boolean);
}

/**
 * Parse a city page. Returns the city fields plus the raw lists needed for
 * cross-checks (`depotLinks`, `connectionLinks`) and parse `notes`.
 */
export function parseCityPage(title, text) {
  const notes = [];
  const box = infobox(text, /^Infobox[ _]location$/i);
  if (!box) return { title, notes: ['no Infobox location'] };
  const name = strip(box.title) || title.replace(/\s*\(.*\)$/, '');
  const { dlc, addedInUpdate } = cityDlc(box.dlc);
  const features = cityFeatures(box.features);
  const dealerField = strip(box.truckdealer).split(/\s*[,/]\s*|\s{2,}/).filter(Boolean);
  const companyCount = /^\d+$/.test(String(box.companies ?? '').trim()) ? Number(box.companies) : null;

  const featuresSection = getSection(text, 'Features', 2) ?? text;
  const current = currentTab(featuresSection);
  if (current.name && /^before/i.test(current.name)) notes.push(`first Features tab is "${current.name}"`);
  const depots = getSection(current.content, 'Depots', 3) ?? '';
  const facilitiesText = getSection(current.content, 'Facilities', 3) ?? '';
  const landmarksText = getSection(current.content, 'Landmarks', 3) ?? '';

  const connSection = getSection(text, 'Connections', 2) ?? '';
  const conn = currentTab(connSection);
  if (conn.name && /^before/i.test(conn.name)) notes.push(`first Connections tab is "${conn.name}"`);

  return {
    title,
    name,
    state: stateCode(box.state),
    dlc,
    addedInUpdate,
    accessible: strip(box.accessible) || null,
    timezoneGame: strip(box.timezone) || null,
    companyCount,
    truckDealers: [...new Set([...features.dealers, ...dealerField])],
    facilities: features.facilities,
    roads: cityRoads(box.connections),
    facilityDetails: listItems(facilitiesText).map(strip).filter(Boolean),
    landmarks: listItems(landmarksText).map(strip).filter(Boolean),
    depotLinks: [...new Set(linkTargets(depots))],
    connectionLinks: [...new Set(linkTargets(conn.content))],
    featuresTab: current.name,
    notes,
  };
}

/** Lists in a cargo cell, split by "With … DLC:" headings. */
export function cargoLists(cellText) {
  const base = [];
  const dlc = {};
  let current = base;
  for (const line of String(cellText ?? '').split('\n')) {
    const heading = strip(line).match(/^With (.+?) DLC:?$/i);
    if (heading) {
      dlc[heading[1]] = dlc[heading[1]] ?? [];
      current = dlc[heading[1]];
      continue;
    }
    const item = line.match(/^\s*\*+\s*(.*)$/);
    if (item) {
      const name = strip(item[1]);
      if (name) current.push(name);
    }
  }
  return { base, dlc };
}

/** Header cell of a Locations table: "Warehouse<!-- apa_car_whs -->" → { type, gameIds }. */
export function depotHeader(cellText) {
  const ids = [];
  for (const m of String(cellText).matchAll(/<!--([\s\S]*?)-->/g)) {
    for (const id of m[1].split(/[\s,;/]+/)) if (/^[a-z0-9_]+$/.test(id)) ids.push(id);
  }
  return { type: strip(cellText), gameIds: ids };
}

/**
 * Parse a company page: infobox, the Locations table (depot types with their
 * cities per state) and the cargo table (accepted/provided per depot type).
 */
export function parseCompanyPage(title, text) {
  const notes = [];
  const box = infobox(text, /^Infobox[ _]Company$/i);
  if (!box) return { title, notes: ['no Infobox Company'] };
  if (findTemplates(text, /^Removed$/i).some((t) => /^ats$/i.test(t.params[1] ?? ''))) {
    return { title, name: pageName(title), removed: true, depotTypes: [], defIds: [], notes: [] };
  }
  const catMatch = String(box.category ?? '').match(ATSDATA_PARAM);
  const defIds = String(box.def ?? '').split(/[\s,;/]+|<br\s*\/?>/i).filter((s) => /^[a-z0-9_]+$/.test(s));

  const ops = getSection(text, 'Operations', 2) ?? text;
  const opTabs = splitTabs(ops);
  const locText = opTabs.find((t) => /^locations?$/i.test(t.name))?.content ?? ops;
  const cargoText = opTabs.find((t) => /cargo/i.test(t.name))?.content ?? '';

  const depotTypes = [];
  if (/\bno\b[^.\n]{0,60}\bdepots? remaining\b/i.test(locText)) {
    notes.push('wiki says no depots remain in the game; Locations table is historical and ignored');
  } else {
    for (const chunk of headingChunks(locText)) {
      for (const tb of parseTables(chunk.content)) {
        if (!(tb[0]?.[0]?.header && /^state$/i.test(strip(tb[0][0].text)))) continue;
        depotTypes.push(...parseLocationTable(tb, chunk.heading));
      }
    }
    if (!depotTypes.length) notes.push('no Locations table');
  }

  // Cargo: either "!Accepted !Provided" (one depot type) or groups with colspan=2.
  const cargoTables = parseTables(cargoText);
  const groups = [];
  for (const tb of cargoTables) {
    let current = [];
    for (const row of tb) {
      if (row.every((c) => c.header)) {
        const labels = row.map((c) => strip(c.text));
        if (labels.length <= 2 && labels.every((l) => /^(accepted|provided)$/i.test(l))) {
          current = [{ type: null, sides: labels.map((l) => l.toLowerCase()) }];
        } else {
          current = row.map((c) => ({ type: strip(c.text) }));
        }
        continue;
      }
      const labels = row.map((c) => strip(c.text));
      if (labels.every((l) => /^(accepted|provided)$/i.test(l))) continue;
      // Data row: (accepted, provided) cells per group, or the sides named
      // in a plain "!Accepted" / "!Provided" header.
      current.forEach((g, gi) => {
        if (g.sides) {
          const get = (side) => row[g.sides.indexOf(side)];
          groups.push({ type: null, accepts: cargoLists(get('accepted')?.text), provides: cargoLists(get('provided')?.text) });
          return;
        }
        const acc = row[gi * 2];
        const pro = row[gi * 2 + 1];
        if (!acc && !pro) return;
        groups.push({ type: g.type, accepts: cargoLists(acc?.text), provides: cargoLists(pro?.text) });
      });
    }
  }
  if (!groups.length) notes.push('no cargo table');

  for (const g of groups) {
    let target = null;
    if (g.type === null && depotTypes.length === 1) target = depotTypes[0];
    else if (g.type !== null) target = matchDepotType(depotTypes, g.type);
    if (!target && g.type === null && depotTypes.length > 1) {
      // One shared cargo table for several depot types: applies to all of them.
      depotTypes.forEach((d) => { d.cargo = d.cargo ?? { accepts: g.accepts, provides: g.provides, shared: true }; });
      notes.push('one cargo table shared by several depot types');
      continue;
    }
    if (!target) { notes.push(`cargo group "${g.type}" has no matching depot type`); continue; }
    target.cargo = { accepts: g.accepts, provides: g.provides };
  }

  return {
    title,
    name: pageName(title),
    fullName: strip(box.title) || null,
    category: catMatch ? catMatch[1] : (strip(box.category) || null),
    industry: strip(box.industry) || null,
    defIds,
    depotTypes,
    notes,
  };
}

/** Display name from a page title: "AI Automotive/American Truck Simulator" → "AI Automotive", "Phoenix (company)" → "Phoenix". */
export function pageName(title) {
  return title.replace(/\/American Truck Simulator$/i, '').replace(/\s*\([^)]*\)$/, '').trim();
}

/** All tabs of the first tabber (unlike currentTab, which keeps only the first). */
function splitTabs(text) {
  const open = text.search(/<tabber[^>]*>/i);
  if (open === -1) return [];
  const body = text.slice(text.indexOf('>', open) + 1, text.indexOf('</tabber>', open));
  return body.split(/\n?\|-\|\n?/).map((chunk) => {
    const m = chunk.match(/^\s*([^=\n]+?)\s*=\s*\n?([\s\S]*)$/);
    return m ? { name: m[1].trim(), content: m[2] } : { name: '', content: chunk };
  });
}

/** Split text at level-3+ headings: [{ heading, content }] (heading null before the first). */
export function headingChunks(text) {
  const out = [];
  let heading = null;
  let buf = [];
  for (const line of String(text ?? '').split('\n')) {
    const h = line.match(/^(={3,6})\s*(.*?)\s*\1\s*$/);
    if (h) {
      out.push({ heading, content: buf.join('\n') });
      heading = strip(h[2]);
      buf = [];
    } else {
      buf.push(line);
    }
  }
  out.push({ heading, content: buf.join('\n') });
  return out;
}

/**
 * One Locations table → depot types. Two layouts exist:
 *  - one column per depot type, each cell a list of cities;
 *  - gas stations: a "City<!-- id -->" column (one city per row) and a
 *    "Location" column describing where the station is.
 * State cells may span several rows (rowspan).
 */
export function parseLocationTable(table, heading) {
  const header = table[0].slice(1);
  const cols = header.map((c) => ({ ...depotHeader(c.text) }));
  const locationCol = cols.findIndex((c) => /^location$/i.test(c.type) && c.gameIds.length === 0);
  const types = [];
  const typeIndex = [];
  cols.forEach((c, i) => {
    if (i === locationCol) { typeIndex.push(-1); return; }
    let type = c.type;
    if (/^city$/i.test(type)) type = heading && !/regular/i.test(heading) ? heading.replace(/s$/i, '') : null;
    typeIndex.push(types.length);
    types.push({ type, gameIds: c.gameIds, citiesByState: {}, locations: {}, cargo: null });
  });
  let state = null;
  let stateLeft = 0;
  for (const row of table.slice(1)) {
    let cells = row;
    if (stateLeft > 0 && row.length < table[0].length) {
      stateLeft--;
    } else {
      const links = linkTargets(row[0]?.text ?? '');
      state = links[links.length - 1] ?? strip(row[0]?.text ?? '');
      stateLeft = (row[0]?.rowspan ?? 1) - 1;
      cells = row.slice(1);
    }
    cells.forEach((cell, i) => {
      const ti = typeIndex[i];
      if (ti === undefined || ti === -1) return;
      const cities = linkTargets(cell.text);
      if (!cities.length) return;
      const list = types[ti].citiesByState[state] ?? [];
      list.push(...cities);
      types[ti].citiesByState[state] = list;
      if (locationCol !== -1 && cities.length === 1 && cells[locationCol]) {
        const loc = strip(cells[locationCol].text);
        if (loc) types[ti].locations[cities[0]] = loc;
      }
    });
  }
  return types;
}

/** Match a cargo-table group name to a depot type: exact, then a unique containment match. */
export function matchDepotType(depotTypes, groupName) {
  const g = String(groupName).toLowerCase().replace(/s$/, '');
  const norm = (t) => String(t ?? '').toLowerCase().replace(/s$/, '');
  const exact = depotTypes.filter((d) => norm(d.type) === g);
  if (exact.length === 1) return exact[0];
  const contains = depotTypes.filter((d) => d.type && (norm(d.type).includes(g) || g.includes(norm(d.type))));
  return contains.length === 1 ? contains[0] : null;
}

/** "17,114–46,209" → { min, max }; "66,138" → min = max; "???" → null. */
export function parseWeight(text) {
  const s = strip(text).replace(/,/g, '');
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(?:[–—-]\s*(\d+(?:\.\d+)?))?$/);
  if (!m) return null;
  const min = Number(m[1]);
  const max = m[2] ? Number(m[2]) : min;
  return { min, max };
}

export function parseNumber(text) {
  const s = strip(text).replace(/,/g, '');
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

/**
 * Value cell of the cargo list. Usually one number; sometimes a range
 * ("0.18–0.225") or a second value for another trailer kind, explained in a
 * footnote ("0.77<br>0.864<ref>…Tank Trailers</ref>").
 */
export function parseValue(cellText) {
  const raw = String(cellText ?? '');
  const refs = [...raw.matchAll(/<ref[^>]*>([\s\S]*?)<\/ref>/gi)].map((m) => strip(m[1]));
  const lines = raw.replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '').split(/<br\s*\/?>/i).map((s) => strip(s)).filter(Boolean);
  if (lines.length === 1) {
    const range = lines[0].replace(/,/g, '').match(/^(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)$/);
    if (range) return { value: null, range: { min: Number(range[1]), max: Number(range[2]) }, alt: [] };
  }
  const nums = lines.map((l) => parseNumber(l));
  if (!nums.length || nums.some((n) => n == null)) return { value: null, range: null, alt: [] };
  return {
    value: nums[0],
    range: null,
    alt: nums.slice(1).map((v, i) => ({ value: v, note: refs[i] ?? null })),
  };
}

/**
 * "DLC/Patch" cell of the cargo list. `cargoDlcs` is the set of cargo DLC
 * names from the page summary: a plain link to one of them is a cargo DLC,
 * any other plain link is a map DLC (a state).
 */
export function introducedWith(cellText, cargoDlcs = new Set()) {
  const raw = String(cellText ?? '').trim();
  if (/^launch\b/i.test(strip(raw))) return { kind: 'launch', name: null };
  const upd = raw.match(/\{\{\s*Update\s*\|\s*ATS\s*\|\s*([\d.]+)/i);
  if (upd) return { kind: 'update', name: upd[1] };
  const ats = findTemplates(raw, /^ATS$/i)[0];
  if (ats) return { kind: 'dlc', name: strip(ats.params[1]) };
  const link = raw.match(/\[\[([^\]|#]+)/);
  if (link) {
    const name = link[1].trim();
    return cargoDlcs.has(name) ? { kind: 'dlc', name } : { kind: 'map', name };
  }
  return { kind: 'unknown', name: strip(raw) || null };
}

/** Counts stated in the cargo list summary: base cargoes, each cargo DLC, total. */
export function cargoSummary(text) {
  const section = getSection(text, 'Summary', 2) ?? '';
  const dlc = {};
  const re = /(\d+) cargoes in the (?:\{\{\s*ATS\s*\|\s*([^}|]+?)\s*(?:\|[^}]*)?\}\}|\[\[([^\]|]+?)(?:\|[^\]]*)?\]\])/g;
  for (const m of section.matchAll(re)) dlc[(m[2] ?? m[3]).trim()] = Number(m[1]);
  const base = section.match(/(\d+) different base cargoes/);
  const total = section.match(/total of (\d+) cargoes/);
  const asOf = section.match(/As of \{\{\s*Update\s*\|\s*ATS\s*\|\s*([\d.]+)/i);
  return { asOfUpdate: asOf ? asOf[1] : null, base: base ? Number(base[1]) : null, total: total ? Number(total[1]) : null, dlc };
}

const SKILL_ICONS = [
  [/heavy/i, 'heavy'],
  [/high\s*-?\s*value|highvalue/i, 'high-value'],
  [/fragile/i, 'fragile'],
  [/adr|hazard/i, 'adr'],
  [/urgent/i, 'urgent'],
];

/** Skill icons in a cell → flags; unknown icon file names are returned separately. */
export function skillFlags(cellText) {
  const flags = new Set();
  const unknown = [];
  const hazmatClasses = new Set();
  for (const m of String(cellText ?? '').matchAll(/\[\[(?:File|Image):([^|\]]+)/gi)) {
    const hit = SKILL_ICONS.find(([re]) => re.test(m[1]));
    if (hit) flags.add(hit[1]);
    else unknown.push(m[1].trim());
    if (/adr/i.test(m[1])) {
      // Exact class from the icon caption ("HazMat Class 1.5D"), else the icon digit.
      const full = String(cellText).slice(m.index).match(/^\[\[[^\]]*?HazMat Class ([\d.]+[A-Z]?)/i);
      const icon = m[1].match(/adr[ _-]?(\d)/i);
      if (full) hazmatClasses.add(full[1]);
      else if (icon) hazmatClasses.add(icon[1]);
    }
  }
  for (const tpl of findTemplates(String(cellText ?? ''), /^Skills$/i)) {
    for (const v of Object.values(tpl.params)) {
      const hit = SKILL_ICONS.find(([re]) => re.test(v));
      if (hit) flags.add(hit[1]);
      else unknown.push(v);
    }
  }
  return { flags: [...flags].sort(), unknown, hazmatClasses: [...hazmatClasses].sort() };
}

/**
 * UN/NA number cell. "–" → none. "1203" → un. "2059**<br><small>1035</small>"
 * → un 2059 (shown in game, flagged by the wiki) and unExpected 1035. Anything
 * that is not a four-digit number is returned as `raw` with un = null.
 */
export function parseUn(cellText) {
  const raw = String(cellText ?? '').replace(/<\/?nowiki>/gi, '');
  const s = strip(raw);
  if (!s || /^[–—-]+$/.test(s) || /^n\/?a$/i.test(s)) return { un: null, unExpected: null, flagged: false, raw: null };
  const parts = raw.split(/<br\s*\/?>/i).map((p) => strip(p).replace(/\*+/g, '').trim()).filter(Boolean);
  const flagged = raw.includes('*');
  const four = (x) => (/^\d{4}$/.test(x ?? '') ? x : null);
  const un = four(parts[0]);
  return { un, unExpected: four(parts[1]), flagged, raw: un ? null : s };
}

/** Rows of the "Cargo types/American Truck Simulator" list. */
export function parseCargoList(text) {
  const table = parseTables(text).find((tb) => {
    const head = (tb[0] ?? []).map((c) => strip(c.text).toLowerCase());
    return /^cargo/.test(head[0] ?? '') && head.some((h) => h.startsWith('weight'));
  });
  const summary = cargoSummary(text);
  const cargoDlcs = new Set(Object.keys(summary.dlc));
  if (!table) return { rows: [], summary, notes: ['cargo table not found'] };
  const head = table[0].map((c) => strip(c.text).toLowerCase());
  const col = (re) => head.findIndex((h) => re.test(h));
  const idx = {
    name: col(/^cargo/), dlc: col(/dlc|patch/), weight: col(/weight/), value: col(/value/),
    un: col(/un|na number/), dynamic: col(/dynamic/), skills: col(/skill/), trailers: col(/trailer/),
  };
  const rows = [];
  for (const row of table.slice(1)) {
    if (row.every((c) => c.header) || row.length < 5) continue;
    const cell = (k) => row[idx[k]]?.text ?? '';
    const un = parseUn(cell('un'));
    const skills = skillFlags(cell('skills'));
    const value = parseValue(cell('value'));
    rows.push({
      name: strip(cell('name')),
      introducedWith: introducedWith(cell('dlc'), cargoDlcs),
      weightLb: parseWeight(cell('weight')),
      weightRaw: strip(cell('weight')),
      valuePerKm: value.value,
      valuePerKmRange: value.range,
      valuePerKmAlt: value.alt,
      valueRaw: strip(cell('value')),
      un: un.un,
      unExpected: un.unExpected,
      unFlagged: un.flagged,
      unRaw: un.raw,
      dynamicLoading: /^yes/i.test(strip(cell('dynamic'))) ? true : /^no/i.test(strip(cell('dynamic'))) ? false : null,
      flags: skills.flags,
      hazmatClasses: skills.hazmatClasses,
      unknownSkillIcons: skills.unknown,
      trailerTypes: listItems(cell('trailers')).map(strip).filter(Boolean),
    });
  }
  return { rows, summary, notes: [] };
}

/** A trailer type page ({{Infobox_Trailer}}). */
export function parseTrailerPage(title, text) {
  const box = infobox(text, /^Infobox[ _]Trailer$/i);
  if (!box) return { title, notes: ['no Infobox Trailer'] };
  // "$41,380" → one price; "$30,700 / $61,360" → two prices without a stated meaning.
  const prices = [...String(box.price ?? '').matchAll(/\$\s*([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, '')));
  const price = prices.length === 1 ? prices[0] : null;
  const art = strip(box.articulated);
  const cargo = [];
  for (const m of String(box.cargo ?? '').matchAll(/\[\[(?:File|Image):[^\]]*?\|([^|\]]+)\]\]/gi)) {
    const label = m[1].trim();
    if (!/^\d+px$/i.test(label)) cargo.push(label);
  }
  return {
    title,
    name: strip(box.title) || normTitle(title.replace(/\/.*$/, '')),
    priceUsd: price,
    pricesUsd: prices,
    ownable: /^y/i.test(strip(box.own)) ? true : /^n/i.test(strip(box.own)) ? false : null,
    articulated: /^yes/i.test(art) ? true : /^no/i.test(art) ? false : null,
    articulatedNote: art || null,
    cargoTypesNote: strip(box.ct) || null,
    cargo,
    notes: [],
  };
}

/**
 * One engine entry → { name, hpMin, hpMax }. Two layouts exist on the wiki:
 * "Mack MP8, 415–505 hp (309–377 kW)" and a bare range "370 hp (276 kW) – 625 hp (466 kW)".
 */
export function parseEngine(item) {
  const text = strip(item).replace(/\u00a0/g, ' ');
  const name = text.includes(',') ? text.split(',')[0].trim() : null;
  const hp = [];
  for (const m of text.matchAll(/(\d{3})\s*(?:[–—-]\s*(\d{3}))?\s*hp/gi)) {
    hp.push(Number(m[1]));
    if (m[2]) hp.push(Number(m[2]));
  }
  return { name, hpMin: hp.length ? Math.min(...hp) : null, hpMax: hp.length ? Math.max(...hp) : null };
}

/** A truck page ({{Infobox_Truck}}). Future (announced, not released) trucks are flagged. */
export function parseTruckPage(title, text) {
  const box = infobox(text, /^Infobox[ _]Truck$/i);
  if (!box) return { title, notes: ['no Infobox Truck'] };
  const items = listItems(box.engine);
  const engines = (items.length ? items : [box.engine ?? ""]).map(parseEngine).filter((e) => e.name || e.hpMax != null);
  const hp = engines.map((e) => e.hpMax).filter(Number.isFinite);
  return {
    title,
    name: strip(box.title1) || title,
    manufacturer: strip(box.manufacturer) || null,
    engines,
    maxHp: hp.length ? Math.max(...hp) : null,
    minHp: engines.map((e) => e.hpMin).filter(Number.isFinite).reduce((a, b) => Math.min(a, b), Infinity),
    transmissions: listItems(box.transmission).map(strip).filter(Boolean),
    bodyStyles: listItems(box.body_style).map(strip).filter(Boolean),
    availability: strip(box.availability) || null,
    dateAdded: strip(box.date_added) || null,
    future: findTemplates(text, /^Future$/i).some((t) => /^ats$/i.test(t.params[1] ?? '')) || !engines.length,
    electric: /\[\[Category:Electric Trucks/i.test(text),
    notes: [],
  };
}
