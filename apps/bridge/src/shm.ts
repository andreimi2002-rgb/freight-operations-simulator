import { MMF_NAME, MMF_SIZE } from './scs-layout.ts';

/**
 * Read-only access to the plugin's named shared memory on Windows, through
 * kernel32 (koffi FFI, prebuilt binaries, no compiler needed).
 */

const FILE_MAP_READ = 0x0004;

interface Kernel32 {
  OpenFileMappingW: (access: number, inherit: number, name: string) => unknown;
  MapViewOfFile: (h: unknown, access: number, hi: number, lo: number, size: number) => unknown;
  UnmapViewOfFile: (p: unknown) => number;
  CloseHandle: (h: unknown) => number;
  RtlMoveMemory: (dst: Buffer, src: unknown, len: number) => void;
}

let k32: Kernel32 | null = null;

async function kernel32(): Promise<Kernel32> {
  if (k32) return k32;
  if (process.platform !== 'win32') throw new Error('Live telemetry needs Windows (the game runs there).');
  const koffi = (await import('koffi')).default;
  const lib = koffi.load('kernel32.dll');
  k32 = {
    OpenFileMappingW: lib.func('void* __stdcall OpenFileMappingW(uint32_t dwDesiredAccess, int bInheritHandle, str16 lpName)'),
    MapViewOfFile: lib.func('void* __stdcall MapViewOfFile(void* hFileMappingObject, uint32_t dwDesiredAccess, uint32_t dwFileOffsetHigh, uint32_t dwFileOffsetLow, size_t dwNumberOfBytesToMap)'),
    UnmapViewOfFile: lib.func('int __stdcall UnmapViewOfFile(void* lpBaseAddress)'),
    CloseHandle: lib.func('int __stdcall CloseHandle(void* hObject)'),
    RtlMoveMemory: lib.func('void __stdcall RtlMoveMemory(_Out_ uint8_t* Destination, void* Source, size_t Length)'),
  } as unknown as Kernel32;
  return k32;
}

export class SharedMemoryReader {
  private handle: unknown = null;
  private view: unknown = null;
  private readonly buf = Buffer.alloc(MMF_SIZE);

  get isOpen(): boolean {
    return this.view !== null;
  }

  /** Tries to open the mapping; returns false when the plugin has not created it. */
  async open(): Promise<boolean> {
    if (this.view) return true;
    const k = await kernel32();
    const h = k.OpenFileMappingW(FILE_MAP_READ, 0, MMF_NAME);
    if (!h) return false;
    const v = k.MapViewOfFile(h, FILE_MAP_READ, 0, 0, MMF_SIZE);
    if (!v) {
      k.CloseHandle(h);
      return false;
    }
    this.handle = h;
    this.view = v;
    return true;
  }

  /** Copies the current memory into an internal buffer and returns it. */
  read(): Buffer | null {
    if (!this.view || !k32) return null;
    k32.RtlMoveMemory(this.buf, this.view, MMF_SIZE);
    return this.buf;
  }

  close(): void {
    if (!k32) return;
    if (this.view) k32.UnmapViewOfFile(this.view);
    if (this.handle) k32.CloseHandle(this.handle);
    this.view = null;
    this.handle = null;
  }
}
