/**
 * Parser for SCS text SII files (SiiNunit units, @include directives).
 * Only the plain-text form is supported: game definition files in the
 * archives are plain text. Binary/encrypted SII (saves) is not handled here.
 */

export type SiiValue = string | number | boolean | null | number[];

export interface SiiUnit {
  className: string;
  name: string;
  /** Scalars as values; `attr[]` entries collected as arrays. */
  attrs: Record<string, SiiValue | SiiValue[]>;
  /** Path of the file the unit was read from (after includes). */
  source: string;
}

export type IncludeResolver = (path: string) => string | null;

function dirname(p: string): string {
  const i = p.lastIndexOf('/');
  return i < 0 ? '' : p.slice(0, i);
}

/** Resolve an @include path relative to the including file (or absolute with "/"). */
function resolveInclude(from: string, inc: string): string {
  if (inc.startsWith('/')) return inc.slice(1);
  const parts = dirname(from).split('/').filter(Boolean);
  for (const seg of inc.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.' && seg !== '') parts.push(seg);
  }
  return parts.join('/');
}

/** Strips # and // line comments and /* *\/ blocks, keeping text inside quotes. */
function stripComments(src: string): string {
  let out = '';
  let inStr = false;
  let inBlock = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    const n = src[i + 1];
    if (inBlock) {
      if (c === '*' && n === '/') { inBlock = false; i++; }
      else if (c === '\n') out += c;
      continue;
    }
    if (inStr) {
      out += c;
      if (c === '\\' && n !== undefined) { out += n; i++; }
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === '#' || (c === '/' && n === '/')) {
      while (i < src.length && src[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (c === '/' && n === '*') { inBlock = true; i++; continue; }
    out += c;
  }
  return out;
}

interface Line { text: string; source: string }

/** Expands @include directives recursively into lines tagged with their source file. */
function expand(path: string, text: string, read: IncludeResolver, depth: number, out: Line[]): void {
  if (depth > 12) return;
  for (const raw of stripComments(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const inc = /^@include\s+"([^"]+)"/.exec(line);
    if (inc) {
      const target = resolveInclude(path, inc[1]!);
      const sub = read(target);
      if (sub !== null) expand(target, sub, read, depth + 1, out);
      continue;
    }
    out.push({ text: line, source: path });
  }
}

function parseValue(v: string): SiiValue {
  const s = v.trim();
  if (s.startsWith('"')) {
    const end = s.lastIndexOf('"');
    return s.slice(1, end > 0 ? end : undefined).replace(/\\(["\\nt])/g, (_, ch: string) => (ch === 'n' ? '\n' : ch === 't' ? '\t' : ch));
  }
  if (s.startsWith('(')) {
    return s
      .replace(/[()]/g, '')
      .split(',')
      .map((p) => Number(parseValue(p.trim())))
      .filter((n) => Number.isFinite(n));
  }
  if (s.startsWith('&') && /^&[0-9a-f]{8}$/i.test(s)) {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(parseInt(s.slice(1), 16));
    return b.readFloatBE(0);
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '') return null;
  if (/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(s)) return Number(s);
  return s;
}

/** Parses an SII document (or a .sui fragment) into units. */
export function parseSii(path: string, text: string, read: IncludeResolver = () => null): SiiUnit[] {
  const lines: Line[] = [];
  expand(path, text, read, 0, lines);
  const units: SiiUnit[] = [];
  let current: SiiUnit | null = null;
  let pendingHeader: { className: string; name: string; source: string } | null = null;
  let arrayKeys = new Set<string>();

  for (const { text: line, source } of lines) {
    if (line === 'SiiNunit') continue;
    if (!current) {
      // "class : name {", "class: name", then "{" on the next line
      const h = /^([\w.]+)\s*:\s*([\w.]+)\s*(\{)?\s*(\})?$/.exec(line);
      if (h) {
        const unit: SiiUnit = { className: h[1]!, name: h[2]!, attrs: {}, source };
        arrayKeys = new Set();
        if (h[3] && h[4]) units.push(unit);
        else if (h[3]) current = unit;
        else pendingHeader = { className: h[1]!, name: h[2]!, source };
        continue;
      }
      if (line === '{' && pendingHeader) {
        current = { ...pendingHeader, attrs: {} };
        pendingHeader = null;
      }
      continue; // nunit braces and anything else outside units
    }
    if (line === '}' || line.startsWith('}')) {
      units.push(current);
      current = null;
      continue;
    }
    const a = /^(\w+)(\[(\d*)\])?\s*:\s*(.*)$/.exec(line);
    if (!a) continue;
    const key = a[1]!;
    const isArray = a[2] !== undefined;
    const value = parseValue(a[4]!);
    if (isArray) {
      // Track which keys are lists for this unit: a list of numbers looks like a vector otherwise.
      if (!arrayKeys.has(key)) {
        arrayKeys.add(key);
        current.attrs[key] = [];
      }
      const arr = current.attrs[key] as SiiValue[];
      if (a[3]) arr[Number(a[3])] = value;
      else arr.push(value);
    } else {
      current.attrs[key] = value;
    }
  }
  return units;
}


/** Attribute helpers. */
export const sii = {
  str(u: SiiUnit, k: string): string | null {
    const v = u.attrs[k];
    return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null;
  },
  num(u: SiiUnit, k: string): number | null {
    const v = u.attrs[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  },
  bool(u: SiiUnit, k: string): boolean | null {
    const v = u.attrs[k];
    return typeof v === 'boolean' ? v : null;
  },
  list(u: SiiUnit, k: string): string[] {
    const v = u.attrs[k];
    if (!Array.isArray(v)) return typeof v === 'string' ? [v] : [];
    return (v as SiiValue[]).filter((x): x is string => typeof x === 'string');
  },
};
