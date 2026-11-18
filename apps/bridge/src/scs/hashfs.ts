import { closeSync, openSync, readSync } from 'node:fs';
import { basename } from 'node:path';
import { inflateRawSync, inflateSync } from 'node:zlib';
import { cityHash64 } from './cityhash.ts';

/**
 * Read-only access to SCS game archives (.scs): HashFS v1/v2 and the older
 * ZIP-based ones. Layout reference: ts-map (MIT), TsMap/FileSystem/Hash/*.
 * Files are addressed by the CityHash64 of their path without a leading "/".
 */

const SCS_MAGIC = 0x23534353; // "SCS#"
const HASH_CITY = 0x59544943; // "CITY"

interface Entry {
  offset: number;
  size: number;
  compressedSize: number;
  /** 0 none, 1 zlib, 2 raw deflate (zip), 3 gdeflate (textures, unsupported here) */
  compression: number;
  isDirectory: boolean;
}

export interface Archive {
  readonly path: string;
  readonly name: string;
  has(path: string): boolean;
  read(path: string): Buffer | null;
  /** Directory listing: names; sub-directories end with "/". */
  list(path: string): string[] | null;
  close(): void;
}

function norm(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

function readAt(fd: number, offset: number, length: number): Buffer {
  const buf = Buffer.alloc(length);
  let done = 0;
  while (done < length) {
    const n = readSync(fd, buf, done, length - done, offset + done);
    if (n === 0) break;
    done += n;
  }
  return buf;
}

class HashArchive implements Archive {
  readonly name: string;
  private readonly fd: number;
  private readonly entries = new Map<bigint, Entry>();
  private readonly version: number;
  readonly path: string;

  constructor(path: string, fd: number, header: Buffer) {
    this.path = path;
    this.name = basename(path);
    this.fd = fd;
    this.version = header.readUInt16LE(4);
    const count = header.readUInt32LE(0x0c);
    if (this.version === 1) this.loadV1(count, header.readUInt32LE(0x10));
    else if (this.version === 2) this.loadV2(count, header);
    else throw new Error(`${this.name}: unsupported HashFS version ${this.version}`);
  }

  private loadV1(count: number, start: number): void {
    const raw = readAt(this.fd, start, count * 0x20);
    for (let i = 0; i < count; i++) {
      const o = i * 0x20;
      const flags = raw.readUInt32LE(o + 0x10);
      this.entries.set(raw.readBigUInt64LE(o), {
        offset: Number(raw.readBigUInt64LE(o + 0x08)),
        size: raw.readUInt32LE(o + 0x18),
        compressedSize: raw.readUInt32LE(o + 0x1c),
        compression: flags & 2 ? 1 : 0,
        isDirectory: (flags & 1) !== 0,
      });
    }
  }

  private loadV2(count: number, h: Buffer): void {
    const entryBlockSize = h.readUInt32LE(0x10);
    const metaCount = h.readUInt32LE(0x14);
    const metaBlockSize = h.readUInt32LE(0x18);
    const entryOffset = Number(h.readBigInt64LE(0x1c));
    const metaOffset = Number(h.readBigInt64LE(0x24));
    const entries = inflateSync(readAt(this.fd, entryOffset, entryBlockSize));
    const meta = inflateSync(readAt(this.fd, metaOffset, metaBlockSize));
    void metaCount;
    for (let i = 0; i < count; i++) {
      const o = i * 0x10;
      const hash = entries.readBigUInt64LE(o);
      const metaIndex = entries.readUInt32LE(o + 0x08);
      const metaEntries = entries.readUInt16LE(o + 0x0c);
      const flags = entries.readUInt32LE(o + 0x0c);
      let plain: Entry | null = null;
      for (let j = 0; j < metaEntries; j++) {
        const m0 = meta.readUInt32LE((metaIndex + j) * 4);
        const type = m0 >>> 24;
        const ref = (m0 & 0xffffff) * 4;
        // 0x80 plain, 0x81 directory, 0x82..0x84 texture mips
        if (type === 0x80 || type === 0x81 || type === 0x82 || type === 0x83 || type === 0x84) {
          const d0 = meta.readUInt32LE(ref);
          const d1 = meta.readUInt32LE(ref + 4);
          const d3 = meta.readUInt32LE(ref + 12);
          if (!plain || type === 0x80 || type === 0x81) {
            const compressedSize = d0 & 0x0fffffff;
            const size = d1 & 0x0fffffff;
            plain = {
              offset: d3 * 16,
              size,
              compressedSize,
              compression: size === compressedSize ? 0 : d0 >>> 28,
              isDirectory: ((flags >>> 16) & 1) === 1,
            };
          }
        }
      }
      if (plain) this.entries.set(hash, plain);
    }
  }

  private entry(path: string): Entry | undefined {
    return this.entries.get(cityHash64(norm(path)));
  }

  has(path: string): boolean {
    return this.entry(path) !== undefined;
  }

  private bytes(e: Entry): Buffer | null {
    const raw = readAt(this.fd, e.offset, e.compressedSize);
    if (e.compression === 0) return raw;
    if (e.compression === 1) return inflateSync(raw);
    return null; // gdeflate: textures only, not needed for game data
  }

  read(path: string): Buffer | null {
    const e = this.entry(path);
    if (!e || e.isDirectory) return null;
    return this.bytes(e);
  }

  list(path: string): string[] | null {
    const e = this.entry(path);
    if (!e || !e.isDirectory) return null;
    const data = this.bytes(e);
    if (!data) return null;
    // v2: binary (count, name lengths, names; "/" prefix for directories).
    // v1: text, one name per line, "*" prefix for directories.
    if (this.version === 2 && data.length >= 4) {
      const n = data.readUInt32LE(0);
      const out: string[] = [];
      let p = 4 + n;
      for (let i = 0; i < n; i++) {
        const len = data[4 + i]!;
        const s = data.toString('utf8', p, p + len);
        p += len;
        out.push(s.startsWith('/') ? `${s.slice(1)}/` : s);
      }
      return out;
    }
    return data
      .toString('utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => (l.startsWith('*') ? `${l.slice(1)}/` : l));
  }

  close(): void {
    closeSync(this.fd);
  }
}

class ZipArchive implements Archive {
  readonly name: string;
  readonly path: string;
  private readonly fd: number;
  private readonly files = new Map<string, { local: number; size: number; csize: number; method: number }>();
  private readonly dirs = new Map<string, Set<string>>();

  constructor(path: string, fd: number, fileSize: number) {
    this.path = path;
    this.name = basename(path);
    this.fd = fd;
    const tailLen = Math.min(fileSize, 65_557);
    const tail = readAt(fd, fileSize - tailLen, tailLen);
    const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd < 0) throw new Error(`${this.name}: not a HashFS or ZIP archive`);
    const count = tail.readUInt16LE(eocd + 10);
    const cdSize = tail.readUInt32LE(eocd + 12);
    const cdOffset = tail.readUInt32LE(eocd + 16);
    const cd = readAt(fd, cdOffset, cdSize);
    let p = 0;
    for (let i = 0; i < count && p + 46 <= cd.length; i++) {
      const method = cd.readUInt16LE(p + 10);
      const csize = cd.readUInt32LE(p + 20);
      const size = cd.readUInt32LE(p + 24);
      const nameLen = cd.readUInt16LE(p + 28);
      const extraLen = cd.readUInt16LE(p + 30);
      const commentLen = cd.readUInt16LE(p + 32);
      const local = cd.readUInt32LE(p + 42);
      const name = norm(cd.toString('utf8', p + 46, p + 46 + nameLen));
      p += 46 + nameLen + extraLen + commentLen;
      if (!name) continue;
      const isDir = cd[p - commentLen - extraLen - 1] === 0x2f; // trailing "/"
      const parts = name.split('/');
      for (let k = 0; k < parts.length; k++) {
        const parent = parts.slice(0, k).join('/');
        const child = parts[k]! + (k < parts.length - 1 || isDir ? '/' : '');
        if (!this.dirs.has(parent)) this.dirs.set(parent, new Set());
        this.dirs.get(parent)!.add(child);
      }
      if (!isDir) this.files.set(name, { local, size, csize, method });
    }
  }

  has(path: string): boolean {
    const p = norm(path);
    return this.files.has(p) || this.dirs.has(p);
  }

  read(path: string): Buffer | null {
    const f = this.files.get(norm(path));
    if (!f) return null;
    const lh = readAt(this.fd, f.local, 30);
    const start = f.local + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
    const raw = readAt(this.fd, start, f.csize);
    return f.method === 8 ? inflateRawSync(raw) : raw;
  }

  list(path: string): string[] | null {
    const d = this.dirs.get(norm(path));
    return d ? [...d] : null;
  }

  close(): void {
    closeSync(this.fd);
  }
}

export function openArchive(path: string, fileSize: number): Archive {
  const fd = openSync(path, 'r');
  try {
    const header = readAt(fd, 0, 0x2c);
    if (header.readUInt32LE(0) === SCS_MAGIC) {
      if (header.readUInt32LE(8) !== HASH_CITY) throw new Error(`${basename(path)}: unknown hash method`);
      return new HashArchive(path, fd, header);
    }
    return new ZipArchive(path, fd, fileSize);
  } catch (err) {
    closeSync(fd);
    throw err;
  }
}
