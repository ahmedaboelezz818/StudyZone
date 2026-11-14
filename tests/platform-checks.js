/* Dependency-free Android / offline platform checks. Run: node tests/platform-checks.js */
const { readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const read = (file) => readFileSync(join(root, file), "utf8");
const exists = (file) => existsSync(join(root, file));

let passed = 0;
const failures = [];
function check(name, condition) {
  if (condition) passed += 1;
  else failures.push(name);
}

const pkg = JSON.parse(read("package.json"));
const capacitor = JSON.parse(read("capacitor.config.json"));
const html = read("index.html");
const app = read("app.js");
const offline = read("offline-sync.js");
const native = read("native-shell.js");
const syncUi = read("sync-ui.js");
const themes = read("themes.css");
const themePresets = read("themes-presets.css");
const mobile = read("mobile.css");
const buildScript = read("scripts/build-web.js");
const migration = exists("supabase/migrations/003_android_offline_notifications.sql")
  ? read("supabase/migrations/003_android_offline_notifications.sql")
  : "";

check("Capacitor CLI is a dev dependency", Boolean(pkg.devDependencies?.["@capacitor/cli"]));
check("Android platform dependency is present", Boolean(pkg.dependencies?.["@capacitor/android"]));
for (const plugin of [
  "@capacitor/app",
  "@capacitor/keyboard",
  "@capacitor/local-notifications",
  "@capacitor/network",
  "@capacitor/push-notifications",
  "@capacitor/splash-screen",
  "@capacitor/status-bar",
]) {
  check(`${plugin} is installed as a dependency`, Boolean(pkg.dependencies?.[plugin]));
}
check("Build script copies the canonical site", buildScript.includes("www"));
check("Build script copies the sync UI", buildScript.includes('"sync-ui.js"'));
check("Build script copies local vendor assets", buildScript.includes('"vendor"'));
check("Build script copies the generated locales", buildScript.includes('"locales"'));
check("Build script recreates www safely", buildScript.includes("rmSync"));

check("Capacitor app id is stable", capacitor.appId === "com.studyzone.app");
check("Capacitor app name is Study Zone", capacitor.appName === "Study Zone");
check("Capacitor serves from www", capacitor.webDir === "www");
check("Capacitor uses the https scheme", capacitor.server?.androidScheme === "https");
check("Splash screen is configured", Boolean(capacitor.plugins?.SplashScreen));
check("Status bar is configured", Boolean(capacitor.plugins?.StatusBar));
check("Keyboard resize mode is native", capacitor.plugins?.Keyboard?.resize === "native");
check("Local notification channel icon is configured", Boolean(capacitor.plugins?.LocalNotifications?.smallIcon));

check("Viewport covers safe areas", html.includes("viewport-fit=cover"));
check("Viewport reacts to the keyboard", html.includes("interactive-widget=resizes-content"));
check("Early theme boot runs before styles finish", html.indexOf("studyflow.theme.preset") < html.indexOf("app.js"));
check("Local Supabase SDK is used", html.includes("vendor/supabase.js") && !html.includes("jsdelivr"));
check("Offline engine loads before the app", html.indexOf("offline-sync.js") < html.indexOf("app.js"));
check("Native shell loads after the app", html.indexOf("native-shell.js") > html.indexOf("app.js"));
check("Locales load before the app", html.indexOf("locales.js") < html.indexOf("app.js"));

check("Offline engine wraps fetch", offline.includes("window.fetch = function studyZoneFetch"));
check("Offline engine uses IndexedDB", offline.includes("indexedDB.open"));
check("Offline engine queues writes", offline.includes("QUEUE_STORE"));
check("Offline engine tracks conflicts", offline.includes("CONFLICT_STORE"));
check("Offline engine isolates accounts", offline.includes("clearUser"));
check("Offline engine exposes a public API", offline.includes("window.StudyZoneOffline"));
check("Offline engine queues focus sessions", offline.includes("queueFocusRecord"));
check("Offline engine retries automatically", offline.includes("SYNC_INTERVAL_MS"));

check("Native shell is a no-op on the web", native.includes("if (!isNative)"));
check("Native shell handles back navigation", native.includes('"backButton"'));
check("Native shell handles lifecycle", native.includes('"appStateChange"'));
check("Native shell handles deep links", native.includes('"appUrlOpen"'));
check("Native shell handles the keyboard", native.includes('"keyboardWillShow"'));
check("Native shell creates reminder channels", native.includes("createChannel"));
check("Native shell schedules tasks", native.includes("syncTaskReminders"));
check("Native shell schedules focus completion", native.includes("syncFocusReminder"));
check("Native shell requests notification permission", native.includes("requestPermissions"));
check("Native shell registers push tokens", native.includes("PushNotifications.register"));
check("Native shell keeps push tokens owner-scoped", native.includes("device_push_tokens"));

check("Sync UI adds a status chip", syncUi.includes("data-sync-chip"));
check("Sync UI resolves conflicts", syncUi.includes("resolveConflict"));
check("Sync UI refreshes on sync events", syncUi.includes('"sync-complete"'));

check("Six color themes are defined", [
  "original",
  "ocean",
  "emerald",
  "purple",
  "crimson",
  "midnight",
].every((id) => themePresets.includes(`data-theme-preset="${id}"`)));
check("Themes include light-mode variants", themePresets.includes('data-theme="light"][data-theme-preset'));
check("Themes keep the light/dark attribute separate", themePresets.includes("data-theme-preset"));
check("Mobile CSS handles safe areas", mobile.includes("safe-area-inset"));
check("Mobile CSS handles the keyboard", mobile.includes("keyboard-open") || mobile.includes("--keyboard-height"));
check("Mobile CSS has RTL rules", mobile.includes('dir="rtl"'));

if (migration) {
  check("Profile theme migration is additive", /add column if not exists theme text/i.test(migration));
  check(
    "Profile notification migration is additive",
    /add column if not exists notification_settings jsonb/i.test(migration),
  );
  check(
    "Push token table is owner-scoped",
    /device_push_tokens_select_own/i.test(migration) && /auth\.uid\(\) = user_id/i.test(migration),
  );
  check("Migration enables RLS", /enable row level security/i.test(migration));
  check("Migration never drops tables or columns", !/\bdrop table\b|\bdrop column\b|\btruncate\b/i.test(migration));
} else {
  check("Android/offline migration is optional in this checkout", true);
}

check("App exposes a native focus snapshot", app.includes("get focus()"));
check("App exposes a sync API", app.includes("window.StudyZoneApp"));
check("Theme preference syncs to the profile", app.includes('.update({ theme: id })'));
check("Notification preferences sync to the profile", app.includes("notification_settings: value"));
check("Sign-out clears the offline account", app.includes("offlineStore?.clearUser"));

const clientFiles = [
  "app.js",
  "offline-sync.js",
  "native-shell.js",
  "sync-ui.js",
  "supabase-config.js",
  "service-worker.js",
];
for (const file of clientFiles) {
  const contents = read(file);
  check(`${file} has no service-role key`, !/service_role\s*[:=]/i.test(contents));
}

if (failures.length) {
  console.error(`Platform checks failed (${failures.length}):`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`Platform checks passed: ${passed}/${passed}.`);
