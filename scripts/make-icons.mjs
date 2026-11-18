// Rasterises the app icon (same design as apps/web/public/icon.svg) to PNG
// without dependencies: iOS needs PNG for the home-screen icon.
// Usage: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../apps/web/public/', import.meta.url);

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, px) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const TOP = hex('#1c2a44'), BOT = hex('#0b1220'), BLUE = hex('#0a84ff'), WHITE = [255, 255, 255];

function inTri(x, y, a, b, c) {
  const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const d1 = s([x, y], a, b), d2 = s([x, y], b, c), d3 = s([x, y], c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

/** Colour at a point in the 512-unit design space; `rounded` clips the corners (not for iOS). */
function sample(x, y, rounded) {
  if (rounded) {
    const r = 112, cx = Math.min(Math.max(x, r), 512 - r), cy = Math.min(Math.max(y, r), 512 - r);
    if (Math.hypot(x - cx, y - cy) > r) return null;
  }
  let c = mix(TOP, BOT, y / 512);
  // Road wedge
  if (inTri(x, y, [226, 92], [150, 430], [362, 430]) && inTri(x, y, [226, 92], [362, 430], [286, 92])) {
    c = mix(c, BLUE, ((y - 92) / 338) * 0.55);
  }
  const d = Math.hypot(x - 256, y - 300);
  if (d <= 104) c = WHITE;
  if (d <= 88) c = BLUE;
  if (inTri(x, y, [256, 238], [300, 338], [256, 314]) || inTri(x, y, [256, 238], [256, 314], [212, 338])) c = WHITE;
  return c;
}

function render(size, rounded) {
  const px = Buffer.alloc(size * size * 4);
  const ss = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = sample(((x + (sx + 0.5) / ss) / size) * 512, ((y + (sy + 0.5) / ss) / size) * 512, rounded);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a += 1; }
      }
      const i = (y * size + x) * 4;
      const n = ss * ss;
      px[i] = a ? r / a : 0; px[i + 1] = a ? g / a : 0; px[i + 2] = a ? b / a : 0; px[i + 3] = (a / n) * 255;
    }
  }
  return png(size, px);
}

writeFileSync(new URL('apple-touch-icon.png', OUT), render(180, false)); // iOS rounds the corners itself
writeFileSync(new URL('icon-192.png', OUT), render(192, true));
writeFileSync(new URL('icon-512.png', OUT), render(512, false)); // maskable: full bleed
console.log('icons written');
