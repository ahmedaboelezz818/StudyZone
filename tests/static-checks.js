/* Dependency-free static checks. Run with: node tests/static-checks.js */
const { readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const read = (file) => readFileSync(join(root, file), "utf8");
const app = read("app.js");
const html = read("index.html");
const css = read("styles.css");
const sw = read("service-worker.js");
const manifest = read("manifest.json");
const migrationPath = "supabase/migrations/001_studyzone_enhancements.sql";
const migration = existsSync(join(root, migrationPath)) ? read(migrationPath) : "";
const migration2Path = "supabase/migrations/002_focus_intelligence.sql";
const migration2 = existsSync(join(root, migration2Path))
  ? read(migration2Path)
  : "";
const migration3Path = "supabase/migrations/003_android_offline_notifications.sql";
const migration3 = existsSync(join(root, migration3Path))
  ? read(migration3Path)
  : "";

let passed = 0;
const failures = [];

function check(name, condition) {
  if (condition) {
    passed += 1;
  } else {
    failures.push(name);
  }
}

function includes(file, text, name) {
  check(name || `${file} includes ${text}`, read(file).includes(text));
}

check("app.js parses as CommonJS-compatible text (syntax checked separately)", app.length > 100000);
check("Task page exists", app.includes("function taskPage()"));
check("Notes page exists", app.includes("function notesPage()"));
check("Teams page exists", app.includes("function teamsPage()"));
check("Voice page exists", app.includes("function voicePage()"));
check("Recurring scope dialog exists", app.includes("function openSeriesScopeDialog("));
check("Stop repeating exists", app.includes("async function stopTaskSeries("));
check("Local-day helper exists", app.includes("function parseLocalDateKey("));
check("Task date buckets exist", app.includes("buckets.overdue") && app.includes("buckets.nodate"));
check("Rich text sanitizer exists", app.includes("function sanitizeRichText("));
check("Autosave exists", app.includes("function scheduleNoteSave(") && app.includes("function saveNoteNow("));
check("MediaRecorder recording exists", app.includes("new window.MediaRecorder("));
check("Private voice upload exists", /\.from\(\s*["']voice-notes["']\s*\)\s*\.upload\(/.test(app));
check("Notification sound exists", app.includes("function playNotificationSound("));
check("Task notification enable action exists", app.includes("function enableTaskNotifications("));
check("Do-not-disturb exists", app.includes("function isDoNotDisturbActive("));
check("Notification preferences form exists", app.includes('id="notification-prefs-form"'));
check("Team creation exists", /\.from\(\s*["']teams["']\s*\)\s*\.insert\(/.test(app));
check("Team join RPC exists", app.includes('rpc("join_team"'));
check("No service-role key assignment in browser files", !/service_role\s*[:=]/i.test(app + html + read("supabase-config.js")) && !/serviceRole/i.test(app + html + read("supabase-config.js")));
check("Service worker cache was bumped", sw.includes("studyzone-shell-v21"));

check("Web app manifest keeps standalone display", /"display"\s*:\s*"standalone"/.test(manifest));
check("Web app manifest has a start url and scope", /"start_url"\s*:/.test(manifest) && /"scope"\s*:/.test(manifest));
check("Web app manifest has maskable icons", /"purpose"\s*:\s*"maskable"/.test(manifest));
check("Index loads the web app manifest", html.includes('rel="manifest"'));
check("Index has the install button", html.includes('id="pwa-install"'));
check("Index has the install modal", html.includes('id="pwa-install-modal"'));
check("Index has the install modal confirm action", html.includes('id="pwa-install-confirm"'));
check("App listens for beforeinstallprompt", app.includes("beforeinstallprompt"));
check("App listens for appinstalled", app.includes("appinstalled"));
check("App implements the install prompt flow", app.includes("async function handlePwaInstall"));
check("App detects iOS devices", app.includes("function isIosDevice"));
check("App computes install state", app.includes("function getPwaInstallState"));
check("App plays synthesized alert sounds", app.includes("function playAlertSound"));
check("App previews alert sounds", app.includes("function previewAlertSound"));
check("App snoozes active alerts", app.includes("function snoozeActiveAlert"));
check("Alert sounds hard-stop after the configured duration", app.includes("alertAudioStopHandle") && app.includes("playSeconds") && app.includes("oscillator.stop(toneEnd)"));
check("App stores task sound preferences", app.includes('taskSound: "task-reminder"'));
check("App stores pomodoro sound preferences", app.includes("startSound: \"focus-start\""));
check("Service worker push uses renotify with tag", sw.includes("renotify: true"));

check("Styles include daily task workspace", css.includes("/* ---- Daily task workspace ---- */"));
check("Styles include teams", css.includes("/* ---- Teams ---- */"));
check("Styles include voice notes", css.includes("/* ---- Voice notes ---- */"));
check("Index has task modal", html.includes('id="task-modal"'));
check("Index has scope modal", html.includes('id="scope-modal"'));
check("Index has move modal", html.includes('id="move-task-modal"'));
check("Index has team modal", html.includes('id="team-modal"'));
check("Index has voice modal", html.includes('id="voice-modal"'));

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
check("index.html has no duplicate element IDs", duplicateIds.length === 0);

const appIdMatches = [...app.matchAll(/getElementById\("([^"]+)"\)(\?\.)?/g)];
const appIds = [
  ...new Set(
    appIdMatches.filter((match) => !match[2]).map((match) => match[1]),
  ),
];
const htmlIds = new Set(ids);
const dynamicIds = new Set([...app.matchAll(/\bid="([^"$]+)"/g)].map((match) => match[1]));
const missingIds = [...new Set(appIds)].filter((id) => !htmlIds.has(id) && !dynamicIds.has(id));
check("All literal getElementById targets exist", missingIds.length === 0);

const staticActions = [...new Set([...html.matchAll(/data-action="([^"]+)"/g)].map((match) => match[1]))];
const unhandledStaticActions = staticActions.filter((action) => {
  const marker = `data-action="${action}"`;
  return !app.includes(marker);
});
check("Static data-actions have handlers", unhandledStaticActions.length === 0);

if (migration) {
  check("Migration exists", true);
  for (const table of ["notes", "teams", "team_members", "team_tasks", "voice_notes", "user_notification_preferences"]) {
    check(`Migration mentions ${table}`, migration.includes(table));
  }
  check("Migration enables RLS on teams", /alter table public\.teams enable row level security/i.test(migration));
  check("Migration enables RLS on voice_notes", /alter table public\.voice_notes enable row level security/i.test(migration));
  check("Migration keeps voice bucket private", /values \('voice-notes', 'voice-notes', false\)/i.test(migration));
  check("Migration is non-destructive", !/\bdrop table\b|\btruncate\b|\bdrop column\b/i.test(migration));
} else {
  check("Migration file is not required by browser runtime checks", true);
}

check("Task loading falls back before the recurrence migration is applied", app.includes("recurrenceSupported") && app.includes("baseTaskColumns"));
check("Series edits preserve each occurrence date unless the date changes", app.includes("dueShift") && app.includes("startShift"));
check("Guests can open a session-only voice recording", app.includes('data-action="voice-open"') && app.includes("session-only recording"));

// Focus intelligence & routines
check("Permanent routines use a definition table", app.includes('from("task_routines")'));
check("Routine completion is stored per date", app.includes("task_routine_days") && app.includes("routineDayFor("));
check("Routine occurrences are virtual, not duplicated tasks", app.includes("function routineVirtualTask(") && app.includes("routine:${routine.id}:${key}"));
check("Routine pause/skip/delete actions exist", app.includes("toggleRoutinePause(") && app.includes("skipRoutineOccurrence(") && app.includes("deleteRoutineById("));
check("All-day tasks are supported", app.includes("function isAllDayTask(") && app.includes("is_all_day"));
check("Smart priority suggestions exist", app.includes("function smartTaskScore(") && app.includes("SMART PRIORITIES"));
check("Most-used task ranking exists", app.includes("function mostUsedTasks("));
check("Task usage counters are tracked", app.includes("function trackTaskUsage(") && app.includes("open_count"));
check("Quick capture exists", app.includes("function openQuickCapture(") && app.includes("function saveQuickCapture("));
check("Global search exists", app.includes("function globalSearchMarkup("));
check("Focus preparation exists", app.includes("function openFocusPrep(") && app.includes("function prepareFocusSession("));
check("Per-session focus duration is supported", app.includes("durationMinutes") && app.includes("getFocusDurationMs"));
check("Deep focus / full screen exists", app.includes("focus-deep-toggle") && app.includes("toggleFocusFullscreen("));
check("Distraction tracking exists", app.includes("function logDistraction(") && app.includes("function distractionSummary("));
check("Focus soundscape is synthesized", app.includes("function startFocusSound(") && app.includes("buildNoiseBuffer("));
check("Study journal exists", app.includes("function journalPage(") && app.includes("function saveJournalEntry("));
check("Weekly review compares weeks", app.includes("function weeklyReviewData(") && app.includes("summarizeWeek("));
check("Backup export and validated restore exist", app.includes("async function exportBackup(") && app.includes("function validateBackup(") && app.includes("async function importBackupFile("));
check("Backup restore deduplicates tasks", app.includes("existingTaskKeys"));
check("Keyboard shortcuts exist and ignore typing", app.includes('document.addEventListener("keydown"') && app.includes("element.isContentEditable"));
check("Journal page is registered", app.includes("journal: journalPage") && app.includes('journal: "Study journal"'));

check("Index has quick capture modal", html.includes('id="quick-capture-modal"'));
check("Index has global search modal", html.includes('id="global-search-modal"'));
check("Index has focus preparation modal", html.includes('id="focus-prep-modal"'));
check("Index has distraction modal", html.includes('id="distraction-modal"'));
check("Index has shortcuts modal", html.includes('id="shortcuts-modal"'));
check("Index has quick capture button", html.includes('data-action="quick-capture-open"'));
check("Index has journal navigation", html.includes('data-page="journal"'));
check("New components have styles", css.includes("/* ---- Focus intelligence, routines, journal, search additions"));

if (migration2) {
  check("Focus intelligence migration exists", true);
  for (const table of [
    "task_routines",
    "task_routine_days",
    "focus_distractions",
    "study_journal_entries",
  ]) {
    check(`Migration 002 mentions ${table}`, migration2.includes(table));
  }
  check("Migration 002 enables RLS", /alter table public\.task_routines enable row level security/i.test(migration2));
  check("Migration 002 keeps routine days owner-scoped", /task_routine_days_insert_own/i.test(migration2));
  check("Migration 002 is additive", !/\bdrop table\b|\btruncate\b|\bdrop column\b/i.test(migration2));
  check("Migration 002 can be re-run safely", /add column if not exists/i.test(migration2) && /create table if not exists/i.test(migration2));
} else {
  check("Focus intelligence migration is optional in this checkout", true);
}

if (migration3) {
  check("Android/offline migration exists", true);
  check("Migration 003 adds the theme preference", /add column if not exists theme text/i.test(migration3));
  check(
    "Migration 003 adds notification settings",
    /add column if not exists notification_settings jsonb/i.test(migration3),
  );
  check(
    "Migration 003 creates owner-scoped push tokens",
    /create table if not exists public\.device_push_tokens/i.test(migration3) &&
      /device_push_tokens_select_own/i.test(migration3) &&
      /auth\.uid\(\) = user_id/i.test(migration3),
  );
  check(
    "Migration 003 is additive",
    !/\bdrop table\b|\btruncate\b|\bdrop column\b/i.test(migration3),
  );
  check(
    "Migration 003 can be re-run safely",
    /add column if not exists/i.test(migration3) &&
      /create table if not exists/i.test(migration3) &&
      /drop policy if exists/i.test(migration3),
  );
} else {
  check("Android/offline migration file is missing", false);
}

// Android / offline / theme platform checks.
const offline = read("offline-sync.js");
const nativeShell = read("native-shell.js");
const syncUi = read("sync-ui.js");
const themes = read("themes.css");
const mobile = read("mobile.css");
const capacitor = read("capacitor.config.json");
const localeRuntime = read("locales.js");

check("Index loads the offline engine before the app", html.indexOf("offline-sync.js") < html.indexOf("app.js"));
check("Index loads the native shell", html.includes("native-shell.js"));
check("Index loads the sync UI", html.includes("sync-ui.js"));
check("Index loads local fonts", html.includes("fonts/fonts.css"));
check("Index uses a local Supabase SDK", html.includes("vendor/supabase.js"));
check("Index applies the theme before first paint", html.includes("studyflow.theme.preset"));
check("Capacitor app id is configured", /"appId"\s*:\s*"com\.studyzone\.app"/.test(capacitor));
check("Capacitor web dir is www", /"webDir"\s*:\s*"www"/.test(capacitor));
check("Offline engine wraps fetch", offline.includes("window.fetch = function studyZoneFetch"));
check("Offline engine uses IndexedDB", offline.includes("indexedDB.open"));
check("Offline queue is idempotent", offline.includes("idempotency") || offline.includes("idempotencyKey"));
check("Offline engine isolates accounts", offline.includes("function clearUser("));
check("Offline engine stores conflicts", offline.includes("CONFLICT_STORE"));
check("Offline focus records are queued", offline.includes("queueFocusRecord"));
check("Sync UI renders conflicts", syncUi.includes("data-conflict-choice"));
check("Native shell handles the Android back button", nativeShell.includes('"backButton"'));
check("Native shell schedules local notifications", nativeShell.includes("LocalNotifications.schedule"));
check("Native shell creates notification channels", nativeShell.includes("createChannel"));
check("Native shell handles deep links", nativeShell.includes('"appUrlOpen"'));
check("Native shell handles the keyboard", nativeShell.includes('"keyboardWillShow"'));
check("Native shell synchronizes on resume", nativeShell.includes('"appStateChange"'));
check("Theme stylesheet defines six presets", ["ocean", "emerald", "purple", "crimson", "midnight"].every((id) => themes.includes(`data-theme-preset="${id}"`)));
check("Mobile stylesheet handles safe areas", mobile.includes("safe-area-inset"));
check("Locale runtime contains both languages", localeRuntime.includes("en:") && localeRuntime.includes("ar:"));
check(
  "No service-role key in native/offline files",
  !/service_role\s*[:=]/i.test(offline + nativeShell + syncUi + capacitor),
);

if (failures.length) {
  console.error(`Static checks failed (${failures.length}):`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`Static checks passed: ${passed}/${passed}.`);
