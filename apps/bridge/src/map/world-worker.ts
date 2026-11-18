// Worker thread entry: builds the whole-map files without blocking the bridge.
import { parentPort, workerData } from 'node:worker_threads';
import { buildWorldFiles } from './world-build.ts';

const { install, outDir } = workerData as { install: string; outDir: string };
try {
  const meta = buildWorldFiles(install, outDir, (msg) => parentPort?.postMessage({ type: 'log', msg }));
  parentPort?.postMessage({ type: 'done', meta });
} catch (err) {
  parentPort?.postMessage({ type: 'error', error: err instanceof Error ? err.message : String(err) });
}
