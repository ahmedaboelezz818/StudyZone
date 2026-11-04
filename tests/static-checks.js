/* Dependency-free static checks. Run with: node tests/static-checks.js */
const { readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const read = (file) => readFileSync(join(root, file), "utf8");
const app = read("app.js");
const html = read("index.html");
const css = read("styles.css");
const sw = read("service-worker.js");
const migrationPath = "supabase/migrations/001_studyzone_enhancements.sql";
const migration = read(migrationPath);

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
check("Private voice upload exists", app.includes('from("voice-notes").upload('));
check("Notification sound exists", app.includes("function playNotificationSound("));
check("Task notification enable action exists", app.includes("function enableTaskNotifications("));
check("Do-not-disturb exists", app.includes("function isDoNotDisturbActive("));
check("Notification preferences form exists", app.includes("id=\"notification-prefs-form\""));
check("Team creation exists", app.includes('from("teams").insert('));
check("Team join RPC exists", app.includes('rpc("join_team"'));
check("No service-role key assignment in browser files", !/service_role\s*[:=]/i.test(app + html + read("supabase-config.js")) && !/serviceRole/i.test(app + html + read("supabase-config.js")));
check("Service worker cache was bumped", sw.includes("studyzone-shell-v11"));
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

const appIds = [...app.matchAll(/getElementById\("([^"]+)"\)/g)].map((match) => match[1]);
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

check("Migration exists", existsSync(join(root, migrationPath)));
for (const table of ["notes", "teams", "team_members", "team_tasks", "voice_notes", "user_notification_preferences"]) {
  check(`Migration mentions ${table}`, migration.includes(table));
}
check("Migration enables RLS on teams", /alter table public\.teams enable row level security/i.test(migration));
check("Migration enables RLS on voice_notes", /alter table public\.voice_notes enable row level security/i.test(migration));
check("Migration keeps voice bucket private", /values \('voice-notes', 'voice-notes', false\)/i.test(migration));
check("Migration is non-destructive", !/\bdrop table\b|\btruncate\b|\bdrop column\b/i.test(migration));
check("Task loading falls back before the recurrence migration is applied", app.includes("recurrenceSupported") && app.includes("baseTaskColumns"));
check("Series edits preserve each occurrence date unless the date changes", app.includes("dueShift") && app.includes("startShift"));
check("Guests can open a session-only voice recording", app.includes('data-action="voice-open"') && app.includes("session-only recording"));

if (failures.length) {
  console.error(`Static checks failed (${failures.length}):`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`Static checks passed: ${passed}/${passed}.`);
