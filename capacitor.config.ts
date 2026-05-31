import type { CapacitorConfig } from "@capacitor/cli";

const appUrl = process.env.AMBIENTECHO_APP_URL ?? "https://e-eight.vercel.app/call";

let allowNavigation: string[] = [];
try {
  allowNavigation = [new URL(appUrl).hostname];
} catch {
  allowNavigation = [];
}

const config: CapacitorConfig = {
  appId: "com.ambientecho.app",
  appName: "AmbientEcho",
  webDir: "www",
  server: {
    url: appUrl,
    cleartext: appUrl.startsWith("http://"),
    allowNavigation,
  },
  android: {
    allowMixedContent: appUrl.startsWith("http://"),
  },
};

export default config;
