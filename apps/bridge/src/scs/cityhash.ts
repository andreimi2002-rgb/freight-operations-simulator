// CityHash64 (v1.0.x variant used by SCS HashFS), ported to TypeScript.
//
// Ported from ts-map's CityHash.cs (MIT, Copyright (c) 2018 Dario Wouters),
// itself based on cityhash-c (Copyright (c) 2011-2012 Alexander Nusov) and
// Google's CityHash (Copyright (c) 2011 Google, Inc.), all under the MIT licence:
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

const M = (1n << 64n) - 1n;
const K0 = 0xc3a5c85c97cb3127n;
const K1 = 0xb492b66fbe98f273n;
const K2 = 0x9ae16a3b2f90404fn;
const K3 = 0xc949d7c7509e6557n;
const KMUL = 0x9ddfea08eb382d69n;

const mul = (a: bigint, b: bigint) => (a * b) & M;
const add = (...xs: bigint[]) => xs.reduce((s, x) => (s + x) & M, 0n);
const sub = (a: bigint, b: bigint) => (a - b) & M;
const rot = (v: bigint, s: number) => (s === 0 ? v : ((v >> BigInt(s)) | (v << BigInt(64 - s))) & M);
const shiftMix = (v: bigint) => v ^ (v >> 47n);

function f64(b: Buffer, p: number): bigint {
  return b.readBigUInt64LE(p);
}
function f32(b: Buffer, p: number): bigint {
  return BigInt(b.readUInt32LE(p));
}

function hash128to64(lo: bigint, hi: bigint): bigint {
  let a = mul(lo ^ hi, KMUL);
  a ^= a >> 47n;
  let b = mul(hi ^ a, KMUL);
  b ^= b >> 47n;
  return mul(b, KMUL);
}
const hashLen16 = (u: bigint, v: bigint) => hash128to64(u, v);

function hashLen0to16(s: Buffer, len: number): bigint {
  const L = BigInt(len);
  if (len > 8) {
    const a = f64(s, 0);
    const b = f64(s, len - 8);
    return hashLen16(a, rot(add(b, L), len)) ^ b;
  }
  if (len >= 4) {
    const a = f32(s, 0);
    return hashLen16(add(L, (a << 3n) & M), f32(s, len - 4));
  }
  if (len > 0) {
    const a = BigInt(s[0]!);
    const b = BigInt(s[len >> 1]!);
    const c = BigInt(s[len - 1]!);
    const y = a + (b << 8n);
    const z = L + (c << 2n);
    return mul(shiftMix(mul(y, K2) ^ mul(z, K3)), K2);
  }
  return K2;
}

function hashLen17to32(s: Buffer, len: number): bigint {
  const L = BigInt(len);
  const a = mul(f64(s, 0), K1);
  const b = f64(s, 8);
  const c = mul(f64(s, len - 8), K2);
  const d = mul(f64(s, len - 16), K0);
  return hashLen16(add(rot(sub(a, b), 43), rot(c, 30), d), add(sub(add(a, rot(b ^ K3, 20)), c), L));
}

function hashLen33to64(s: Buffer, len: number): bigint {
  const L = BigInt(len);
  let z = f64(s, 24);
  let a = add(f64(s, 0), mul(add(L, f64(s, len - 16)), K0));
  let b = rot(add(a, z), 52);
  let c = rot(a, 37);
  a = add(a, f64(s, 8));
  c = add(c, rot(a, 7));
  a = add(a, f64(s, 16));
  const vf = add(a, z);
  const vs = add(b, rot(a, 31), c);
  a = add(f64(s, 16), f64(s, len - 32));
  z = f64(s, len - 8);
  b = rot(add(a, z), 52);
  c = rot(a, 37);
  a = add(a, f64(s, len - 24));
  c = add(c, rot(a, 7));
  a = add(a, f64(s, len - 16));
  const wf = add(a, z);
  const ws = add(b, rot(a, 31), c);
  const r = shiftMix(add(mul(add(vf, ws), K2), mul(add(wf, vs), K0)));
  return mul(shiftMix(add(mul(r, K0), vs)), K2);
}

function weak(w: bigint, x: bigint, y: bigint, z: bigint, a: bigint, b: bigint): [bigint, bigint] {
  a = add(a, w);
  b = rot(add(b, a, z), 21);
  const c = a;
  a = add(a, x, y);
  b = add(b, rot(a, 44));
  return [add(a, z), add(b, c)];
}
const weakAt = (s: Buffer, p: number, a: bigint, b: bigint) => weak(f64(s, p), f64(s, p + 8), f64(s, p + 16), f64(s, p + 24), a, b);

export function cityHash64(input: string | Buffer): bigint {
  const s = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  let len = s.length;
  if (len <= 16) return hashLen0to16(s, len);
  if (len <= 32) return hashLen17to32(s, len);
  if (len <= 64) return hashLen33to64(s, len);

  const L = BigInt(len);
  let x = f64(s, len - 40);
  let y = add(f64(s, len - 16), f64(s, len - 56));
  let z = hashLen16(add(f64(s, len - 48), L), f64(s, len - 24));
  let v = weakAt(s, len - 64, L, z);
  let w = weakAt(s, len - 32, add(y, K1), x);
  x = add(mul(x, K1), f64(s, 0));

  let pos = 0;
  len = (len - 1) & ~63;
  do {
    x = mul(rot(add(x, y, v[0], f64(s, pos + 8)), 37), K1);
    y = mul(rot(add(y, v[1], f64(s, pos + 48)), 42), K1);
    x ^= w[1];
    y = add(y, v[0], f64(s, pos + 40));
    z = mul(rot(add(z, w[0]), 33), K1);
    v = weakAt(s, pos, mul(v[1], K1), add(x, w[0]));
    w = weakAt(s, pos + 32, add(z, w[1]), add(y, f64(s, pos + 16)));
    [z, x] = [x, z];
    pos += 64;
    len -= 64;
  } while (len !== 0);

  return hashLen16(add(hashLen16(v[0], w[0]), mul(shiftMix(y), K1), z), add(hashLen16(v[1], w[1]), x));
}
