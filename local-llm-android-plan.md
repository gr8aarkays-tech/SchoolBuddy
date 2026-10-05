# Plan: In-Browser Local LLM Support for Android (SanjuClass1)

## Top-Level Overview

**Goal**: Enable the SanjuClass1 PWA to run AI entirely on the user's Android phone/tablet — with no API key, no monthly subscription, and no data leaving the device. Users can select and "download" a small language model from within the Settings page, which then powers all AI features (study guide, question generation, exam plan, chat) directly in the browser.

**Approach**:
- Use **WebLLM** (`@mlc-ai/web-llm`) — works on Android Chrome 121+ via WebGPU, and falls back gracefully on older devices
- WebLLM exposes the same OpenAI-compatible `chat.completions.create()` API already used in `aiService.ts` — minimal code change needed
- Models are downloaded once (~300MB–1GB) and cached permanently in the browser's **OPFS** (Origin Private File System) — no re-download on next session
- Fix the existing bug: Settings UI currently does NOT persist — provider choice is lost on refresh. This must be fixed as part of this plan.
- Image OCR for local mode: use **Tesseract.js** (already in the project) as fallback since most local models lack vision

**Target devices**: Android phones/tablets running Chrome 121+ (released Jan 2024). Covers essentially all modern Android devices from 2022 onward.

## Design Decisions (Confirmed)

| Decision | Choice | Rationale |
|---|---|---|
| **Default model** | Llama-3.2-1B-Instruct | Best balance of quality + compatibility for mid-range Indian phones (Redmi, Realme, Samsung A-series). Works with 2GB+ RAM. |
| **Hindi / multilingual** | Include Qwen2.5-1.5B | Indian parents receive WhatsApp materials in Hindi, Marathi, Telugu, etc. Multilingual support is essential. |
| **First-run experience** | Opt-in via Dashboard banner | One-time subtle banner on Dashboard: "Try Free Local AI — no subscription needed" → links to Settings. No intrusive onboarding. |

---

## Architecture After This Change

```
User opens Settings
  → Selects "Local AI (On-Device)" provider
  → Sees a model catalogue with 3–4 options (size, speed, RAM needed)
  → Taps "Download" → progress bar fills → model cached in OPFS
  → All future AI calls go through WebLLM engine (no internet needed)

Settings persist to localStorage
  → aiService.ts reads provider + model from localStorage at runtime
  → WebLLM engine initialised once per session (singleton)
```

---

## Sub-Tasks

---

### Sub-Task 1: Fix Settings Persistence (Foundation)

**Intent**: The Settings page currently uses only `useState` — all choices vanish on page refresh. Before adding local LLM, the AI provider selection must persist to `localStorage` so `aiService.ts` can read it at runtime (not just at build time via env vars).

**Expected Outcomes**:
- Selecting a provider in Settings and saving it persists across refreshes and app restarts
- `aiService.ts` reads provider + API key from `localStorage` instead of only from `import.meta.env`
- A new `AppSettings` type is added to `types/index.ts`

**Todo List**:
1. Add `AppSettings` interface to `app/src/types/index.ts`:
   ```ts
   interface AppSettings {
     aiProvider: 'mock' | 'openai' | 'anthropic' | 'watsonx' | 'local';
     apiKey: string;
     localModelId: string;
   }
   ```
2. Create `app/src/contexts/SettingsContext.tsx`:
   - Reads/writes `sanju_settings` key in `localStorage`
   - Exposes `settings`, `updateSettings(patch)` via React context
   - Wraps `App.tsx` alongside `AuthProvider`
3. Update `app/src/pages/Settings.tsx`:
   - Replace `useState` with `useSettings()` hook from SettingsContext
   - `handleSave` writes to context (which writes to localStorage) instead of doing nothing
4. Update `app/src/services/aiService.ts`:
   - Change `PROVIDER` and `API_KEY` from compile-time `import.meta.env` constants to runtime reads from `localStorage` key `sanju_settings`
   - Keep env vars as a fallback for developer deployments

**Relevant Context**:
- `app/src/pages/Settings.tsx` lines 4–13 (useState declarations)
- `app/src/services/aiService.ts` lines 20–21 (PROVIDER/API_KEY constants)
- `app/src/contexts/AuthContext.tsx` — good pattern to copy for SettingsContext
- `app/src/App.tsx` — wrap with `<SettingsProvider>`

**Status**: [ ] pending

---

### Sub-Task 2: Add WebLLM Dependency and Engine Singleton

**Intent**: Install `@mlc-ai/web-llm` and create a singleton engine module that initialises the WebLLM engine once per session, exposes a progress callback for the download UI, and wraps the OpenAI-compatible API that the rest of `aiService.ts` already expects.

**Expected Outcomes**:
- `@mlc-ai/web-llm` is installed in `app/package.json`
- A new file `app/src/services/webllmEngine.ts` manages the engine lifecycle
- `vite.config.ts` has the required COOP/COEP security headers for WebGPU shared memory
- The engine is not initialised until the user has downloaded a model

**Todo List**:
1. Install: `npm install @mlc-ai/web-llm` inside `app/`
2. Add COOP/COEP headers to `app/vite.config.ts`:
   ```ts
   server: {
     headers: {
       'Cross-Origin-Opener-Policy': 'same-origin',
       'Cross-Origin-Embedder-Policy': 'require-corp',
     }
   }
   ```
   Also add same headers to `preview:` config block for production builds.
3. Create `app/src/services/webllmEngine.ts`:
   - `initEngine(modelId, onProgress)` — creates `MLCEngine`, calls `reload(modelId)`, tracks download progress
   - `getEngine()` — returns the cached engine or null if not yet loaded
   - `isModelCached(modelId)` — checks OPFS to see if model is already downloaded (no re-download needed)
   - `ENGINE_MODELS` — exported constant: array of `{ id, label, size, ramNeeded, description }` for the 3–4 recommended models
4. Model catalogue (Android-friendly; Llama-3.2-1B is the default selection):
   - `SmolLM2-360M-Instruct-q4f32_1-MLC` — 360MB, ~1GB RAM, fastest, budget phones
   - `Llama-3.2-1B-Instruct-q4f16_1-MLC` — 700MB, ~2GB RAM, **DEFAULT ⭐**, best balance
   - `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` — 900MB, ~2GB RAM, best for Hindi/multilingual content 🇮🇳
   - `Llama-3.2-3B-Instruct-q4f16_1-MLC` — 1.8GB, ~4GB RAM, highest quality, tablets only

**Relevant Context**:
- `app/vite.config.ts` lines 1–53
- `app/package.json` dependencies section
- WebLLM uses OPFS (browser cache) — model survives app reinstall, no re-download

**Status**: [ ] pending

---

### Sub-Task 3: Wire Local LLM into aiService.ts

**Intent**: Add `'local'` as a 5th provider branch in `aiService.ts`. Text chat calls go through `webllmEngine.ts`. Image extraction falls back to Tesseract.js (already in the project) since local models don't support vision. All existing provider logic is unchanged.

**Expected Outcomes**:
- `VITE_AI_PROVIDER=local` (or localStorage `aiProvider: 'local'`) routes all text AI calls through WebLLM
- Image extraction when provider is `'local'` uses Tesseract.js OCR (instead of vision API)
- A helpful error is thrown if the user selects `'local'` but has not downloaded a model yet

**Todo List**:
1. In `aiService.ts`, update the `PROVIDER` read to pull from `localStorage` at call time:
   ```ts
   function getProvider() {
     try {
       const s = JSON.parse(localStorage.getItem('sanju_settings') || '{}');
       return s.aiProvider || import.meta.env.VITE_AI_PROVIDER || 'mock';
     } catch { return 'mock'; }
   }
   ```
2. Add a `callLocalLLMChat(prompt: string)` function in `aiService.ts`:
   - Calls `getEngine()` from `webllmEngine.ts`
   - Throws a user-friendly error if engine is null: "Please download a local AI model first in Settings → Local AI"
   - Calls `engine.chat.completions.create({ messages: [{ role: 'user', content: prompt }], temperature: 0.2 })`
   - Returns the text response
3. In `analyzeExtractedText`, `generateStudyGuide`, `generateExamPlan`, `generateQuestionPaper`, `chatWithAssistant`: add `else if (PROVIDER === 'local') raw = await callLocalLLMChat(prompt)` branch
4. In `extractTextFromImage`: when provider is `'local'`, use Tesseract.js OCR instead of vision API:
   ```ts
   if (PROVIDER === 'local') {
     // Reuse the same Tesseract worker approach as scanned PDF fallback
     return extractTextFromImageWithOCR(file);
   }
   ```
5. Update the type union: `'mock' | 'openai' | 'anthropic' | 'watsonx' | 'local'`

**Relevant Context**:
- `app/src/services/aiService.ts` lines 20–21, 98–123, 179–192, 223–240
- Tesseract.js OCR is already used for scanned PDFs (lines 60–82) — reuse the same `createWorker` pattern
- `callLocalLLMChat` reuses WebLLM's OpenAI-compatible interface — minimal new code

**Status**: [ ] pending

---

### Sub-Task 4: Settings UI — Local AI Section with Model Catalogue

**Intent**: Replace the existing cosmetic Settings dropdown with a fully functional Local AI section that shows available models, their sizes, RAM requirements, download status, and a download/delete button. Cloud provider options are still accessible but clearly secondary.

**Expected Outcomes**:
- Settings page shows a "Local AI (Free, On-Device)" option prominently
- When selected, a model catalogue card appears showing 3–4 models with size, RAM, and a download button
- Download progress is shown with a progress bar (0–100%)
- Already-downloaded models show "Ready ✓" with an optional "Delete" button to free space
- Cloud providers (OpenAI, Anthropic, watsonx) remain in a collapsible "Cloud AI" section
- All selections persist via SettingsContext (Sub-Task 1)

**Todo List**:
1. In `app/src/pages/Settings.tsx`, import `ENGINE_MODELS`, `initEngine`, `isModelCached` from `webllmEngine.ts`
2. Add state: `downloadProgress: Record<string, number>`, `downloadingId: string | null`, `cachedModels: string[]`
3. On component mount, call `isModelCached(id)` for each model in `ENGINE_MODELS` and populate `cachedModels`
4. Add a "Local AI (Free, On-Device) ⭐" option to the provider dropdown — first in the list, highlighted in green
5. Conditionally render a model catalogue card when `aiProvider === 'local'`:
   - Each model row: name, description badge ("Fast", "Balanced", "Best Quality"), size, RAM required, status chip
   - Pre-select `Llama-3.2-1B` as the default `localModelId` if none is saved
   - Add a 🇮🇳 "Hindi/Regional" badge on the Qwen2.5-1.5B card
   - "Download" button triggers `initEngine(modelId, (p) => setDownloadProgress(id, p.progress))`
   - Progress bar fills during download
   - "Ready ✓" + "Delete" button shown for cached models
   - Selecting a cached model sets `localModelId` in SettingsContext
6. Add an info box: "Models are downloaded once and stored on your device. No internet needed after download."
7. Add a "⚠ Storage" note showing approximate total size if all models were downloaded

**Relevant Context**:
- `app/src/pages/Settings.tsx` — full file (112 lines), replace provider card section
- `ENGINE_MODELS` constant from Sub-Task 2 provides all metadata needed for the UI
- Tailwind classes already available (`.card`, `.btn-primary`, `.select`, `.input`, `.label`)

**Status**: [ ] pending

---

### Sub-Task 5: WebGPU Fallback Detection and User Guidance

**Intent**: Not all Android devices support WebGPU (older phones, Firefox, Samsung Internet). Detect capability on app load, show a clear message in Settings if WebGPU is unavailable, and suggest either a smaller WASM-based model or a cloud provider as an alternative.

**Expected Outcomes**:
- At app startup, check `navigator.gpu` — store result in SettingsContext
- In Settings, if WebGPU is unavailable, the Local AI option shows a "Not supported on this device" badge
- A guidance card explains: "Your browser doesn't support local AI. Try Chrome on Android, or use a free cloud provider."
- If WebGPU is available but low-memory device is detected (heuristic: `navigator.deviceMemory < 4`), only the smallest model (SmolLM2-360M) is shown as recommended

**Todo List**:
1. Compute `webGpuSupported` and `deviceMemoryGB` on the fly in Settings (not persisted to storage)
2. In `Settings.tsx`, on mount:
   ```ts
   const gpuSupported = !!navigator.gpu;
   const memGB = (navigator as any).deviceMemory ?? 4; // Navigator.deviceMemory API
   ```
3. If `!gpuSupported`: show a yellow warning card inside the Local AI section, disable Download buttons, suggest cloud providers
4. If `memGB < 4`: auto-mark the 3B model as "Not recommended for this device"
5. Update the Privacy section in Settings to add: "✓ Local AI: your documents never leave your device"
6. Add one-time Dashboard banner (Sub-Task 5b): check `sanju_local_ai_banner_dismissed` in localStorage; if absent, render a dismissible blue banner at top of Dashboard: "✨ Try Free Local AI — works offline, no subscription → Settings". On dismiss, write the key so it never shows again.

**Relevant Context**:
- `Navigator.deviceMemory` API is available in Chrome for Android — returns 0.25, 0.5, 1, 2, 4, 8 (rounded)
- `navigator.gpu` is the WebGPU availability check
- `app/src/pages/Settings.tsx` lines 55–79 (Privacy section — good place to add local AI privacy badge)

**Status**: [ ] pending

---

### Sub-Task 6: Update Docs and README

**Intent**: Update `.env.example` and `README.md` so developers and users understand the new provider options, model sizes, and Android setup instructions.

**Expected Outcomes**:
- `.env.example` documents `VITE_AI_PROVIDER=local` with a comment explaining it uses on-device WebLLM
- `README.md` has a new "Local AI (Android / Offline)" section with: requirements (Chrome 121+), model options table, storage requirements, and first-time setup steps

**Todo List**:
1. Update `app/.env.example`: add `VITE_AI_PROVIDER=local` option with comments
2. Update `SanjuClass1/Requirement.md`: add Phase 2 feature description for local LLM
3. Update `app/README.md`: add "Local AI Setup" section with model comparison table

**Relevant Context**:
- `app/.env.example`
- `app/README.md`
- `SanjuClass1/Requirement.md`

**Status**: [ ] pending

---

## Key Technical Decisions

| Decision | Choice | Reason |
|---|---|---|
| In-browser LLM library | **WebLLM** (`@mlc-ai/web-llm`) | Works on Android Chrome 121+ via WebGPU; OpenAI-compatible API; models auto-cached in OPFS |
| Model size range | **360MB – 1.8GB** | Fits mid-range Android phones; 3B model for tablets with 4GB+ RAM |
| Image OCR for local mode | **Tesseract.js** (already installed) | Local models don't support vision; Tesseract already works in-browser |
| Settings persistence | **localStorage** key `sanju_settings` | Consistent with AuthContext pattern; simple, no backend needed |
| Fallback for no WebGPU | Show guidance, suggest cloud | Don't break the app — graceful degradation |

## Files Changed

| File | Change Type |
|---|---|
| `app/src/types/index.ts` | Add `AppSettings` interface |
| `app/src/contexts/SettingsContext.tsx` | **New file** — localStorage-backed settings context |
| `app/src/App.tsx` | Wrap with `<SettingsProvider>` |
| `app/src/pages/Settings.tsx` | Rewrite provider section + add model catalogue |
| `app/src/services/aiService.ts` | Add `'local'` provider branch + runtime provider read |
| `app/src/services/webllmEngine.ts` | **New file** — WebLLM engine singleton + model catalogue |
| `app/vite.config.ts` | Add COOP/COEP headers |
| `app/package.json` | Add `@mlc-ai/web-llm` dependency |
| `app/.env.example` | Document `local` provider option |
| `app/README.md` | Add Local AI section |
