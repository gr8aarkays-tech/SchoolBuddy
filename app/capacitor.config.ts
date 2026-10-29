import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Must match the applicationId in android/app/build.gradle
  appId: 'com.schoolbuddy.app',
  appName: 'AiClass',
  // Point at the Vite output directory
  webDir: 'dist',
  android: {
    // Use the system WebView (no bundled Crosswalk)
    useLegacyBridge: false,
  },
  server: {
    // When running `npx cap run android` with --live-reload this URL is used.
    // Leave blank for production builds.
    // url: 'http://192.168.x.x:5173',
    cleartext: false,
  },
};

export default config;
