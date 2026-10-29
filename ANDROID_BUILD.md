# SchoolBuddy — Android Build Guide

The app uses **Capacitor** to wrap the existing React/Vite PWA in a native Android shell.
No code rewrite is needed — all the web source lives in `app/src/`.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 18 + | `node --version` |
| npm | 9 + | bundled with Node |
| Android Studio | Hedgehog (2023.1.1) + | [Download](https://developer.android.com/studio) |
| Android SDK | API 35 (compile), API 23 (min) | Install via SDK Manager in Android Studio |
| JDK | 17 | Bundled in Android Studio |

---

## One-time setup

```bash
# From the repo root
cd app

# Install dependencies (already done if you've been running the web app)
npm install

# The android/ folder is already generated — nothing extra needed
```

---

## Day-to-day workflow

### 1 — Build the web app for Android

```bash
cd app
npm run android:sync
```

This runs the following two steps:
1. `VITE_CAPACITOR=true vite build` — builds with `base: '/'` (required for WebView)
2. `npx cap sync android` — copies `dist/` → `android/app/src/main/assets/public/`

### 2 — Open in Android Studio

```bash
npm run android:open
```

Android Studio opens the `android/` Gradle project. From here you can:
- Run on an emulator or physical device (▶ button)
- Build a debug APK: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- Build a release AAB: **Build → Generate Signed Bundle / APK**

### 3 — Quick run on connected device

```bash
npm run android:run
```

This builds and deploys directly to a USB-connected Android device (USB debugging must be enabled).

---

## Live-reload during development

Edit `app/capacitor.config.ts` and uncomment the `server.url` line, replacing the IP with your machine's local IP:

```ts
server: {
  url: 'http://192.168.1.xx:5173',
  cleartext: true,
}
```

Then in one terminal:
```bash
cd app && npm run dev
```

And in another:
```bash
cd app && npx cap run android
```

Changes in `src/` hot-reload instantly on the device.
**Remember to comment `server.url` back out before a release build.**

---

## Minimum SDK / device requirements

| Feature | Requirement |
|---|---|
| App runs | Android 6.0 (API 23) |
| Local AI (WebLLM) | Android phone with Chrome WebView 121 + (ships on most 2022+ devices) |
| WebGPU (fastest inference) | Chrome WebView 121 + and a GPU with Vulkan 1.1 |

---

## Useful Capacitor commands

```bash
# Sync web assets to Android after every build
npx cap sync android

# Open Android Studio
npx cap open android

# View device logs
npx cap run android --list          # list connected devices
npx cap run android --target <id>   # run on specific device
```

---

## Project structure

```
app/
├── android/              ← Native Android project (Gradle)
│   └── app/src/main/
│       ├── AndroidManifest.xml
│       ├── assets/public/    ← Capacitor copies dist/ here
│       └── java/com/schoolbuddy/app/
│           └── MainActivity.java   ← injects COOP/COEP for WebLLM
├── dist/                 ← Vite build output (gitignored)
├── src/                  ← React source
├── capacitor.config.ts   ← Capacitor configuration
└── vite.config.ts        ← VITE_CAPACITOR env switches base path
```

---

## Release signing

1. In Android Studio: **Build → Generate Signed Bundle / APK**
2. Create a new keystore or use an existing one
3. Select **Android App Bundle (.aab)** for Google Play upload
4. Select **APK** for direct sideload distribution

Store your `.jks` keystore file safely — losing it means you cannot update the app on Play Store.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| White screen on launch | Run `npm run android:sync` to rebuild & re-copy assets |
| `SharedArrayBuffer is not defined` | Ensure `MainActivity.java` COOP/COEP override is present |
| `WebGPU not available` | Device WebView is below v121 — update Chrome / Android System WebView |
| Gradle sync fails | Open Android Studio → **File → Sync Project with Gradle Files** |
| `VITE_CAPACITOR` not picked up on Windows | Use `npm run android:sync` (uses cross-env) instead of setting env manually |
