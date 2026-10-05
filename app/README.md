# AI School Learning Assistant

A Progressive Web App (PWA) that helps parents organize school learning materials and support their child's education.

## 🚀 Quick Start

```bash
cd SanjuClass1/app
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## ✨ Features (Phase 1 MVP)

| Module | Description |
|--------|-------------|
| **Dashboard** | Exam countdown, study progress, topics needing attention, recent uploads |
| **Upload Materials** | Upload images, PDFs, or links — AI extracts and organizes content |
| **Study Guide** | AI-generated What to Read / Highlight / Understand / Practice / Quick Revision |
| **Exam Preparation** | Manage exams, track subject progress, generate AI study plans |
| **Question Generator** | 18+ question types, custom quantities, 6-step wizard |
| **Practice Mode** | Interactive quizzes, automatic scoring, performance analysis |
| **Weekly Plan** | Track daily lessons, mark completion status |
| **Question Library** | Browse and review all generated papers |
| **Children** | Manage multiple children with separate data |
| **AI Assistant** | Chat interface for study guidance |
| **Settings** | Configure AI provider — Local AI (free), Mock, OpenAI, watsonx.ai, Anthropic |

## 📱 Android & Mobile

The app is a full PWA — install it from Chrome on Android like a native app. It supports portrait orientation and works offline once a local model is downloaded.

### 🤖 Local AI (Free, No Subscription)

Run AI entirely on your Android phone or tablet — no internet needed after the one-time model download.

**Requirements**: Chrome 121+ on Android (any phone from 2022 onward).

**Available models** (choose in Settings → Local AI):

| Model | Download | RAM | Best for |
|---|---|---|---|
| SmolLM2 360M | 360 MB | 1 GB | Budget phones |
| **Llama 3.2 1B** ⭐ | 700 MB | 2 GB | **Most phones — recommended** |
| Qwen 2.5 1.5B | 900 MB | 2 GB | Hindi / regional languages 🇮🇳 |
| Llama 3.2 3B | 1.8 GB | 4 GB | Tablets, best quality |

**Setup**:
1. Open the app in Chrome on Android
2. Go to **Settings** → select **Local AI (Free, On-Device)**
3. Tap **Download** next to your chosen model
4. Wait for download to complete (one-time only — cached permanently)
5. Tap **Save Settings**

All AI features (study guide, question generation, exam plan, chat) will now run on-device with full privacy.

> Models are cached in the browser's OPFS storage and persist across sessions. Use the **Delete** button in Settings to free up space.

## ⚙️ Configuration

Copy `.env.example` to `.env` and configure:

```
VITE_AI_PROVIDER=mock       # mock | local | openai | watsonx | anthropic
VITE_AI_API_KEY=             # your API key (not needed for mock or local)
```

> In production, users configure their provider via the Settings page. The `.env` value is only used as a developer fallback.

### AI Provider Notes

- **Local AI** (recommended for Android): No API key. Model runs on-device via WebLLM + WebGPU.
- **Mock** (default for dev): No API key. Uses realistic simulated responses.
- **OpenAI**: Set `VITE_AI_PROVIDER=openai` and add your OpenAI API key.
- **watsonx.ai**: Set `VITE_AI_PROVIDER=watsonx` and configure IBM Cloud credentials.
- **Anthropic**: Set `VITE_AI_PROVIDER=anthropic` and add your Anthropic key.

> API keys are stored in browser localStorage only and never sent to any external server other than the configured AI provider.

## 🏗️ Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS v4
- **Build**: Vite 8
- **PWA**: vite-plugin-pwa + Workbox
- **Icons**: Lucide React
- **State**: React Context API

## 📁 Project Structure

```
src/
├── components/
│   ├── Layout.tsx          # Sidebar + top bar
│   └── shared/UI.tsx       # Reusable components
├── contexts/
│   └── AppContext.tsx       # Global state
├── data/
│   └── mockData.ts         # Sample data for Sanju (Class 3)
├── pages/                  # One file per page/module
├── services/
│   └── aiService.ts        # AI abstraction layer (mock + provider)
└── types/
    └── index.ts            # All TypeScript types
```

## 🗺️ Roadmap

### Phase 2
- Exam preparation planner with day-wise scheduling
- Performance analytics with charts
- Natural-language content search
- Multiple child profiles

### Phase 3
- WhatsApp Business Platform integration
- Multi-language support
- Voice-based learning assistant
- Personalized learning recommendations
