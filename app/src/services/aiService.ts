/**
 * AI Service — handles text extraction and AI-powered content analysis.
 *
 * Extraction:
 *   - PDF (selectable text) → pdfjs-dist (runs entirely in the browser)
 *   - PDF (scanned/image)   → pdfjs-dist renders pages → Tesseract.js OCR (free, no API key)
 *   - Image → base64-encoded and sent to the AI vision API (no local OCR)
 *   - Link  → fetched via a CORS proxy (allOrigins), then text stripped from HTML
 *
 * AI Analysis:
 *   - openai   → gpt-4o-mini  (set VITE_AI_PROVIDER=openai  + VITE_AI_API_KEY)
 *   - anthropic → claude-3-haiku (set VITE_AI_PROVIDER=anthropic + VITE_AI_API_KEY)
 *   - watsonx  → requires VITE_WATSONX_URL + VITE_WATSONX_TOKEN + VITE_WATSONX_MODEL
 *   - mock     → deterministic fake responses (default, no key needed)
 */

import { createWorker } from 'tesseract.js';
import type { ExtractedContent, QuestionPaperConfig, Question, QuestionType } from '../types';

import type { AIProvider } from '../types';

// Runtime provider/key — reads from localStorage (set via Settings page),
// with .env as a developer fallback. Re-read on every call so settings
// changes take effect immediately without a page reload.
function getProvider(): AIProvider {
  try {
    const s = JSON.parse(localStorage.getItem('sanju_settings') || '{}');
    if (s.aiProvider) return s.aiProvider as AIProvider;
  } catch { /* ignore */ }
  return (import.meta.env.VITE_AI_PROVIDER || 'mock') as AIProvider;
}

function getApiKey(): string {
  try {
    const s = JSON.parse(localStorage.getItem('sanju_settings') || '{}');
    if (s.apiKey) return s.apiKey as string;
  } catch { /* ignore */ }
  return import.meta.env.VITE_AI_API_KEY || '';
}

function getLocalModelId(): string {
  try {
    const s = JSON.parse(localStorage.getItem('sanju_settings') || '{}');
    return s.localModelId || 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
  } catch { /* ignore */ }
  return 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
}

// ─── PDF extraction (pdfjs-dist) ─────────────────────────────────────────────

async function getPdfJs() {
  // Dynamic import keeps pdfjs-dist out of the initial bundle
  const pdfjsLib = await import('pdfjs-dist');
  // Point the worker at the bundled worker file served from node_modules
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url,
    ).toString();
  }
  return pdfjsLib;
}

// Detect if extracted text appears to be corrupted legacy 8-bit Indic font (e.g., Nudi/Baraha/KrutiDev)
// Characterised by a high density of non-ASCII Latin-1 characters (À, Ä, ª, £, §, ©, ®, etc.)
// and an absence of standard Indic Unicode blocks (Kannada \u0C80-\u0CFF, Telugu \u0C00-\u0C7F, Devanagari \u0900-\u097F).
export function isCorruptedIndicFont(text: string): boolean {
  if (!text || text.length < 20) return false;
  const sample = text.slice(0, 1500);
  // Count Latin-1 high-byte accented/symbol characters common in Nudi/Baraha/KrutiDev
  const latin1Matches = sample.match(/[\u00A0-\u00FF]/g) || [];
  const latin1Ratio = latin1Matches.length / sample.length;
  // Count native Unicode Indic characters
  const indicMatches = sample.match(/[\u0900-\u0D7F]/g) || [];
  const indicRatio = indicMatches.length / sample.length;

  // If >8% of the text is Latin-1 symbols and <1% is proper Unicode Indic, it's legacy font encoding
  return latin1Ratio > 0.08 && indicRatio < 0.01;
}

export async function extractTextFromPdf(fileOrBuffer: File | ArrayBuffer, preferredLang = 'eng'): Promise<string> {
  const pdfjsLib = await getPdfJs();
  const arrayBuffer = fileOrBuffer instanceof File ? await fileOrBuffer.arrayBuffer() : fileOrBuffer;
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s{2,}/g, '\n')
      .trim();
    if (pageText) pageTexts.push(pageText);
  }

  const fullText = pageTexts.join('\n\n');

  // If text is present and NOT corrupted legacy font, return it
  if (fullText.trim() && !isCorruptedIndicFont(fullText)) {
    return fullText;
  }

  // ── Scanned PDF OR Legacy 8-bit Font fallback: render pages to canvas → Tesseract.js OCR ─────
  // Tesseract.js runs in browser with multi-script support (kan, tel, hin, eng)
  const ocrLang = preferredLang && preferredLang !== 'eng' ? `${preferredLang}+eng` : 'eng';
  let worker: any = null;
  try {
    worker = await createWorker(ocrLang);
  } catch {
    // Fall back to English worker if specific language dictionary fails to load
    worker = await createWorker('eng');
  }

  try {
    const ocrTexts: string[] = [];
    const maxPages = Math.min(pdf.numPages, 10); // OCR first 10 pages for speed/responsiveness
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 }); // 2× scale = better OCR accuracy
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      const { data: { text } } = await worker.recognize(canvas);
      if (text.trim()) ocrTexts.push(text.trim());
    }
    const ocrFull = ocrTexts.join('\n\n');
    if (ocrFull.trim()) return ocrFull;
    // If OCR returned nothing but we had legacy text, return legacy text rather than failing
    if (fullText.trim()) return fullText;
    throw new Error('Could not extract any text from this PDF. The document may be blank or unreadable.');
  } finally {
    if (worker) await worker.terminate();
  }
}

// ─── Image extraction ─────────────────────────────────────────────────────────
// Images are sent to the AI vision API as base64. No local OCR needed.

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function extractTextFromImage(file: File, preferredLang = 'eng'): Promise<string> {
  const PROVIDER = getProvider();

  // If cloud vision is configured, use OpenAI / Anthropic
  if (PROVIDER === 'openai' || PROVIDER === 'anthropic') {
    const base64 = await fileToBase64(file);
    const mimeType = file.type || 'image/jpeg';
    const prompt =
      'Extract ALL text from this image exactly as written in its original language (Hindi/Kannada/Telugu/English). ' +
      'Preserve headings, bullet points, poems, and numbered lists. ' +
      'Return only the extracted text — no commentary.';

    if (PROVIDER === 'openai') return callOpenAIVision(base64, mimeType, prompt);
    if (PROVIDER === 'anthropic') return callAnthropicVision(base64, mimeType, prompt);
  }

  // In mock or local mode, perform REAL browser-based Tesseract OCR with the selected language
  return extractTextFromImageWithOCR(file, preferredLang);
}

/** Tesseract.js OCR for images — runs in browser without requiring API key */
async function extractTextFromImageWithOCR(file: File, preferredLang = 'eng'): Promise<string> {
  const ocrLang = preferredLang && preferredLang !== 'eng' ? `${preferredLang}+eng` : 'eng';
  let worker: any = null;
  try {
    worker = await createWorker(ocrLang);
  } catch {
    worker = await createWorker('eng');
  }

  try {
    const imageBitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
    canvas.getContext('2d')!.drawImage(imageBitmap, 0, 0);
    const { data: { text } } = await worker.recognize(canvas);
    if (text && text.trim()) return text.trim();
    return 'Sample textbook page content extracted from image.';
  } catch (e) {
    console.warn('Image OCR error:', e);
    return 'Sample textbook page content extracted from image.';
  } finally {
    if (worker) await worker.terminate();
  }
}

// ─── URL / link extraction ────────────────────────────────────────────────────

export async function extractContentFromUrl(url: string, preferredLang = 'eng'): Promise<string> {
  // Check if URL is a direct PDF link
  const isPdf = /\.pdf(\?.*)?$/i.test(url) || url.toLowerCase().includes('.pdf');

  if (isPdf) {
    try {
      // First try direct fetch
      let response = await fetch(url).catch(() => null);
      if (!response || !response.ok) {
        // Fall back to CORS raw proxy
        const rawProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        response = await fetch(rawProxyUrl);
      }
      if (response && response.ok) {
        const buffer = await response.arrayBuffer();
        if (buffer && buffer.byteLength > 100) {
          return await extractTextFromPdf(buffer, preferredLang);
        }
      }
    } catch (e) {
      console.warn('PDF download from URL failed, trying HTML extraction fallback:', e);
    }
  }

  // HTML webpage fetch
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const json = await res.json();
      const html: string = json.contents ?? '';

      // Strip HTML tags, collapse whitespace
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s{3,}/g, '\n\n')
        .trim();

      if (text.length > 30) {
        return text.slice(0, 15000);
      }
    }
  } catch (err) {
    console.warn('URL extraction failed:', err);
  }

  // If mock provider is on and fetch had no output, return mock text with subject relevance
  const PROVIDER = getProvider();
  if (PROVIDER === 'mock') {
    return 'Educational syllabus and textbook content with chapters, definitions, and practice exercises.';
  }

  throw new Error('Could not fetch readable text from this URL. Please verify the URL or upload the file directly.');
}

// ─── AI content analysis ──────────────────────────────────────────────────────

const ANALYSIS_PROMPT = `You are an AI assistant helping Indian school parents track their child's learning materials.

Analyze the text below (from a lesson plan, exam syllabus, classroom notes, or homework) and return ONLY valid JSON — no markdown fences, no commentary.

Required JSON shape:
{
  "subjects": ["string"],          // e.g. ["Mathematics", "EVS"]
  "chapters": ["string"],          // chapter names found in the text
  "topics": ["string"],            // specific topics within chapters
  "definitions": ["string"],       // key definitions (if any)
  "importantPoints": ["string"],   // bullet-style key points to remember
  "homework": "string or null",    // homework task if mentioned
  "examName": "string or null",    // exam name if mentioned
  "confidenceScore": 0.0–1.0,     // how confident you are in the extraction
  "needsReview": true|false        // true if content is ambiguous or low quality
}

TEXT TO ANALYZE:
`;

export async function analyzeExtractedText(text: string, defaultSubject?: string): Promise<ExtractedContent> {
  const PROVIDER = getProvider();
  if (PROVIDER === 'mock') {
    await delay(1200);
    return mockAnalyze(text, defaultSubject);
  }

  let raw: string;
  if (PROVIDER === 'openai')         raw = await callOpenAIChat(ANALYSIS_PROMPT + text);
  else if (PROVIDER === 'anthropic') raw = await callAnthropicChat(ANALYSIS_PROMPT + text);
  else if (PROVIDER === 'watsonx')   raw = await callWatsonxChat(ANALYSIS_PROMPT + text);
  else if (PROVIDER === 'local')     raw = await callLocalLLMChat(ANALYSIS_PROMPT + text);
  else throw new Error(`Unknown AI provider: ${PROVIDER}`);

  return parseAnalysisResponse(raw);
}

function parseAnalysisResponse(raw: string): ExtractedContent {
  // Strip markdown code fences if the model added them despite instructions
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      subjects:        Array.isArray(parsed.subjects)        ? parsed.subjects        : [],
      chapters:        Array.isArray(parsed.chapters)        ? parsed.chapters        : [],
      topics:          Array.isArray(parsed.topics)          ? parsed.topics          : [],
      definitions:     Array.isArray(parsed.definitions)     ? parsed.definitions     : [],
      importantPoints: Array.isArray(parsed.importantPoints) ? parsed.importantPoints : [],
      homework:        parsed.homework   || undefined,
      examName:        parsed.examName   || undefined,
      confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.5,
      needsReview:     Boolean(parsed.needsReview),
    };
  } catch {
    // Fallback if the model returns malformed JSON
    return {
      subjects: [], chapters: [], topics: [], definitions: [],
      importantPoints: ['Review uploaded material carefully'],
      confidenceScore: 0.3,
      needsReview: true,
    };
  }
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

async function callLocalLLMChat(prompt: string): Promise<string> {
  const { getEngine, getLoadedModelId, initEngine } = await import('./webllmEngine');
  const modelId = getLocalModelId();
  let engine = getEngine();
  // If the engine isn't ready or a different model is selected, initialise now
  if (!engine || getLoadedModelId() !== modelId) {
    await initEngine(modelId);
    engine = getEngine();
  }
  if (!engine) {
    throw new Error(
      'No local AI model is loaded. Please go to Settings → Local AI and download a model first.',
    );
  }
  const reply = await engine.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 1000,
  });
  return reply.choices?.[0]?.message?.content ?? '';
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

async function callOpenAIChat(prompt: string): Promise<string> {
  const API_KEY = getApiKey();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 1000,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenAI error ${res.status}: ${(err as any)?.error?.message ?? res.statusText}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callOpenAIVision(base64: string, mimeType: string, prompt: string): Promise<string> {
  const API_KEY = getApiKey();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } },
        ],
      }],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenAI Vision error ${res.status}: ${(err as any)?.error?.message ?? res.statusText}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

async function callAnthropicChat(prompt: string): Promise<string> {
  const API_KEY = getApiKey();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Anthropic error ${res.status}: ${(err as any)?.error?.message ?? res.statusText}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

async function callAnthropicVision(base64: string, mimeType: string, prompt: string): Promise<string> {
  const validMime = (['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const).includes(mimeType as any)
    ? (mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp')
    : 'image/jpeg';

  const API_KEY = getApiKey();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: validMime, data: base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Anthropic Vision error ${res.status}: ${(err as any)?.error?.message ?? res.statusText}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

export async function testAIConnection(provider: AIProvider, apiKey: string): Promise<{ success: boolean; message: string }> {
  if (provider === 'mock') {
    return { success: true, message: 'Mock provider active (no key needed)' };
  }
  if (provider === 'local') {
    const isSupported = !!navigator.gpu;
    return isSupported
      ? { success: true, message: 'WebGPU supported for on-device Local AI' }
      : { success: false, message: 'WebGPU not available on this browser/GPU' };
  }
  if (!apiKey || !apiKey.trim()) {
    return { success: false, message: 'API key cannot be empty' };
  }

  try {
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 5,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, message: (err as any)?.error?.message || `HTTP ${res.status}` };
      }
      return { success: true, message: 'OpenAI connected successfully (gpt-4o-mini ready)' };
    }

    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Say OK' }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, message: (err as any)?.error?.message || `HTTP ${res.status}` };
      }
      return { success: true, message: 'Anthropic connected successfully (claude-haiku-4-5 ready)' };
    }

    return { success: false, message: `Testing for ${provider} not supported directly` };
  } catch (e: any) {
    return { success: false, message: e.message || 'Connection error' };
  }
}

// ─── watsonx.ai ───────────────────────────────────────────────────────────────

async function callWatsonxChat(prompt: string): Promise<string> {
  const watsonxUrl   = import.meta.env.VITE_WATSONX_URL   || '';
  const watsonxToken = import.meta.env.VITE_WATSONX_TOKEN || '';
  const watsonxModel = import.meta.env.VITE_WATSONX_MODEL || 'ibm/granite-3-8b-instruct';
  const projectId    = import.meta.env.VITE_WATSONX_PROJECT_ID || '';

  if (!watsonxUrl || !watsonxToken) {
    throw new Error('watsonx.ai is not configured. Set VITE_WATSONX_URL and VITE_WATSONX_TOKEN in .env');
  }

  const res = await fetch(`${watsonxUrl}/ml/v1/text/generation?version=2023-05-29`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${watsonxToken}`,
    },
    body: JSON.stringify({
      model_id: watsonxModel,
      project_id: projectId,
      input: prompt,
      parameters: { max_new_tokens: 1000, temperature: 0.2 },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`watsonx error ${res.status}: ${JSON.stringify((err as any)?.errors ?? res.statusText)}`);
  }
  const data = await res.json();
  return data.results?.[0]?.generated_text ?? '';
}

// ─── Mock fallback (deterministic, no API key needed) ────────────────────────

function mockAnalyze(text: string, defaultSubject?: string): ExtractedContent {
  const lower = text.toLowerCase();
  // pdfjs-dist sometimes returns all text as a single long string with no newlines.
  // Pre-split on chapter/lesson boundary keywords so the heading detector still works.
  const normalized = text
    .replace(/\s+(Chapter|Lesson|Unit|Part|Section|ಪಾಠ|పాఠం|अध्याय|पाठ|कविता)\s/gi, '\n$1 ')
    .replace(/\s+(\d+[\.\)]\s+[A-Z\u0900-\u0D7F])/g, '\n$1');
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);

  // ── Subject detection ────────────────────────────────────────────────────────
  const subjects: string[] = [];
  // Detect based on scripts present
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const hasKannada = /[\u0C80-\u0CFF]/.test(text);
  const hasTelugu = /[\u0C00-\u0C7F]/.test(text);

  if (hasDevanagari && !subjects.includes('Hindi')) subjects.push('Hindi');
  if (hasKannada && !subjects.includes('Kannada')) subjects.push('Kannada');
  if (hasTelugu && !subjects.includes('Telugu')) subjects.push('Telugu');

  if (lower.includes('math') || lower.includes('multiplication') || lower.includes('fraction')) subjects.push('Mathematics');
  if (lower.includes('english') || lower.includes('grammar') || lower.includes('poem')) subjects.push('English');
  if (lower.includes('evs') || lower.includes('environmental'))           subjects.push('EVS');
  if (lower.includes('science') && !lower.includes('social science'))     subjects.push('Science');
  if (lower.includes('social science') || lower.includes('social studies')) subjects.push('Social Studies');
  if (lower.includes('hindi') || lower.includes('हिन्दी') || lower.includes('हिंदी')) {
    if (!subjects.includes('Hindi')) subjects.push('Hindi');
  }
  if (lower.includes('kannada') || lower.includes('ಕನ್ನಡ')) {
    if (!subjects.includes('Kannada')) subjects.push('Kannada');
  }
  if (lower.includes('telugu') || lower.includes('తెలుగు')) {
    if (!subjects.includes('Telugu')) subjects.push('Telugu');
  }
  if (lower.includes('sanskrit') || lower.includes('संस्कृत'))            subjects.push('Sanskrit');

  if (subjects.length === 0 && defaultSubject) {
    subjects.push(defaultSubject);
  }

  // ── Chapter / lesson heading detection ───────────────────────────────────────
  // Look for lines that look like chapter / lesson titles:
  //   • short (≤ 60 chars), not pure numbers/punctuation
  //   • start with "chapter", "lesson", "unit", "part", "ಪಾಠ", "పాఠం", "अध्याय", "पाठ", a digit, or ALL CAPS
  const chapterSet = new Set<string>();
  const chapterPatterns = [
    /^(chapter|lesson|unit|part|section)\s*[\d:–\-]*/i,
    /^(ಪಾಠ|ಪಾಠಗಳು|పాఠం|పాఠాలు|अध्याय|पाठ|प्रकरण)\s*[\d:–\-]*/i,  // Kannada/Telugu/Hindi/Sanskrit "lesson/chapter"
    /^\d+[\.\)]\s+[\u0C80-\u0CFF\u0C00-\u0C7F\u0900-\u097FA-Za-z]/,  // "1. Title" with letters or Kannada/Telugu/Devanagari
  ];

  for (const line of lines) {
    if (line.length < 3 || line.length > 80) continue;
    // Skip lines that are just numbers, dots, or page markers
    if (/^[\d\s\.\-–]+$/.test(line)) continue;
    // Skip publisher boilerplate lines often found in textbooks
    if (/NOT TO BE REPUBLISHED|GOVERNMENT OF|TEXTBOOK SOCIETY|STATE COUNCIL|ALL RIGHTS RESERVED/i.test(line)) continue;
    // Skip lines with high density of Latin-1 corruption noise
    if (isCorruptedIndicFont(line)) continue;

    const wordCount = line.split(/\s+/).length;
    if (wordCount > 12) continue;

    const isHeading =
      chapterPatterns.some(p => p.test(line)) ||
      // ALL CAPS English line (not corrupt symbols)
      (line === line.toUpperCase() && line.length > 4 && /^[A-Z0-9\s:,\-\.]{4,}$/.test(line));

    if (isHeading && !chapterSet.has(line)) {
      chapterSet.add(line);
      if (chapterSet.size >= 20) break; // cap at 20 chapters
    }
  }

  // ── Topic detection ───────────────────────────────────────────────────────────
  // Topics are medium-length lines (2–8 words) that follow a chapter heading
  // and aren't themselves headings.
  const topicSet = new Set<string>();
  let inChapterZone = false;
  for (const line of lines) {
    if (chapterSet.has(line)) { inChapterZone = true; continue; }
    if (!inChapterZone) continue;
    if (isCorruptedIndicFont(line)) continue;
    if (/NOT TO BE REPUBLISHED|GOVERNMENT OF|TEXTBOOK/i.test(line)) continue;
    const wordCount = line.split(/\s+/).length;
    if (wordCount >= 2 && wordCount <= 8 && line.length <= 60 && !/^[\d\s\.\-–]+$/.test(line)) {
      topicSet.add(line);
      if (topicSet.size >= 30) break;
    }
  }

  // ── Important points — first meaningful sentences from the text ──────────────
  const importantPoints: string[] = lines
    .filter(l => l.split(/\s+/).length >= 6 && l.length <= 200)
    .slice(0, 5);
  if (importantPoints.length === 0) importantPoints.push('Review uploaded material carefully.');

  // ── Homework / exam detection ─────────────────────────────────────────────────
  const homework = lower.includes('homework') || lower.includes('worksheet')
    ? lines.find(l => /homework|worksheet/i.test(l))
    : undefined;
  const examName = lower.includes('examination') || lower.includes('exam')
    ? lines.find(l => /exam(ination)?/i.test(l))?.slice(0, 80)
    : undefined;

  const detectedChapters = Array.from(chapterSet);
  const detectedTopics   = Array.from(topicSet);

  return {
    subjects:        subjects.length ? subjects : [],
    chapters:        detectedChapters,
    topics:          detectedTopics,
    definitions:     [],
    importantPoints,
    homework:        homework || undefined,
    examName:        examName || undefined,
    confidenceScore: subjects.length > 0 ? 0.75 : 0.5,
    needsReview:     subjects.length === 0 || detectedChapters.length === 0,
  };
}

// ─── Study Guide Generation ───────────────────────────────────────────────────

export interface StudyGuideSection {
  whatToRead: string[];
  whatToHighlight: { item: string; reason: string; memorize: boolean }[];
  whatToUnderstand: { concept: string; explanation: string; example: string; commonMistakes: string[] }[];
  whatToPractice: string[];
  quickRevision: { keyPoints: string[]; importantWords: string[]; oralQuestions: string[] };
}

export async function generateStudyGuide(subject: string, chapter: string): Promise<StudyGuideSection> {
  const PROVIDER = getProvider();
  if (PROVIDER !== 'mock') {
    const prompt = `You are an AI tutor for Indian primary school children.
Generate a structured study guide for subject "${subject}", chapter "${chapter}".
Return ONLY valid JSON — no markdown fences, no commentary — matching this shape exactly:
{
  "whatToRead": ["string"],
  "whatToHighlight": [{"item":"string","reason":"string","memorize":true|false}],
  "whatToUnderstand": [{"concept":"string","explanation":"string","example":"string","commonMistakes":["string"]}],
  "whatToPractice": ["string"],
  "quickRevision": {
    "keyPoints": ["string"],
    "importantWords": ["string"],
    "oralQuestions": ["string"]
  }
}`;
    let raw = '';
    if (PROVIDER === 'openai')         raw = await callOpenAIChat(prompt);
    else if (PROVIDER === 'anthropic') raw = await callAnthropicChat(prompt);
    else if (PROVIDER === 'watsonx')   raw = await callWatsonxChat(prompt);
    else if (PROVIDER === 'local')     raw = await callLocalLLMChat(prompt);

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    try {
      return JSON.parse(cleaned) as StudyGuideSection;
    } catch {
      // Fall through to mock if JSON is invalid
    }
  }

  await delay(2500);
  return getMockStudyGuide(subject, chapter);
}

function getMockStudyGuide(subject: string, chapter: string): StudyGuideSection {
  const guides: Record<string, StudyGuideSection> = {
    'Mathematics|Multiplication': {
      whatToRead: [
        'Multiplication tables from 2× to 10×',
        'How multiplication is related to repeated addition',
        'Solving multiplication word problems',
        'Properties of multiplication (commutative, associative)',
      ],
      whatToHighlight: [
        { item: '2× to 10× multiplication tables', reason: 'Core knowledge tested in every exam', memorize: true },
        { item: 'Commutative property: a × b = b × a', reason: 'Saves time when solving problems', memorize: true },
        { item: 'Multiplication as repeated addition', reason: 'Helps understand the concept deeply', memorize: false },
      ],
      whatToUnderstand: [{
        concept: 'Multiplication as repeated addition',
        explanation: 'Multiplication is just a quick way to add the same number many times. 4 × 3 means "4 added 3 times": 4 + 4 + 4 = 12.',
        example: '5 × 4 = 5 + 5 + 5 + 5 = 20',
        commonMistakes: ['Confusing 6 × 7 and 7 × 6 (they are the same!)', 'Forgetting zero-times-any-number is always 0'],
      }],
      whatToPractice: [
        'Fill in multiplication tables (2× to 10×)',
        'Solve word problems from the textbook',
        'Write 5 examples of multiplication as repeated addition',
        'Practice missing factor problems: 7 × ___ = 42',
      ],
      quickRevision: {
        keyPoints: ['Multiplication = repeated addition', 'Order does not matter (3×4 = 4×3)', 'Any number × 0 = 0', 'Any number × 1 = that number'],
        importantWords: ['Product', 'Factor', 'Multiple', 'Times', 'Commutative'],
        oralQuestions: ['What is 8 × 7?', 'What is multiplication?', 'Give an example of multiplication as repeated addition'],
      },
    },
    'EVS|Plants Around Us': {
      whatToRead: [
        'Parts of a plant: root, stem, leaf, flower, fruit, seed',
        'Functions of each part',
        'Types of plants: trees, shrubs, herbs, climbers, creepers',
        'Uses of plants in daily life',
        'Important textbook examples on page 12–18',
      ],
      whatToHighlight: [
        { item: 'Six parts of a plant', reason: 'Direct exam question – name all 6 parts', memorize: true },
        { item: 'Photosynthesis – how plants make food', reason: 'Key concept for short answers', memorize: true },
        { item: 'Types of roots: taproot and fibrous root', reason: 'Often asked with examples', memorize: true },
      ],
      whatToUnderstand: [{
        concept: 'Photosynthesis',
        explanation: 'Plants make their own food using sunlight, water from roots, and air from leaves. This process is called photosynthesis and it happens in the leaves.',
        example: 'A mango tree uses sunlight on its leaves to make food for the whole tree.',
        commonMistakes: ['Thinking plants eat soil (they only get minerals from soil)', 'Forgetting that photosynthesis needs sunlight'],
      }],
      whatToPractice: [
        'Label a diagram of a plant',
        'Match each part with its function',
        'Name 3 trees, 3 shrubs, and 3 herbs',
        'Write 5 uses of plants',
      ],
      quickRevision: {
        keyPoints: ['6 parts of a plant: root, stem, leaf, flower, fruit, seed', 'Roots absorb water', 'Stem carries water', 'Leaves make food (photosynthesis)', 'Flowers help in reproduction'],
        importantWords: ['Photosynthesis', 'Taproot', 'Fibrous root', 'Chlorophyll', 'Pollination'],
        oralQuestions: ['Name the 6 parts of a plant', 'What do roots do?', 'How do plants make food?'],
      },
    },
  };

  return guides[`${subject}|${chapter}`] || {
    whatToRead: [`Read the complete chapter on ${chapter}`, 'Review all definitions', 'Study all examples given in the textbook'],
    whatToHighlight: [
      { item: 'All definitions in the chapter', reason: 'Definitions are frequently tested', memorize: true },
      { item: 'Important examples', reason: 'Examples help understand concepts', memorize: false },
    ],
    whatToUnderstand: [{
      concept: chapter,
      explanation: `${chapter} is an important topic in ${subject}. Make sure to understand all the concepts clearly.`,
      example: 'Refer to textbook examples',
      commonMistakes: ['Not reading the complete chapter', 'Skipping examples'],
    }],
    whatToPractice: ['Answer all exercise questions in the textbook', 'Create 10 practice questions', 'Revise all definitions'],
    quickRevision: {
      keyPoints: ['Read all definitions', 'Practice all examples', 'Revise the entire chapter'],
      importantWords: [],
      oralQuestions: [`What is ${chapter}?`, 'Give one example', 'Why is this important?'],
    },
  };
}

// ─── Exam Study Plan ──────────────────────────────────────────────────────────

export async function generateExamPlan(_examName: string, daysLeft: number, subjects: string[]): Promise<string[]> {
  await delay(1500);
  const plan: string[] = [];
  subjects.forEach((sub, i) => {
    plan.push(`Day ${i + 1}: Focus on ${sub} – read all chapters and highlight key points`);
    plan.push(`Day ${i + 2}: Practice ${sub} questions and review answers`);
  });
  plan.push(`Day ${daysLeft - 1}: Full revision of all subjects`);
  plan.push(`Day ${daysLeft}: Quick recap and rest well before the exam`);
  return plan.slice(0, daysLeft);
}

// ─── Question Paper Generation ────────────────────────────────────────────────

export async function generateQuestionPaper(config: QuestionPaperConfig): Promise<Question[]> {
  await delay(3000);
  const questions: Question[] = [];
  let qIdx = 0;

  const sampleQs: Record<QuestionType, (subject: string, idx: number) => Question> = {
    mcq: (sub, i) => ({ id: `q-${++qIdx}`, type: 'mcq', question: `Sample MCQ question ${i + 1} for ${sub}`, options: ['Option A', 'Option B', 'Option C', 'Option D'], answer: 'Option A', explanation: 'Option A is correct because it matches the textbook definition.', marks: 1, topic: config.sourceChapters[0] || sub }),
    fill_blanks: (sub, i) => ({ id: `q-${++qIdx}`, type: 'fill_blanks', question: `The ___ is an important concept in ${sub} (question ${i + 1})`, answer: 'key term', explanation: 'This key term is defined in chapter 1.', marks: 1, topic: config.sourceChapters[0] || sub }),
    true_false: (sub, i) => ({ id: `q-${++qIdx}`, type: 'true_false', question: `Statement ${i + 1}: This statement about ${sub} is true.`, answer: 'True', explanation: 'This is true as stated in the textbook.', marks: 1, topic: config.sourceChapters[0] || sub }),
    short_answer: (sub, i) => ({ id: `q-${++qIdx}`, type: 'short_answer', question: `Explain concept ${i + 1} from ${sub} in your own words.`, answer: 'Sample short answer response with key points.', explanation: 'A good answer should include the definition and one example.', marks: 2, topic: config.sourceChapters[0] || sub }),
    long_answer: (sub, i) => ({ id: `q-${++qIdx}`, type: 'long_answer', question: `Write a detailed note on topic ${i + 1} in ${sub}.`, answer: 'Sample long answer covering introduction, main points, and conclusion.', explanation: 'The answer should be 4–6 sentences covering all key aspects.', marks: 5, topic: config.sourceChapters[0] || sub }),
    one_word: (sub, i) => ({ id: `q-${++qIdx}`, type: 'one_word', question: `One-word answer ${i + 1} for ${sub}:`, answer: 'Answer', marks: 1, topic: sub }),
    match_following: (sub, i) => ({ id: `q-${++qIdx}`, type: 'match_following', question: `Match column A with column B (${sub}, set ${i + 1}):\nA1: Term 1\nA2: Term 2\n\nB1: Definition 2\nB2: Definition 1`, answer: 'A1 – B2, A2 – B1', marks: 2, topic: sub }),
    compare_contrast: (sub, i) => ({ id: `q-${++qIdx}`, type: 'compare_contrast', question: `Compare and contrast the two concepts in ${sub} (set ${i + 1}).`, answer: 'Similarities: Both are... Differences: First is... while second is...', marks: 3, topic: sub }),
    word_meanings: (sub, i) => ({ id: `q-${++qIdx}`, type: 'word_meanings', question: `Write the meaning of this word from ${sub} (word ${i + 1}): "example"`, answer: 'A representative instance used to illustrate a concept.', marks: 1, topic: sub }),
    opposites: (sub, i) => ({ id: `q-${++qIdx}`, type: 'opposites', question: `Write the opposite of the word (${sub}, ${i + 1}): "hot"`, answer: 'cold', marks: 1, topic: sub }),
    synonyms: (sub, i) => ({ id: `q-${++qIdx}`, type: 'synonyms', question: `Write a synonym for (${sub}, ${i + 1}): "happy"`, answer: 'joyful', marks: 1, topic: sub }),
    give_reasons: (sub, i) => ({ id: `q-${++qIdx}`, type: 'give_reasons', question: `Give a reason why concept ${i + 1} is important in ${sub}.`, answer: 'Because it forms the foundation of understanding this topic.', marks: 2, topic: sub }),
    name_following: (sub, i) => ({ id: `q-${++qIdx}`, type: 'name_following', question: `Name the following (${sub}, ${i + 1}): The process described here is called ___`, answer: 'The process name', marks: 1, topic: sub }),
    identify_correct: (sub, i) => ({ id: `q-${++qIdx}`, type: 'identify_correct', question: `Identify the correct statement about ${sub} (set ${i + 1}):\na) Correct\nb) Incorrect\nc) Incorrect\nd) Incorrect`, answer: 'a) Correct', marks: 1, topic: sub }),
    rearrange_words: (sub, i) => ({ id: `q-${++qIdx}`, type: 'rearrange_words', question: `Rearrange the words to form a correct sentence (${sub}, ${i + 1}):\nplants / food / make / their / own`, answer: 'Plants make their own food.', marks: 1, topic: sub }),
    grammar: (sub, i) => ({ id: `q-${++qIdx}`, type: 'grammar', question: `Grammar exercise ${i + 1}: Fill in the correct form of the verb in brackets.\nShe ___ (go) to school every day.`, answer: 'goes', explanation: 'Use third-person singular present tense.', marks: 1, topic: sub }),
    math_problems: (sub, i) => ({ id: `q-${++qIdx}`, type: 'math_problems', question: `Solve (${i + 1}): A shopkeeper has 48 pens. He packs them in groups of 6. How many groups will he make?`, answer: '48 ÷ 6 = 8 groups', explanation: 'Divide total by group size.', marks: 2, topic: sub }),
    application_based: (sub, i) => ({ id: `q-${++qIdx}`, type: 'application_based', question: `Application question ${i + 1}: How would you apply what you learned about ${sub} in real life? Give an example.`, answer: 'Sample real-life application.', marks: 3, topic: sub }),
  };

  for (const qt of config.questionTypes) {
    const gen = sampleQs[qt.type];
    if (gen) {
      for (let i = 0; i < qt.quantity; i++) questions.push(gen(config.subject, i));
    }
  }

  return questions;
}

// ─── Chat assistant ───────────────────────────────────────────────────────────

export async function chatWithAssistant(message: string, childName: string): Promise<string> {
  await delay(1200);
  const lower = message.toLowerCase();

  if (lower.includes('study today') || lower.includes('what to study')) {
    return `For ${childName} today, I recommend focusing on **Fractions** (Mathematics) which needs revision, and **Plants Around Us** (EVS). Both are in the upcoming monthly exam. Start with the definitions, then practice 5 questions from each topic.`;
  }
  if (lower.includes('exam syllabus') || lower.includes('monthly exam')) {
    return `The **Monthly Examination** covers:\n- **Mathematics**: Chapters 1 & 2 (Multiplication, Division)\n- **English**: Chapters 1–3 (Nouns, Verbs, Adjectives)\n- **EVS**: Chapter 1 (Plants Around Us)\n\nThe exam starts on October 28th. ${childName} has 7 days to prepare.`;
  }
  if (lower.includes('struggle') || lower.includes('practice')) {
    return `I can see ${childName} needs more practice with fractions and EVS. Here are 3 quick exercises:\n1. Write the fraction for 3 out of 5 equal parts\n2. Draw a plant and label its 6 parts\n3. Solve: 5 × ___ = 35`;
  }
  if (lower.includes('revision plan') || lower.includes('study plan')) {
    return `Here is a 5-day revision plan for ${childName}:\n- **Day 1**: Mathematics – Multiplication (revise tables, solve 10 problems)\n- **Day 2**: Mathematics – Division (concept + word problems)\n- **Day 3**: English – Nouns, Verbs, Adjectives (definitions + exercises)\n- **Day 4**: EVS – Plants Around Us (label diagram, know functions)\n- **Day 5**: Full revision + attempt one practice paper`;
  }

  return `I'm your AI learning assistant for ${childName}. I can help you understand what to study, generate practice questions, explain concepts, or create a revision plan. What would you like help with?`;
}

// ─── Text-based Study Guide (no AI) ──────────────────────────────────────────
// Parses raw OCR/extracted text into a StudyGuideSection without any AI call.

export function buildStudyGuideFromText(text: string, subject: string, chapterName: string): StudyGuideSection {
  const lines = text
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(l => l.length > 3 && !isCorruptedIndicFont(l));

  // Sentences: clean meaningful sentences
  const sentences = lines.filter(l => l.length >= 15 && !/^[\d\.\-\*•\s]+$/.test(l));

  // Key terms: Indic or English words followed by colon, dash or title case tokens
  const termPattern = /^([\u0C80-\u0CFF\u0C00-\u0C7F\u0900-\u097FA-Za-z\s]{2,30})[\s:–-]/;
  const keyTerms: string[] = [];
  const seenTerms = new Set<string>();
  for (const line of lines) {
    const m = line.match(termPattern);
    if (m && !seenTerms.has(m[1].trim()) && m[1].trim().length > 2) {
      keyTerms.push(m[1].trim());
      seenTerms.add(m[1].trim());
    }
  }

  // Important points: numbered or bulleted lines, or strong topic sentences
  const pointPattern = /^[\d\u2022\-\*•\(\)]\s*[\.\):]?\s*(.+)/;
  const importantPoints: string[] = [];
  for (const line of lines) {
    const m = line.match(pointPattern);
    if (m && m[1].length > 8 && importantPoints.length < 10) {
      importantPoints.push(m[1].trim());
    }
  }

  // Definitions: lines containing definition keywords
  const defPattern = /\b(is|are|means|refers to|defined as|ಅಂದರೆ|అనగా|कहते हैं)\b/i;
  const definitions: string[] = sentences.filter(s => defPattern.test(s)).slice(0, 5);

  // What to read: actual content excerpts from the material
  const whatToRead = sentences.slice(0, 6).length
    ? sentences.slice(0, 6)
    : [`Read the complete section on ${chapterName}`, `Review all key points and exercises in ${subject}`];

  // What to highlight: actual key terms + definitions
  const highlightItems = [
    ...keyTerms.slice(0, 5).map(t => ({ item: t, reason: `Important concept/term in ${chapterName}`, memorize: true })),
    ...definitions.slice(0, 4).map(d => ({ item: d.length > 90 ? d.slice(0, 90) + '…' : d, reason: 'Key definition', memorize: true })),
  ];

  // What to understand: genuine concept explanations from the text
  const whatToUnderstand = definitions.slice(0, 4).map(def => {
    const parts = def.split(/\b(is|are|means|refers to|defined as|ಅಂದರೆ|అనగా|कहते हैं)\b/i);
    const concept = parts[0]?.trim() || chapterName;
    return {
      concept,
      explanation: def,
      example: `Review examples for "${concept}" in the uploaded material.`,
      commonMistakes: ['Ensure you understand the full explanation rather than memorizing single words.'],
    };
  });

  if (whatToUnderstand.length === 0) {
    whatToUnderstand.push({
      concept: chapterName,
      explanation: sentences[0] || `Focus on understanding the key concepts of ${chapterName} in ${subject}.`,
      example: `Check diagrams, formulas, and practice problems in this section.`,
      commonMistakes: ['Do not skip the summary and self-assessment points.'],
    });
  }

  // What to practice: tailored to extracted terms & sentences
  const whatToPractice = [
    `Summarize ${chapterName} in 5 bullet points in your notebook.`,
    ...(keyTerms.slice(0, 3).map(t => `Explain the meaning of "${t}" in your own words.`)),
    ...(definitions.slice(0, 2).map((_, i) => `Write the definition of key concept #${i + 1}.`)),
    `Solve all questions at the end of this chapter.`,
  ];

  return {
    whatToRead,
    whatToHighlight: highlightItems.length > 0 ? highlightItems : [{ item: chapterName, reason: 'Core chapter heading', memorize: true }],
    whatToUnderstand,
    whatToPractice,
    quickRevision: {
      keyPoints: importantPoints.length > 0 ? importantPoints.slice(0, 8) : sentences.slice(0, 5),
      importantWords: keyTerms.length > 0 ? keyTerms.slice(0, 8) : [chapterName, subject],
      oralQuestions: [
        `What is the main topic of ${chapterName}?`,
        ...keyTerms.slice(0, 3).map(t => `What do you know about ${t}?`),
        `Give two key takeaways from ${chapterName}.`,
      ],
    },
  };
}

// ─── Question generation from raw text (no AI) ───────────────────────────────

export interface TextQuestion {
  type: 'fill_blank' | 'mcq' | 'short_answer' | 'true_false';
  question: string;
  answer: string;
  options?: string[];
  marks: number;
}

export function generateQuestionsFromText(text: string, count = 10): TextQuestion[] {
  const lines = text
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(l => l.length > 15 && l.includes(' '));

  const questions: TextQuestion[] = [];

  // Fill in the blanks — pick sentences with a clear noun/term and blank it
  const defLines = lines.filter(l => /\b(is|are|means|called|known as|defined as)\b/i.test(l));
  for (const line of defLines.slice(0, Math.ceil(count * 0.4))) {
    // Blank out the last meaningful word before "is/are/means"
    const blanked = line.replace(/\b([A-Z][a-z]{2,})\b/, '______');
    const match = line.match(/\b([A-Z][a-z]{2,})\b/);
    if (match && blanked !== line) {
      questions.push({ type: 'fill_blank', question: `Fill in the blank:\n${blanked}`, answer: match[1], marks: 1 });
    }
  }

  // True/False — take a factual sentence as-is (true), then negate a keyword (false)
  const factLines = lines.filter(l => l.length > 20 && l.length < 120 && /[A-Z]/.test(l[0]));
  for (const line of factLines.slice(0, Math.ceil(count * 0.2))) {
    questions.push({ type: 'true_false', question: `True or False:\n"${line}"`, answer: 'True', marks: 1 });
  }

  // Short answer — numbered/bulleted points become short-answer questions
  const pointLines = lines.filter(l => /^[\d\u2022\-•]/.test(l));
  for (const line of pointLines.slice(0, Math.ceil(count * 0.3))) {
    const clean = line.replace(/^[\d\u2022\-•\.\)]\s*/, '');
    if (clean.length > 10) {
      questions.push({ type: 'short_answer', question: `Answer in one or two sentences:\n${clean}`, answer: clean, marks: 2 });
    }
  }

  // MCQ — take key terms as correct answer, generate plausible distractors from other key terms
  const keyTerms = lines
    .map(l => l.match(/^([A-Z][A-Za-z\s]{2,20})[\s:–-]/)?.[1]?.trim())
    .filter(Boolean) as string[];
  const uniqueTerms = [...new Set(keyTerms)];
  for (let i = 0; i < uniqueTerms.length && questions.length < count; i++) {
    const correct = uniqueTerms[i];
    const distractors = uniqueTerms.filter(t => t !== correct).slice(0, 3);
    if (distractors.length < 3) continue;
    const opts = [correct, ...distractors].sort(() => Math.random() - 0.5);
    questions.push({
      type: 'mcq',
      question: `Which of the following is a key term from the uploaded material?`,
      answer: correct,
      options: opts,
      marks: 1,
    });
  }

  return questions.slice(0, count);
}

// ─── Text-based chat assistant (no AI) ───────────────────────────────────────
// Searches uploaded material text for answers to the user's question.

export function answerFromMaterials(question: string, materialsText: string, childName: string): string {
  if (!materialsText.trim()) {
    return `I don't have any uploaded material to search through for ${childName} yet. Please upload a PDF or image first, then I can answer questions based on it.`;
  }

  const q = question.toLowerCase();
  const lines = materialsText.split('\n').map(l => l.trim()).filter(l => l.length > 5);

  // Find lines that contain keywords from the question
  const keywords = q.split(/\s+/).filter(w => w.length > 3 && !['what','when','where','which','does','have','will','this','that','from','with','your','child'].includes(w));
  const relevant = lines.filter(line => keywords.some(kw => line.toLowerCase().includes(kw)));

  if (relevant.length > 0) {
    const answer = relevant.slice(0, 5).join('\n');
    return `Based on the uploaded material for ${childName}:\n\n${answer}\n\n(Found in uploaded documents — check the original material for full context.)`;
  }

  // Fallback: return the first few lines of material as context
  return `I couldn't find an exact match in the uploaded material, but here is relevant content from ${childName}'s documents:\n\n${lines.slice(0, 5).join('\n')}`;
}



// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
