/**
 * Guards the Android startup crash fix.
 *
 * Loads native-shell.js in a real Chromium page with a stubbed Capacitor
 * bridge and proves two things without a device:
 *  1. When Firebase has no default app (google-services.json missing), the web
 *     layer never calls PushNotifications.register() — the call that threw
 *     "Default FirebaseApp is not initialized" and closed the app.
 *  2. When Firebase is configured, the guarded StudyZonePush path still
 *     registers and stores the FCM token, so push keeps working.
 */
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");

const CHROME =
  "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe";

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end("<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>");
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const bridgeStub = ({ configured, token }) => {
  const calls = { guardRegister: 0, stockRegister: 0, statusCalls: 0 };
  window.__pushCalls = calls;
  const noop = async () => ({});
  const listener = () => ({ remove() {} });
  const guard = {
    async status() {
      calls.statusCalls += 1;
      return configured
        ? { configured: true, reason: "ok" }
        : { configured: false, reason: "missing-google-services" };
    },
    async register() {
      calls.guardRegister += 1;
      if (!configured)
        return { configured: false, reason: "missing-google-services", token: "" };
      return { configured: true, reason: "ok", token };
    },
  };
  const stockPush = {
    async checkPermissions() {
      return { receive: "granted" };
    },
    async requestPermissions() {
      return { receive: "granted" };
    },
    register() {
      calls.stockRegister += 1;
      // In the broken build this native call threw IllegalStateException and
      // killed the process. JS must never reach it.
      throw new Error("unguarded PushNotifications.register() was called");
    },
    unregister() {
      calls.stockRegister += 1;
      throw new Error("unguarded PushNotifications.unregister() was called");
    },
    addListener: listener,
  };
  window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => "android",
    Plugins: {
      StudyZonePush: guard,
      PushNotifications: stockPush,
      LocalNotifications: {
        checkPermissions: async () => ({ display: "denied" }),
        requestPermissions: async () => ({ display: "denied" }),
        createChannel: noop,
        cancel: noop,
        schedule: noop,
        getPending: async () => ({ notifications: [] }),
        addListener: listener,
      },
      SplashScreen: { hide: noop, show: noop },
      StatusBar: { setStyle: noop, setBackgroundColor: noop, show: noop, hide: noop },
      Keyboard: { setAccessoryBarVisible: noop, addListener: listener },
      Network: { getStatus: async () => ({ connected: true }), addListener: listener },
      App: { addListener: listener, minimizeApp() {}, exitApp() {} },
      StudyZonePermissions: { readLastCrash: async () => ({ trace: "" }) },
    },
  };
};

(async () => {
  const server = await startServer();
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const failures = [];
  const check = (ok, label) => {
    if (!ok) failures.push(label);
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  };

  try {
    // --- Scenario 1: Firebase not configured (the crash that was reported) ---
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(bridgeStub, { configured: false, token: "" });
      await page.goto(base, { waitUntil: "load" });
      await page.addScriptTag({
        path: path.resolve(__dirname, "..", "native-shell.js"),
      });
      await page.waitForTimeout(700);
      const result = await page.evaluate(async () => ({
        calls: window.__pushCalls,
        registerResult: await window.StudyZonePush.register(),
        status: await window.StudyZonePush.status(),
        isNative: window.StudyZoneNotifications?.isNative,
        token: localStorage.getItem("studyzone.native.push-token"),
      }));
      check(errors.length === 0, "unconfigured boot raises no page errors");
      check(result.isNative === true, "native shell still boots with Firebase absent");
      check(result.calls.statusCalls >= 1, "Firebase status is checked before registering");
      check(
        result.calls.stockRegister === 0,
        "unguarded PushNotifications.register() is never called",
      );
      check(
        result.calls.guardRegister === 0,
        "guarded token request is skipped when Firebase is missing",
      );
      check(result.registerResult === null, "push registration resolves safely (null)");
      check(result.status.configured === false, "status reports configured=false");
      check(
        result.status.reason === "missing-google-services",
        "status explains the missing google-services.json",
      );
      check(result.token === null, "no token is stored when Firebase is missing");
      await context.close();
    }

    // --- Scenario 2: Firebase configured (push must keep working) -----------
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(bridgeStub, { configured: true, token: "tok-abc-123" });
      await page.goto(base, { waitUntil: "load" });
      await page.addScriptTag({
        path: path.resolve(__dirname, "..", "native-shell.js"),
      });
      await page.waitForTimeout(700);
      const result = await page.evaluate(() => ({
        calls: window.__pushCalls,
        status: window.StudyZonePush?.status ? "present" : "missing",
        token: localStorage.getItem("studyzone.native.push-token"),
      }));
      check(errors.length === 0, "configured boot raises no page errors");
      check(result.calls.guardRegister >= 1, "guarded token request runs when configured");
      check(
        result.calls.stockRegister === 0,
        "stock register() is still bypassed when configured",
      );
      check(result.token === "tok-abc-123", "FCM token is stored for device_push_tokens");
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error(`\nPush guard checks failed (${failures.length}):`);
    for (const failure of failures) console.error(" - " + failure);
    process.exit(1);
  }
  console.log("\nPush guard behavior checks passed.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
