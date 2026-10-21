import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const tokens = Object.fromEntries(
  [...css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2].toUpperCase()]),
);

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('tokens match DEVELOPMENT_PLAN.md section 4', () => {
  assert.deepEqual(tokens, {
    bg: '#0B0F14',
    'bg-header': '#0E131A',
    panel: '#121821',
    'panel-deep': '#0F151D',
    hero: '#141C26',
    border: '#1F2833',
    'border-input': '#253141',
    'row-line': '#1A222C',
    text: '#E6EDF3',
    'text-soft': '#B7C2CD',
    'text-muted': '#8B98A5',
    amber: '#F5A524',
    'on-amber': '#1A1204',
    blue: '#7DBBFF',
    green: '#6FD39A',
  });
});

test('every text colour reaches 4.5:1 on every surface', () => {
  const surfaces = ['bg', 'bg-header', 'panel', 'panel-deep', 'hero'];
  const texts = ['text', 'text-soft', 'text-muted', 'amber', 'blue', 'green'];
  for (const s of surfaces) {
    for (const x of texts) {
      const ratio = contrast(tokens[x], tokens[s]);
      assert.ok(ratio >= 4.5, `--${x} on --${s}: ${ratio.toFixed(2)}:1`);
    }
  }
});

test('text on amber buttons reaches 4.5:1', () => {
  const ratio = contrast(tokens['on-amber'], tokens.amber);
  assert.ok(ratio >= 4.5, `--on-amber on --amber: ${ratio.toFixed(2)}:1`);
});
