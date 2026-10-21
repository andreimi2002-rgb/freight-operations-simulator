// Small, dependency-free wikitext helpers. They cover the markup used on the
// Truck Simulator Wiki pages we read (infoboxes, tabbers, wikitables, lists);
// they are not a general MediaWiki parser.

const NESTED_TAGS = ['gallery', 'ref', 'nowiki', 'tabber'];

/**
 * Split `text` on `sep` only where it is not inside {{ }}, [[ ]] or a
 * <gallery>/<ref>/<nowiki> block.
 */
export function splitTopLevel(text, sep) {
  const parts = [];
  let depthT = 0;
  let depthL = 0;
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const tag = !depthT && !depthL && text[i] === '<' ? openTag(text, i) : null;
    if (tag) {
      const close = text.indexOf(`</${tag}>`, i);
      i = close === -1 ? text.length : close + tag.length + 3;
      continue;
    }
    if (text.startsWith('{{', i)) { depthT++; i += 2; continue; }
    if (text.startsWith('}}', i) && depthT) { depthT--; i += 2; continue; }
    if (text.startsWith('[[', i)) { depthL++; i += 2; continue; }
    if (text.startsWith(']]', i) && depthL) { depthL--; i += 2; continue; }
    if (!depthT && !depthL && text.startsWith(sep, i)) {
      parts.push(text.slice(start, i));
      i += sep.length;
      start = i;
      continue;
    }
    i++;
  }
  parts.push(text.slice(start));
  return parts;
}

function openTag(text, i) {
  for (const tag of NESTED_TAGS) {
    if (tag === 'tabber') continue;
    const re = new RegExp(`^<${tag}(\\s[^>]*)?>`, 'i');
    if (re.test(text.slice(i, i + 40))) return tag;
  }
  return null;
}

/** Find every top-level-or-nested template whose name matches `nameRe`. */
export function findTemplates(text, nameRe) {
  const found = [];
  for (let i = text.indexOf('{{'); i !== -1; i = text.indexOf('{{', i + 2)) {
    const end = matchBraces(text, i);
    if (end === -1) break;
    const raw = text.slice(i, end);
    const tpl = parseTemplate(raw);
    if (nameRe.test(tpl.name)) found.push({ ...tpl, start: i, end });
  }
  return found;
}

/** Index just after the `}}` that closes the `{{` at `start`, or -1. */
export function matchBraces(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text.startsWith('{{', i)) { depth++; i++; continue; }
    if (text.startsWith('}}', i)) {
      depth--;
      i++;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** Parse "{{Name|a|key = value}}" into { name, params: { 1: 'a', key: 'value' } }. */
export function parseTemplate(raw) {
  const inner = raw.slice(2, -2);
  const [head, ...rest] = splitTopLevel(inner, '|');
  const params = {};
  let pos = 1;
  for (const part of rest) {
    const eq = splitTopLevel(part, '=');
    if (eq.length > 1 && /^\s*[\w -]+\s*$/.test(eq[0])) {
      params[eq[0].trim()] = eq.slice(1).join('=').trim();
    } else {
      params[pos++] = part.trim();
    }
  }
  return { name: head.trim().replace(/_/g, ' '), params, raw };
}

/** Render one template to plain text. Known wiki templates get a readable form. */
function renderTemplate(tpl) {
  const p = tpl.params;
  const n = tpl.name.toLowerCase();
  if (n === 'ats' || n === 'ets2') return p[2] ?? p[1] ?? '';
  if (n === 'update') return p[2] ?? '';
  if (n === 'atslink') return 'American Truck Simulator';
  if (n === 'ets2link') return 'Euro Truck Simulator 2';
  if (n === 'wikipedia link') return p[2] ?? p[1] ?? '';
  if (n === 'rsign') return roadName(p[2], p[3]);
  if (n === 'cols') return p[2] ?? '';
  if (n === 'yn') return /^y/i.test(p[1] ?? '') ? 'Yes' : 'No';
  const positional = Object.keys(p).filter((k) => /^\d+$/.test(k));
  if (positional.length === 0) return tpl.name;
  return p[positional[positional.length - 1]];
}

/** {{RSIGN|US|IS|5}} → "I-5", US|US|50 → "US 50", US|CA|37 → "CA 37". */
export function roadName(kind, number) {
  if (!kind || !number) return number ?? '';
  if (kind === 'IS') return `I-${number}`;
  if (kind === 'USCA' || kind === 'US') return `US ${number}`;
  return `${kind} ${number}`;
}

/** Wikitext → plain text (links, templates, bold/italic, comments, refs). */
export function strip(text) {
  if (text == null) return '';
  let s = String(text)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<gallery[^>]*>[\s\S]*?<\/gallery>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ');
  // Templates, innermost first.
  for (let guard = 0; guard < 50 && s.includes('{{'); guard++) {
    const next = s.replace(/\{\{([^{}]*)\}\}/g, (m) => renderTemplate(parseTemplate(m)));
    if (next === s) break;
    s = next;
  }
  s = s
    .replace(/\[\[(?:File|Image|Category):[^\]]*\]\]/gi, '')
    .replace(/\[\[([^\]|]+)\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s([^\]]+)\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

/**
 * Pages linked from `text`: [[Target]] / [[Target|label]] and the page that
 * {{ATS|Target|label}} links to ("Target/American Truck Simulator", see
 * Template:ATS on the wiki). File and Category links are skipped.
 */
export function linkTargets(text) {
  const out = [];
  const clean = String(text ?? '').replace(/<!--[\s\S]*?-->/g, '');
  for (const m of clean.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)) {
    const t = m[1].trim();
    if (!/^(File|Image|Category):/i.test(t)) out.push(normTitle(t));
  }
  for (const tpl of findTemplates(clean, /^ATS$/i)) {
    if (tpl.params[1]) out.push(normTitle(`${tpl.params[1]}/American Truck Simulator`));
  }
  return out;
}

export function normTitle(t) {
  const s = t.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Content of the section titled `title` (any level), up to the next heading of the same or higher level. */
export function getSection(text, title, level) {
  const lines = text.split('\n');
  const want = title.toLowerCase();
  let start = -1;
  let lvl = 0;
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^(={2,6})\s*(.*?)\s*\1\s*$/);
    if (!h) continue;
    if (start === -1) {
      if (h[2].toLowerCase() === want && (!level || h[1].length === level)) {
        start = i + 1;
        lvl = h[1].length;
      }
    } else if (h[1].length <= lvl) {
      return lines.slice(start, i).join('\n');
    }
  }
  return start === -1 ? null : lines.slice(start).join('\n');
}

/**
 * The tabs of the first <tabber> in `text`: [{ name, content }]. Text around
 * the tabber is returned as `before` / `after`.
 */
export function tabs(text) {
  const open = text.search(/<tabber[^>]*>/i);
  if (open === -1) return { before: text, tabs: [], after: '' };
  const openEnd = text.indexOf('>', open) + 1;
  const close = text.indexOf('</tabber>', openEnd);
  const body = text.slice(openEnd, close === -1 ? text.length : close);
  const list = body.split(/\n?\|-\|\n?/).map((chunk) => {
    const m = chunk.match(/^\s*([^=\n]+?)\s*=\s*\n?([\s\S]*)$/);
    return m ? { name: m[1].trim(), content: m[2] } : { name: '', content: chunk };
  });
  return {
    before: text.slice(0, open),
    tabs: list,
    after: close === -1 ? '' : text.slice(close + '</tabber>'.length),
  };
}

/** Current version of a tabbed section: text outside the tabber plus its first tab. */
export function currentTab(text) {
  const t = tabs(text ?? '');
  if (t.tabs.length === 0) return { name: null, content: text ?? '' };
  return { name: t.tabs[0].name, content: `${t.before}\n${t.tabs[0].content}\n${t.after}` };
}

/** Bullet list items ("* a", "** b") as raw wikitext, in order. */
export function listItems(text) {
  return String(text ?? '')
    .split('\n')
    .map((l) => l.match(/^\s*\*+\s*(.*)$/))
    .filter(Boolean)
    .map((m) => m[1].trim())
    .filter((s) => s.length > 0);
}

/**
 * Parse every wikitable in `text`. Returns tables as arrays of rows; each row
 * is an array of cells { header, text, colspan, rowspan }.
 */
export function parseTables(text) {
  const tables = [];
  const lines = String(text ?? '').split('\n');
  let table = null;
  let row = null;
  let cell = null;
  let depth = 0;
  const pushCell = (header, raw) => {
    const { attrs, content } = splitCellAttrs(raw);
    const colspan = Number((attrs.match(/colspan\s*=\s*"?(\d+)/i) ?? [])[1] ?? 1);
    const rowspan = Number((attrs.match(/rowspan\s*=\s*"?(\d+)/i) ?? [])[1] ?? 1);
    cell = { header, text: content, colspan, rowspan };
    row.push(cell);
  };
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('{|')) {
      if (table) { depth++; if (cell) cell.text += `\n${line}`; continue; }
      table = [];
      row = null;
      cell = null;
      continue;
    }
    if (!table) continue;
    if (depth > 0) {
      if (t.startsWith('|}')) depth--;
      if (cell) cell.text += `\n${line}`;
      continue;
    }
    if (t.startsWith('|}')) {
      if (row && row.length) table.push(row);
      tables.push(table);
      table = null;
      continue;
    }
    if (t.startsWith('|-')) {
      if (row && row.length) table.push(row);
      row = [];
      cell = null;
      continue;
    }
    if (t.startsWith('|+')) continue;
    if (t.startsWith('!') || (t.startsWith('|') && !t.startsWith('||'))) {
      if (!row) row = [];
      const header = t.startsWith('!');
      const rest = t.slice(1);
      const parts = splitTopLevel(rest, header ? '!!' : '||');
      const more = header ? parts.flatMap((p) => splitTopLevel(p, '||')) : parts;
      for (const p of more) pushCell(header, p);
      continue;
    }
    if (cell) cell.text += `\n${line}`;
  }
  return tables;
}

function splitCellAttrs(raw) {
  const parts = splitTopLevel(raw, '|');
  if (parts.length > 1 && /^\s*[\w-]+\s*=\s*("[^"]*"|[^\s|]+)(\s+[\w-]+\s*=\s*("[^"]*"|[^\s|]+))*\s*$/.test(parts[0])) {
    return { attrs: parts[0], content: parts.slice(1).join('|').trim() };
  }
  return { attrs: '', content: raw.trim() };
}

/** Lowercase ASCII slug: "Farmer's Barn" → "farmers-barn". */
export function slug(name) {
  return String(name)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Key used to match the same name written slightly differently on two pages. */
export function nameKey(name) {
  return slug(name).replace(/-/g, '');
}
