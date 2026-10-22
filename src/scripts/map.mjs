// Freight World map, drawn in a style close to the in-game ATS map (our own drawing, no game
// files): dark land, grey state borders, amber roads, amber city dots and labels, road shields
// when zoomed in. Every element with data-map gets one:
//   data-map="full"                  whole starting map, all cities
//   data-map="city" data-map-city=id centred on a city and its neighbours
//   data-map="route" data-map-from=id data-map-to=id   a job's route
import { buildRoadGraph, routeBetween } from '../engine/roadgraph.mjs';
import { pageText } from './units.mjs';
import { monogram } from '../lib/companies.mjs';

const NS = 'http://www.w3.org/2000/svg';
let dataPromise = null;
export const loadMap = () => (dataPromise ??= fetch('/data/ats-map.json').then((r) => { if (!r.ok) throw new Error('map'); return r.json(); }));

const svgEl = (tag, attrs = {}, parent = null) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  if (parent) parent.append(n);
  return n;
};
// Facility icons: rounded square + white glyph (24x24 box, drawn at 16 px).
const FACILITY = {
  gas: { c: '#1f9d55', d: 'M7 5h7v14H7z M14 9h2l2 2v6a1 1 0 0 1-2 0v-4h-2 M9 7h3v3H9z' },
  hotel: { c: '#2b6cd6', d: 'M5 17V8 M5 13h14v4 M19 17v-4 M8 12a2 2 0 1 0 0-.1' },
  rest: { c: '#2b6cd6', d: 'M8 18V6h5a3.5 3.5 0 0 1 0 7H8' },
  recruitment: { c: '#7a3fc4', d: 'M9 10a2.5 2.5 0 1 0 0-.1 M5 18c0-3 2-5 4-5s4 2 4 5 M16 9a2 2 0 1 0 0-.1 M14 13c3 0 5 2 5 5' },
  garage: { c: '#5f6368', d: 'M5 18V10l7-4 7 4v8 M8 18v-5h8v5' },
  service: { c: '#5f6368', d: 'M15 5a4 4 0 0 0-4 5l-6 6 3 3 6-6a4 4 0 0 0 5-4l-2 2-2-2 2-2z' },
  weigh: { c: '#5f6368', d: 'M12 5v14 M6 8h12 M6 8l-2 6h4z M18 8l-2 6h4z M8 19h8' },
  dealer: { c: '#5f6368', d: 'M4 15V9h9v6 M13 11h4l3 3v1h-7 M7 17a1.5 1.5 0 1 0 0-.1 M16 17a1.5 1.5 0 1 0 0-.1' },
  viewpoint: { c: '#5f6368', d: 'M5 9h3l1.5-2h5L16 9h3v9H5z M12 15a2.5 2.5 0 1 0 0-.1' },
  port: { c: '#1b6b8f', d: 'M12 5v12 M8 8h8 M6 13c0 3 3 5 6 5s6-2 6-5' },
  airport: { c: '#1b6b8f', d: 'M12 4v16 M4 13l8-3 8 3 M9 19l3-1 3 1' },
  toll: { c: '#5f6368', d: 'M14.5 8.5C14 7.5 13 7 12 7c-1.7 0-3 .9-3 2.2 0 2.8 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2-1.2 0-2.3-.6-2.8-1.6 M12 5v14' },
  agricheck: { c: '#2f8f3a', d: 'M6 18c0-7 5-11 12-12-1 7-5 12-12 12z M6 18l6-6' },
};
const FACILITY_ORDER = ['gas', 'rest', 'hotel', 'service', 'garage', 'dealer', 'weigh', 'recruitment', 'port', 'airport', 'toll', 'viewpoint', 'agricheck'];

const pathOf = (pts) => `M${pts.map((p) => `${p[0]},${p[1]}`).join('L')}`;
const ringsPath = (rings) => rings.map((r) => `${pathOf(r)}Z`).join('');

// Shield shapes (drawn at 1 unit = 1 screen px, scaled by the counter-scale group).
function shield(level, ref) {
  const g = svgEl('g', { class: `shield shield-${level}` });
  const w = ref.length >= 3 ? 26 : 22;
  if (level === 'I') {
    svgEl('path', { d: `M${-w / 2},-9 h${w} v6 c0,7 -6,11 -${w / 2},14 c-${w / 2 - 6},-3 -${w / 2},-7 -${w / 2},-14 z`, class: 'sh-i-body' }, g);
    svgEl('path', { d: `M${-w / 2},-9 h${w} v4 h-${w} z`, class: 'sh-i-top' }, g);
  } else if (level === 'US') {
    svgEl('path', { d: `M${-w / 2},-9 h${w} v8 c0,6 -5,9 -${w / 2},11 c-${w / 2 - 5},-2 -${w / 2},-5 -${w / 2},-11 z`, class: 'sh-us' }, g);
  } else {
    svgEl('rect', { x: -w / 2, y: -9, width: w, height: 17, rx: 3, class: 'sh-s' }, g);
  }
  const t = svgEl('text', { y: level === 'I' ? 4 : 3, class: 'sh-text' }, g);
  t.textContent = ref;
  return g;
}

/** Shield positions: one per road number roughly every 160 km of road. */
function shieldSpots(roads) {
  const spots = [];
  for (const r of roads) {
    if (!r.ref || r.level === 'O' || !/^\d{1,3}[A-Z]?$/.test(r.ref)) continue;
    let acc = 80;
    for (let i = 1; i < r.pts.length; i++) {
      const [a, b] = [r.pts[i - 1], r.pts[i]];
      acc += Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (acc >= 160) {
        acc = 0;
        const p = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (!spots.some((s) => s.ref === r.ref && Math.hypot(s.p[0] - p[0], s.p[1] - p[1]) < 120)) spots.push({ p, ref: r.ref, level: r.level });
      }
    }
  }
  return spots;
}

function boundsOf(points, pad) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
}

function render(box, data, t, opts = {}) {
  const mode = box.dataset.map;
  const cityById = new Map(data.cities.map((c) => [c.id, c]));
  const svg = svgEl('svg', { class: 'fw-map-svg', role: 'img', 'aria-label': box.dataset.mapLabel ?? '' });
  const world = svgEl('g', { class: 'world' }, svg);

  // Context land (neighbouring states) and the states in scope.
  for (const c of data.context) svgEl('path', { d: ringsPath(c.rings), class: 'land-context' }, world);
  for (const s of data.states) svgEl('path', { d: ringsPath(s.rings), class: 'land' }, world);
  for (const l of data.lakes) svgEl('path', { d: ringsPath(l.rings), class: 'water' }, world);
  for (const s of data.states) svgEl('path', { d: ringsPath(s.rings), class: 'border' }, world);

  // Roads: minor under major.
  const roadsG = svgEl('g', { class: 'roads' }, world);
  const order = { O: 0, S: 1, US: 2, I: 3 };
  [...data.roads].map((r, i) => [r, i]).sort((a, b) => order[a[0].level] - order[b[0].level]).forEach(([r]) => {
    svgEl('path', { d: pathOf(r.pts), class: `road road-${r.level}` }, roadsG);
  });

  // Route (job sheet).
  let focus = null;
  if (mode === 'route') {
    const a = cityById.get(box.dataset.mapFrom);
    const b = cityById.get(box.dataset.mapTo);
    if (a && b) {
      const route = opts.route ?? routeBetween(buildRoadGraph(data.roads), a.xy, b.xy);
      const pts = route ? route.points : [a.xy, b.xy];
      svgEl('path', { d: pathOf(pts), class: 'route-casing' }, world);
      svgEl('path', { d: pathOf(pts), class: route ? 'route' : 'route route-straight' }, world);
      focus = boundsOf(pts, 60);
    }
  } else if (mode === 'city') {
    const c = cityById.get(box.dataset.mapCity);
    if (c) focus = [c.xy[0] - 220, c.xy[1] - 160, c.xy[0] + 220, c.xy[1] + 160];
  }

  // Overlay (shields, cities, stops) is drawn in screen units and re-positioned on zoom.
  const overlay = svgEl('g', { class: 'overlay' }, svg);
  const shieldsG = svgEl('g', { class: 'shields' }, overlay);
  const spots = shieldSpots(data.roads).map((s) => ({ ...s, node: shieldsG.appendChild(shield(s.level, s.ref)) }));
  const citiesG = svgEl('g', { class: 'cities' }, overlay);
  const stopsG = svgEl('g', { class: 'stops' }, overlay);
  const stopNodes = (opts.stops ?? []).map((st) => {
    const g = svgEl('g', { class: `stop stop-${st.kind}` }, stopsG);
    svgEl('circle', { r: 9, class: 'stop-dot' }, g);
    const label = svgEl('text', { y: 4, class: 'stop-text' }, g);
    label.textContent = st.short ?? '';
    svgEl('title', {}, g).textContent = st.label ?? '';
    return { st, node: g };
  });
  const highlight = new Set([box.dataset.mapCity, box.dataset.mapFrom, box.dataset.mapTo].filter(Boolean));
  const cityNodes = data.cities.map((c) => {
    const big = c.depots >= 9;
    const link = svgEl('a', { href: `/ats/${c.state.toLowerCase()}/${c.id}`, class: `city${big ? ' city-big' : ''}${highlight.has(c.id) ? ' city-hl' : ''}` }, citiesG);
    svgEl('circle', { r: big ? 5 : 4, class: 'city-dot' }, link);
    const label = svgEl('text', { x: 8, y: -7, class: 'city-label' }, link);
    label.textContent = c.name;
    svgEl('title', {}, link).textContent = c.name;
    // Facilities: a row of icons under the name (zoomed in).
    const fac = svgEl('g', { class: 'city-facilities', transform: 'translate(8,2)' }, citiesG);
    FACILITY_ORDER.filter((f) => (c.facilities ?? []).includes(f)).forEach((f, i) => {
      const def = FACILITY[f];
      const g = svgEl('g', { transform: `translate(${i * 19},0)`, class: 'fac' }, fac);
      svgEl('rect', { width: 17, height: 17, rx: 4, fill: def.c, stroke: '#000', 'stroke-width': 1 }, g);
      svgEl('path', { d: def.d, transform: 'translate(1.5,1.5) scale(0.58)', fill: 'none', stroke: '#fff', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      svgEl('title', {}, g).textContent = t.facilities?.[f] ?? f;
    });
    // Companies: monogram chips linking to the company pages (zoomed in further).
    const cos = svgEl('g', { class: 'city-companies', transform: 'translate(8,23)' }, citiesG);
    (c.companies ?? []).forEach(([id, name], i) => {
      const a = svgEl('a', { href: `/ats/company/${id}`, class: 'co-chip', transform: `translate(${(i % 6) * 27},${Math.floor(i / 6) * 19})` }, cos);
      svgEl('rect', { width: 25, height: 17, rx: 3 }, a);
      const tx = svgEl('text', { x: 12.5, y: 12.5 }, a);
      tx.textContent = monogram(name);
      svgEl('title', {}, a).textContent = name;
    });
    return { c, node: link, big, fac, cos };
  });

  box.replaceChildren(svg);

  // ---- View (pan / zoom) ----------------------------------------------------------
  const full = data.bounds.slice();
  const initial = focus ?? [full[0] - 30, full[1] - 30, full[2] + 30, full[3] + 30];
  let view = { x: 0, y: 0, k: 1 };
  const size = () => [box.clientWidth || 600, box.clientHeight || 400];
  const fit = (b) => {
    const [w, h] = size();
    const k = Math.min(w / (b[2] - b[0]), h / (b[3] - b[1]));
    view = { k, x: w / 2 - ((b[0] + b[2]) / 2) * k, y: h / 2 - ((b[1] + b[3]) / 2) * k };
  };
  let baseK = 1;
  const apply = () => {
    const [w, h] = size();
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    world.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`);
    const zoom = view.k / baseK;
    svg.classList.toggle('zoomed', zoom >= 2.2);
    svg.classList.toggle('far', zoom < 1.4);
    svg.classList.toggle('close', zoom >= 4);
    const toScreen = ([x, y]) => [x * view.k + view.x, y * view.k + view.y];
    for (const s of spots) {
      const [sx, sy] = toScreen(s.p);
      s.node.setAttribute('transform', `translate(${sx.toFixed(1)},${sy.toFixed(1)})`);
    }
    for (const s of stopNodes) {
      const [sx, sy] = toScreen(s.st.xy);
      s.node.setAttribute('transform', `translate(${sx.toFixed(1)},${sy.toFixed(1)})`);
    }
    for (const n of cityNodes) {
      const [sx, sy] = toScreen(n.c.xy);
      n.node.setAttribute('transform', `translate(${sx.toFixed(1)},${sy.toFixed(1)})`);
      n.fac.setAttribute('transform', `translate(${(sx + 8).toFixed(1)},${(sy + 2).toFixed(1)})`);
      n.cos.setAttribute('transform', `translate(${(sx + 8).toFixed(1)},${(sy + 23).toFixed(1)})`);
      n.node.classList.toggle('city-small-label', !n.big && zoom < 1.4 && !highlight.has(n.c.id));
    }
  };
  fit(initial);
  baseK = Math.min(size()[0] / (full[2] - full[0] + 60), size()[1] / (full[3] - full[1] + 60));
  apply();

  const zoomAt = (factor, cx, cy) => {
    const k = Math.max(baseK * 0.8, Math.min(baseK * 14, view.k * factor));
    const f = k / view.k;
    view = { k, x: cx - (cx - view.x) * f, y: cy - (cy - view.y) * f };
    apply();
  };
  if (box.dataset.mapInteractive !== 'false') {
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    const pointers = new Map();
    let last = null;
    svg.addEventListener('pointerdown', (e) => { pointers.set(e.pointerId, [e.clientX, e.clientY]); last = null; });
    svg.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      const prevPt = pointers.get(e.pointerId);
      pointers.set(e.pointerId, [e.clientX, e.clientY]);
      if (pointers.size === 1) {
        if (Math.abs(e.clientX - prevPt[0]) + Math.abs(e.clientY - prevPt[1]) > 0) svg.classList.add('dragging');
        view.x += e.clientX - prevPt[0];
        view.y += e.clientY - prevPt[1];
        apply();
      } else if (pointers.size === 2) {
        const [p1, p2] = [...pointers.values()];
        const d = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
        if (last) {
          const r = svg.getBoundingClientRect();
          zoomAt(d / last, (p1[0] + p2[0]) / 2 - r.left, (p1[1] + p2[1]) / 2 - r.top);
        }
        last = d;
      }
    });
    const up = (e) => { pointers.delete(e.pointerId); last = null; setTimeout(() => svg.classList.remove('dragging'), 0); };
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('click', (e) => { if (svg.classList.contains('dragging')) e.preventDefault(); }, true);
    // Buttons
    const controls = document.createElement('div');
    controls.className = 'fw-map-controls';
    const btn = (label, title, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.title = title;
      b.setAttribute('aria-label', title);
      b.addEventListener('click', fn);
      controls.append(b);
    };
    btn('+', t.map?.zoomIn ?? '+', () => { const [w, h] = size(); zoomAt(1.4, w / 2, h / 2); });
    btn('−', t.map?.zoomOut ?? '−', () => { const [w, h] = size(); zoomAt(1 / 1.4, w / 2, h / 2); });
    btn('⤢', t.map?.reset ?? 'Reset', () => { fit(initial); apply(); });
    box.append(controls);
  }
  new ResizeObserver(() => { fit(initial); apply(); }).observe(box);
}

/** Draw a map in an element (data-map attributes set). Used directly by the job sheet. */
export function mountMap(box, opts = {}) {
  const t = pageText();
  return loadMap()
    .then((data) => render(box, data, t, opts))
    .catch(() => { box.textContent = t.map?.error ?? ''; box.classList.add('fw-map-error'); });
}

// Maps present in the page at load (not the deferred ones the job sheet fills later).
for (const b of document.querySelectorAll('[data-map]:not([data-map-defer])')) mountMap(b);
