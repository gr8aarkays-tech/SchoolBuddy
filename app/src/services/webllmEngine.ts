/**
 * WebLLM Engine Singleton
 *
 * Manages the lifecycle of an in-browser LLM (via @mlc-ai/web-llm).
 * The engine is created once per session and cached — subsequent calls
 * reuse the same instance (model weights stay in GPU memory).
 *
 * Models are downloaded once and cached permanently in the browser's OPFS
 * (Origin Private File System). No re-download on next session.
 *
 * Requirements: Chrome 121+ on Android (WebGPU + SharedArrayBuffer).
 */

import type { MLCEngineInterface, InitProgressReport } from '@mlc-ai/web-llm';

// ─── Model catalogue ──────────────────────────────────────────────────────────

export interface EngineModel {
  id: string;           // WebLLM model identifier
  label: string;        // Display name shown in UI
  sizeMB: number;       // Approximate download size in MB
  ramGB: number;        // Minimum device RAM required (GB)
  badge: string;        // Short quality badge shown in model card
  description: string;  // One-line description for parents
  isDefault: boolean;   // Pre-selected model
  multilingual: boolean;// Supports Hindi / regional languages
}

export const ENGINE_MODELS: EngineModel[] = [
  {
    id: 'SmolLM2-360M-Instruct-q4f32_1-MLC',
    label: 'SmolLM2 360M',
    sizeMB: 360,
    ramGB: 1,
    badge: '⚡ Fastest',
    description: 'Smallest model — ideal for budget Android phones with limited RAM.',
    isDefault: false,
    multilingual: false,
  },
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    label: 'Llama 3.2 · 1B',
    sizeMB: 700,
    ramGB: 2,
    badge: '🔥 Recommended',
    description: 'Best balance of speed and quality. Works on most mid-range phones.',
    isDefault: true,
    multilingual: false,
  },
  {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    label: 'Qwen 2.5 · 1.5B',
    sizeMB: 900,
    ramGB: 2,
    badge: '🇮🇳 Hindi / Regional',
    description: 'Understands Hindi, Marathi, Telugu and other Indian languages.',
    isDefault: false,
    multilingual: true,
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    label: 'Llama 3.2 · 3B',
    sizeMB: 1800,
    ramGB: 4,
    badge: '🧠 Best Quality',
    description: 'Highest quality responses. Recommended for tablets with 4 GB+ RAM.',
    isDefault: false,
    multilingual: false,
  },
];

// ─── Engine singleton ─────────────────────────────────────────────────────────

let _engine: MLCEngineInterface | null = null;
let _loadedModelId: string | null = null;

/**
 * Returns the cached engine instance, or null if not yet initialised.
 * Call `initEngine()` first — this is just a synchronous getter.
 */
export function getEngine(): MLCEngineInterface | null {
  return _engine;
}

/**
 * Returns the model ID that is currently loaded in the engine.
 */
export function getLoadedModelId(): string | null {
  return _loadedModelId;
}

/**
 * Initialises (or re-uses) the WebLLM engine with the given model.
 *
 * - If the same model is already loaded, returns immediately.
 * - Downloads the model weights on first call (cached in OPFS after that).
 * - `onProgress` receives values 0–1 during download/initialisation.
 *
 * @throws If WebGPU is unavailable or the download fails.
 */
export async function initEngine(
  modelId: string,
  onProgress?: (progress: number, text: string) => void,
): Promise<void> {
  // Dynamic import keeps the WebLLM bundle out of the initial app chunk
  const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

  const progressCallback = (report: InitProgressReport) => {
    onProgress?.(report.progress, report.text);
  };

  if (_engine && _loadedModelId === modelId) {
    // Already loaded — nothing to do
    onProgress?.(1, 'Model already loaded');
    return;
  }

  // Create a fresh engine (or reload with a different model)
  _engine = await CreateMLCEngine(modelId, {
    initProgressCallback: progressCallback,
  });
  _loadedModelId = modelId;
}

/**
 * Check whether a model is already cached in OPFS (i.e. no download needed).
 * Returns false if OPFS is unavailable or the cache check fails.
 */
export async function isModelCached(modelId: string): Promise<boolean> {
  try {
    const { hasModelInCache } = await import('@mlc-ai/web-llm');
    return await hasModelInCache(modelId);
  } catch {
    return false;
  }
}

/**
 * Delete a cached model from OPFS to free storage space.
 */
export async function deleteModelCache(modelId: string): Promise<void> {
  try {
    const { deleteModelAllInfoInCache } = await import('@mlc-ai/web-llm');
    await deleteModelAllInfoInCache(modelId);
    if (_loadedModelId === modelId) {
      _engine = null;
      _loadedModelId = null;
    }
  } catch (e) {
    throw new Error(`Failed to delete model cache: ${(e as Error).message}`);
  }
}
