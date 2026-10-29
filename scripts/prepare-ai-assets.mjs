// Copies the MediaPipe WASM runtime and downloads the on-device models into
// public/mediapipe so the app serves everything from its own origin (works
// offline once the service worker has cached it). Runs before dev and build.
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'mediapipe');
const wasmSrc = path.join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');

// Apache-2.0 models published by Google MediaPipe.
const MODELS = {
  'hand_landmarker.task':
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  'efficientdet_lite0.tflite':
    'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite',
};

await mkdir(path.join(out, 'wasm'), { recursive: true });
await mkdir(path.join(out, 'models'), { recursive: true });

// Only the classic SIMD / non-SIMD runtimes are used (FilesetResolver picks one).
for (const base of ['vision_wasm_internal', 'vision_wasm_nosimd_internal']) {
  for (const ext of ['.js', '.wasm']) {
    await cp(path.join(wasmSrc, base + ext), path.join(out, 'wasm', base + ext));
  }
}

for (const [name, url] of Object.entries(MODELS)) {
  const dest = path.join(out, 'models', name);
  if (existsSync(dest)) continue;
  process.stdout.write(`Downloading ${name}... `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  console.log('done');
}
