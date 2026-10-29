import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Key, Server, Shield, Bell, Download, Trash2, CheckCircle, AlertTriangle, Cpu, Loader2, Globe, MonitorSmartphone } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { ENGINE_MODELS, initEngine, isModelCached, deleteModelCache, getLoadedModelId } from '../services/webllmEngine';
import { testAIConnection } from '../services/aiService';
import type { AIProvider } from '../types';

// Settings storage key for the notifications flag
const NOTIF_KEY = 'sanju_notifications_enabled';

export function Settings() {
  const { settings, updateSettings } = useSettings();
  const [saved, setSaved] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Free OpenRouter models — no credit card needed
  const OPENROUTER_FREE_MODELS = [
    { id: 'google/gemma-3-12b-it:free',       label: 'Gemma 3 12B (Google) — best free quality' },
    { id: 'google/gemma-3-4b-it:free',        label: 'Gemma 3 4B (Google) — faster, lighter' },
    { id: 'meta-llama/llama-3.2-3b-instruct:free', label: 'LLaMA 3.2 3B (Meta)' },
    { id: 'meta-llama/llama-3.1-8b-instruct:free', label: 'LLaMA 3.1 8B (Meta) — strong reasoning' },
    { id: 'mistralai/mistral-7b-instruct:free',    label: 'Mistral 7B — good for multilingual' },
    { id: 'qwen/qwen-2.5-7b-instruct:free',        label: 'Qwen 2.5 7B — great for Hindi/regional text' },
    { id: 'microsoft/phi-3-mini-128k-instruct:free', label: 'Phi-3 Mini (Microsoft) — very fast' },
  ];

  // Popular Ollama models
  const OLLAMA_MODELS = [
    { id: 'gemma3',       label: 'Gemma 3 (Google) — recommended' },
    { id: 'llama3.2',     label: 'LLaMA 3.2 3B (Meta)' },
    { id: 'llama3.1',     label: 'LLaMA 3.1 8B (Meta)' },
    { id: 'mistral',      label: 'Mistral 7B' },
    { id: 'qwen2.5',      label: 'Qwen 2.5 7B — good for Hindi' },
    { id: 'phi3',         label: 'Phi-3 Mini (Microsoft) — very fast' },
    { id: 'deepseek-r1',  label: 'DeepSeek R1 — strong reasoning' },
  ];

  // Local draft state — committed on Save
  const [draft, setDraft] = useState({
    aiProvider: settings.aiProvider,
    apiKey: settings.apiKey,
    localModelId: settings.localModelId,
    ollamaUrl: settings.ollamaUrl ?? 'http://localhost:11434',
    ollamaModel: settings.ollamaModel ?? 'gemma3',
    openRouterModel: settings.openRouterModel ?? 'google/gemma-3-12b-it:free',
    notifications: localStorage.getItem(NOTIF_KEY) !== 'false',
  });

  // WebGPU / device capability (computed once on mount, not persisted)
  const [gpuSupported, setGpuSupported] = useState<boolean | null>(null);
  const deviceMemoryGB: number = (navigator as any).deviceMemory ?? 4;

  // Per-model download state
  const [cachedModels, setCachedModels] = useState<Record<string, boolean>>({});
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Check WebGPU availability and cached models on mount
  useEffect(() => {
    setGpuSupported(!!navigator.gpu);

    // Check which models are already cached
    Promise.all(
      ENGINE_MODELS.map(async m => ({ id: m.id, cached: await isModelCached(m.id) }))
    ).then(results => {
      const map: Record<string, boolean> = {};
      results.forEach(r => { map[r.id] = r.cached; });
      setCachedModels(map);
    });
  }, []);

  const handleDownload = async (modelId: string) => {
    if (downloadingId) return; // already downloading
    setDownloadingId(modelId);
    setDownloadError(null);
    setDownloadProgress(p => ({ ...p, [modelId]: 0 }));
    try {
      await initEngine(modelId, (progress, _text) => {
        setDownloadProgress(p => ({ ...p, [modelId]: Math.round(progress * 100) }));
      });
      setCachedModels(p => ({ ...p, [modelId]: true }));
      setDownloadProgress(p => ({ ...p, [modelId]: 100 }));
      // Auto-select the downloaded model
      setDraft(d => ({ ...d, localModelId: modelId }));
    } catch (e) {
      setDownloadError(`Download failed: ${(e as Error).message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (modelId: string) => {
    try {
      await deleteModelCache(modelId);
      setCachedModels(p => ({ ...p, [modelId]: false }));
      setDownloadProgress(p => ({ ...p, [modelId]: 0 }));
      // If this was the selected model, fall back to default
      if (draft.localModelId === modelId) {
        const defaultModel = ENGINE_MODELS.find(m => m.isDefault)?.id ?? ENGINE_MODELS[0].id;
        setDraft(d => ({ ...d, localModelId: defaultModel }));
      }
    } catch (e) {
      setDownloadError(`Delete failed: ${(e as Error).message}`);
    }
  };

  const handleSave = () => {
    updateSettings({
      aiProvider: draft.aiProvider,
      apiKey: draft.apiKey,
      localModelId: draft.localModelId,
      ollamaUrl: draft.ollamaUrl,
      ollamaModel: draft.ollamaModel,
      openRouterModel: draft.openRouterModel,
    });
    // Persist the notifications preference independently
    localStorage.setItem(NOTIF_KEY, String(draft.notifications));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const totalStorageMB = ENGINE_MODELS.reduce((sum, m) => sum + m.sizeMB, 0);

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── AI Provider ─────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Server className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">AI Provider Configuration</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">AI Provider</label>
            <select
              className="select"
              value={draft.aiProvider}
              onChange={e => setDraft(d => ({ ...d, aiProvider: e.target.value as AIProvider, }))}
            >
              <optgroup label="── Free (recommended) ───────────────">
                <option value="local">⭐ Local AI (On-Device) — 100% free, works offline</option>
                <option value="openrouter">🌐 OpenRouter Free Tier — free key, no credit card</option>
                <option value="ollama">🦙 Ollama (Self-Hosted) — free, run on your PC/Mac</option>
                <option value="mock">🧪 Mock — fake responses for testing</option>
              </optgroup>
              <optgroup label="── Paid cloud providers ─────────────">
                <option value="openai">OpenAI (GPT-4o mini) — paid</option>
                <option value="anthropic">Anthropic (Claude Haiku) — paid</option>
                <option value="watsonx">IBM watsonx.ai — paid</option>
              </optgroup>
            </select>
            {draft.aiProvider === 'mock' && (
              <p className="text-xs text-green-600 mt-1">✓ Using mock AI responses. No API key required.</p>
            )}
            {draft.aiProvider === 'local' && (
              <p className="text-xs text-green-600 mt-1">✓ AI runs entirely on your device. No internet needed after model download.</p>
            )}
            {draft.aiProvider === 'ollama' && (
              <p className="text-xs text-green-600 mt-1">✓ Runs on your own machine — completely free, no API key needed.</p>
            )}
            {draft.aiProvider === 'openrouter' && (
              <p className="text-xs text-blue-600 mt-1">✓ Free API key — no credit card required for free-tier models.</p>
            )}
          </div>

          {/* ── Ollama config ──────────────────────────────────────── */}
          {draft.aiProvider === 'ollama' && (
            <div className="space-y-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <MonitorSmartphone className="w-4 h-4 text-green-700" />
                <span className="text-sm font-medium text-green-800">Ollama — Free, Self-Hosted</span>
              </div>
              <p className="text-xs text-green-700">
                Install <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="underline font-medium">ollama.ai</a> on your PC/Mac, then run <code className="bg-green-100 px-1 rounded">ollama pull gemma3</code> in a terminal.
              </p>
              <div>
                <label className="label">Server URL</label>
                <input
                  type="text"
                  className="input"
                  placeholder="http://localhost:11434"
                  value={draft.ollamaUrl}
                  onChange={e => setDraft(d => ({ ...d, ollamaUrl: e.target.value }))}
                />
                <p className="text-xs text-gray-400 mt-1">Default: http://localhost:11434 — change if running on a different device.</p>
              </div>
              <div>
                <label className="label">Model</label>
                <select
                  className="select"
                  value={draft.ollamaModel}
                  onChange={e => setDraft(d => ({ ...d, ollamaModel: e.target.value }))}
                >
                  {OLLAMA_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Pull the model first: <code className="bg-gray-100 px-1 rounded">ollama pull {draft.ollamaModel}</code>
                </p>
              </div>
              <button
                type="button"
                disabled={testingConnection}
                onClick={async () => {
                  setTestingConnection(true);
                  setTestResult(null);
                  const res = await testAIConnection(draft.aiProvider, '');
                  setTestResult(res);
                  setTestingConnection(false);
                }}
                className="text-xs text-green-700 hover:text-green-900 font-medium flex items-center gap-1 disabled:opacity-50"
              >
                {testingConnection ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Test Connection
              </button>
              {testResult && (
                <div className={`p-2 rounded text-xs flex items-center gap-1.5 ${testResult.success ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {testResult.success ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          )}

          {/* ── OpenRouter free-tier config ────────────────────────── */}
          {draft.aiProvider === 'openrouter' && (
            <div className="space-y-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-700" />
                <span className="text-sm font-medium text-blue-800">OpenRouter — Free Tier</span>
              </div>
              <p className="text-xs text-blue-700">
                Sign up free at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="underline font-medium">openrouter.ai/keys</a> — no credit card needed for free models.
              </p>
              <div>
                <label className="label">Free Model</label>
                <select
                  className="select"
                  value={draft.openRouterModel}
                  onChange={e => setDraft(d => ({ ...d, openRouterModel: e.target.value }))}
                >
                  {OPENROUTER_FREE_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">All models ending in <code className="bg-gray-100 px-1 rounded">:free</code> are completely free to use.</p>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="label">OpenRouter API Key</label>
                  <button
                    type="button"
                    disabled={testingConnection || !draft.apiKey.trim()}
                    onClick={async () => {
                      setTestingConnection(true);
                      setTestResult(null);
                      const res = await testAIConnection(draft.aiProvider, draft.apiKey);
                      setTestResult(res);
                      setTestingConnection(false);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 disabled:opacity-50"
                  >
                    {testingConnection ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Test Key
                  </button>
                </div>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    className="input pl-9"
                    placeholder="sk-or-v1-…"
                    value={draft.apiKey}
                    onChange={e => { setDraft(d => ({ ...d, apiKey: e.target.value })); setTestResult(null); }}
                  />
                </div>
                {testResult && (
                  <div className={`mt-2 p-2 rounded text-xs flex items-center gap-1.5 ${testResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {testResult.success ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                    <span>{testResult.message}</span>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">Your key is stored only in your browser — never sent to our servers.</p>
              </div>
            </div>
          )}

          {/* ── Paid cloud API key ─────────────────────────────────── */}
          {(draft.aiProvider === 'openai' || draft.aiProvider === 'anthropic') && (
            <div>
              <div className="flex items-center justify-between">
                <label className="label">API Key</label>
                <button
                  type="button"
                  disabled={testingConnection || !draft.apiKey.trim()}
                  onClick={async () => {
                    setTestingConnection(true);
                    setTestResult(null);
                    const res = await testAIConnection(draft.aiProvider, draft.apiKey);
                    setTestResult(res);
                    setTestingConnection(false);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 disabled:opacity-50"
                >
                  {testingConnection ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Test Key Connection
                </button>
              </div>
              <div className="relative">
                <Key className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  className="input pl-9"
                  placeholder="Enter your API key"
                  value={draft.apiKey}
                  onChange={e => {
                    setDraft(d => ({ ...d, apiKey: e.target.value }));
                    setTestResult(null);
                  }}
                />
              </div>
              {testResult && (
                <div className={`mt-2 p-2 rounded text-xs flex items-center gap-1.5 ${testResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {testResult.success ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">API keys are stored only in your browser and never sent to our servers.</p>
            </div>
          )}

          {/* ── Local AI model catalogue ───────────────────────────── */}
          {draft.aiProvider === 'local' && (
            <div className="mt-2 space-y-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-800">Choose a model to download</span>
              </div>

              {/* WebGPU not supported warning */}
              {gpuSupported === false && (
                <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-yellow-500" />
                  <div>
                    <p className="font-medium">Local AI is not supported on this browser</p>
                    <p className="text-xs mt-1">WebGPU is required. Please use <strong>Chrome 121+</strong> on Android, or choose a cloud provider above.</p>
                  </div>
                </div>
              )}

              {downloadError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{downloadError}</span>
                </div>
              )}

              {/* Model cards */}
              <div className="space-y-2">
                {ENGINE_MODELS.map(model => {
                  const isCached = cachedModels[model.id] ?? false;
                  const isDownloading = downloadingId === model.id;
                  const progress = downloadProgress[model.id] ?? 0;
                  const isSelected = draft.localModelId === model.id;
                  const isLowRam = deviceMemoryGB < model.ramGB;
                  const isCurrentlyLoaded = getLoadedModelId() === model.id;

                  return (
                    <div
                      key={model.id}
                      onClick={() => isCached && setDraft(d => ({ ...d, localModelId: model.id }))}
                      className={[
                        'border rounded-lg p-3 transition-colors',
                        isCached ? 'cursor-pointer' : 'cursor-default',
                        isSelected && isCached
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300',
                        isLowRam ? 'opacity-60' : '',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-1.5 mb-1">
                            <span className="font-medium text-sm text-gray-900">{model.label}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{model.badge}</span>
                            {model.multilingual && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">🇮🇳 Hindi/Regional</span>
                            )}
                            {model.isDefault && !isCached && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Recommended</span>
                            )}
                            {isCurrentlyLoaded && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">● Active</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{model.description}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                            <span>📦 {model.sizeMB >= 1000 ? `${(model.sizeMB / 1000).toFixed(1)} GB` : `${model.sizeMB} MB`}</span>
                            <span>💾 {model.ramGB} GB RAM needed</span>
                            {isLowRam && <span className="text-yellow-600">⚠ Low RAM</span>}
                          </div>
                        </div>

                        {/* Action area */}
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          {isCached ? (
                            <>
                              <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Ready</span>
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); handleDelete(model.id); }}
                                className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-0.5 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </>
                          ) : isDownloading ? (
                            <div className="flex flex-col items-end gap-1 min-w-[64px]">
                              <span className="text-xs text-blue-600 font-medium">{progress}%</span>
                              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-400">Downloading…</span>
                            </div>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); handleDownload(model.id); }}
                              disabled={gpuSupported === false || !!downloadingId}
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Selection indicator */}
                      {isSelected && isCached && (
                        <div className="mt-2 pt-2 border-t border-blue-200 text-xs text-blue-700 font-medium">
                          ✓ This model will be used for AI features
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Storage info */}
              <p className="text-xs text-gray-400 mt-1">
                Models are downloaded once and stored on your device. No internet connection is needed after download. Total if all downloaded: ~{(totalStorageMB / 1000).toFixed(1)} GB.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Privacy ─────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Privacy & Security</h2>
        </div>
        <div className="space-y-3 text-sm text-gray-700">
          <div className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>All uploaded documents are stored securely and are only accessible by you.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>Your child's data is never shared with third parties.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span><strong>Local AI:</strong> your documents never leave your device — fully private, works offline.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-yellow-500 mt-0.5">⚠</span>
            <span>When using cloud AI providers, document content is sent to their APIs for processing. Use <strong>Local AI</strong> or <strong>Mock</strong> mode for sensitive documents.</span>
          </div>
        </div>
      </div>

      {/* ── Notifications ───────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Notifications</h2>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 text-blue-600 rounded"
            checked={draft.notifications}
            onChange={e => setDraft(d => ({ ...d, notifications: e.target.checked }))}
          />
          <span className="text-sm text-gray-700">Enable exam reminder notifications</span>
        </label>
      </div>

      {/* ── About ───────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <SettingsIcon className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">About</h2>
        </div>
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>AI School Learning Assistant</strong> v1.0</p>
          <p>An AI-powered companion that helps parents organise school learning materials and support their child's education.</p>
          <p className="text-xs text-gray-400 mt-2">Phase 1 MVP · Built with React + TypeScript + Tailwind CSS</p>
        </div>
      </div>

      <button onClick={handleSave} className="btn-primary w-full flex items-center justify-center gap-2">
        {saved ? '✓ Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}
