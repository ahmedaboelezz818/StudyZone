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
const migration4Path = "supabase/migrations/004_team_task_system.sql";
const migration4 = existsSync(join(root, migration4Path))
  ? read(migration4Path)
  : "";
const migration5Path = "supabase/migrations/005_fix_notification_type_enum.sql";
const migration5 = existsSync(join(root, migration5Path))
  ? read(migration5Path)
  : "";
const migration6Path = "supabase/migrations/006_team_live_communication.sql";
const migration6 = existsSync(join(root, migration6Path))
  ? read(migration6Path)
  : "";
const migration8Path = "supabase/migrations/008_team_live_reactions_and_rpc_compat.sql";
const migration8 = existsSync(join(root, migration8Path))
  ? read(migration8Path)
  : "";
const teamLive = read("team-live.js");
const teamLiveCore = read("team-live-core.js");
const teamLiveCss = read("team-live.css");
const turnFunction = read("supabase/functions/turn-credentials/index.ts");

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
check("Note editor content is excluded from UI translation", /contenteditable\]:not\(\[contenteditable='false'\]\)/.test(app) && app.includes("data-sz-no-translate"));
check("Note editor tracks IME composition safely", app.includes("let noteEditorComposing = false") && app.includes("compositionstart") && app.includes("compositionend"));
check("Note editor defers autosave until composition ends", app.includes("noteSaveDeferred") && /if \(noteEditorComposing/.test(app));
check("Note editor keeps auto text direction", app.includes('id="note-editor" contenteditable="true" dir="auto"'));
check("Editor CSS does not force bidi plaintext on the editable", !/unicode-bidi:\s*plaintext\s*;/.test(css) && /unicode-bidi:\s*normal/.test(css) && /text-align:\s*start/.test(css));
check("MediaRecorder recording exists", app.includes("new window.MediaRecorder("));
check("Private voice upload exists", /\.from\(\s*["']voice-notes["']\s*\)\s*\.upload\(/.test(app));
check("Notification sound exists", app.includes("function playNotificationSound("));
check("Task notification enable action exists", app.includes("function enableTaskNotifications("));
check("Do-not-disturb exists", app.includes("function isDoNotDisturbActive("));
check("Notification preferences form exists", app.includes('id="notification-prefs-form"'));
check("Team creation exists", /\.from\(\s*["']teams["']\s*\)\s*\.insert\(/.test(app));
check("Team join RPC exists", app.includes('rpc("join_team"'));
check("No service-role key assignment in browser files", !/service_role\s*[:=]/i.test(app + html + read("supabase-config.js")) && !/serviceRole/i.test(app + html + read("supabase-config.js")));
check("Service worker cache was bumped", /studyzone-shell-v(3[7-9]|[4-9]\d|\d{3,})\b/.test(sw));

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
check("Index no longer ships the quick capture floating button", !html.includes('class="quick-capture-fab"') && !html.includes('data-action="quick-capture-open"'));
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
  check("Android/offline migration is optional in this checkout", true);
}

if (migration4) {
  check("Team task system migration exists", true);
  for (const table of [
    "team_task_assignees",
    "team_task_subtasks",
    "team_task_activity",
  ]) {
    check(`Migration 004 mentions ${table}`, migration4.includes(table));
  }
  check(
    "Migration 004 enables RLS on the new team tables",
    /alter table public\.team_task_assignees enable row level security/i.test(migration4) &&
      /alter table public\.team_task_subtasks enable row level security/i.test(migration4) &&
      /alter table public\.team_task_activity enable row level security/i.test(migration4),
  );
  check(
    "Migration 004 guards permissions in the database",
    /create trigger team_tasks_guard_trigger/i.test(migration4) &&
      /Only a team manager can create team tasks/i.test(migration4),
  );
  check(
    "Migration 004 scopes teammate profiles through a security-definer RPC",
    /function public\.team_profiles/i.test(migration4) &&
      /grant execute on function public\.team_profiles\(uuid\) to authenticated/i.test(migration4),
  );
  check(
    "Migration 004 limits teammate avatars to the avatars folder",
    /team members can read teammate avatars/i.test(migration4) &&
      /name like '%\/avatars\/%'/i.test(migration4),
  );
  check(
    "Migration 004 is additive",
    !/\bdrop table\b|\btruncate\b|\bdrop column\b/i.test(migration4),
  );
  check(
    "Migration 004 can be re-run safely",
    /add column if not exists/i.test(migration4) &&
      /create table if not exists/i.test(migration4) &&
      /drop policy if exists/i.test(migration4),
  );
} else {
  check("Team task system migration is optional in this checkout", true);
}

if (migration5) {
  check("Notification enum fix migration exists", true);
  check(
    "Notification fix resolves enum labels from pg_enum",
    migration5.includes("studyzone_notification_label") && migration5.includes("pg_enum"),
  );
  check(
    "Notification insert casts to the existing enum type",
    migration5.includes("$2::%s") && migration5.includes("insert into public.notifications"),
  );
  check(
    "Notification fix is additive and keeps RLS enabled",
    !/\bdrop table\b|\btruncate\b|\bdrop column\b/i.test(migration5) && !/disable row level security/i.test(migration5),
  );
} else {
  check("Notification enum fix migration is optional in this checkout", true);
}

check(
  "Team task cards render real assignee avatars",
  app.includes("function teamTaskAssigneeMarkup(") &&
    app.includes("function teamAvatar(") &&
    app.includes("team-avatar-stack") &&
    app.includes("team-avatar-overflow"),
);
check(
  "Team detail supports participants, subtasks and activity",
  app.includes("function renderTeamTaskDetailBody(") &&
    app.includes("function teamTaskActivityMarkup(") &&
    app.includes("function teamSubtaskRowMarkup("),
);
check(
  "My team tasks page is registered",
  app.includes('"team-tasks": myTeamTasksPage') &&
    app.includes('"team-tasks": "My team tasks"') &&
    html.includes('data-page="team-tasks"'),
);
check(
  "Team task tables participate in the offline queue",
  read("offline-sync.js").includes('"team_tasks"') &&
    read("offline-sync.js").includes('"team_task_assignees"') &&
    read("offline-sync.js").includes('"team_task_subtasks"') &&
    read("offline-sync.js").includes("TEAM_TABLES"),
);

// Team Live communication checks.
check(
  "Team Live page is registered",
  app.includes('"team-live": () =>') &&
    app.includes('"team-live": "Team chat & calls"') &&
    html.includes('data-page="team-live"') &&
    html.includes('id="team-live-count"'),
);
check(
  "Index loads the Team Live core, module and styles before the app",
  html.indexOf("team-live-core.js") < html.indexOf("team-live.js") &&
    html.indexOf("team-live.js") < html.indexOf("app.js") &&
    html.includes("team-live.css"),
);
check(
  "Team Live is initialized with the existing app session and team state",
  app.includes("window.StudyZoneTeamLive?.init?.(") &&
    app.includes("getSupabase: () => supabase") &&
    app.includes("getSelectedTeamId: () => selectedTeamId") &&
    app.includes("getTaskParticipantIds:"),
);
check(
  "Team page exposes chat and calls without changing task permissions",
  app.includes("window.StudyZoneTeamLive?.teamPanel?.(selected)") &&
    app.includes("window.StudyZoneTeamLive?.taskActions?.(task, team)") &&
    app.includes("teamCanManageTeam(team)"),
);
check(
  "Team Live supports direct, group and task conversations",
  teamLive.includes("team_chat_conversations") &&
    teamLive.includes("team_live_open_direct") &&
    teamLive.includes("team_live_open_task_chat") &&
    teamLive.includes("team_live_ensure_group"),
);
check(
  "Team chat supports replies, deletion, search and read receipts",
  teamLive.includes("reply_to_id") &&
    teamLive.includes("deleted_at") &&
    teamLive.includes('data-live-input="message-search"') &&
    teamLive.includes("team_chat_mark_read") &&
    teamLive.includes("team_conversation_reads"),
);
check(
  "Team chat validates attachments before upload",
  teamLive.includes("core.validateAttachment(file)") &&
    teamLive.includes("team-chat") &&
    teamLive.includes("attachment_size") &&
    teamLiveCore.includes("MAX_ATTACHMENT_BYTES") &&
    teamLiveCore.includes("MAX_MESSAGE_LENGTH"),
);
check(
  "Calls use WebRTC media and Supabase only for signaling",
  teamLive.includes("new RTCPeerConnection(") &&
    teamLive.includes("getUserMedia") &&
    teamLive.includes("team_call_signals") &&
    // Voice notes use MediaRecorder legitimately; call signaling must not
    // carry audio through Supabase or record calls.
    !/(startCall|setupCall|subscribeCallSignals)\s*\([^)]*\)[\s\S]*?MediaRecorder/.test(teamLive),
);
check(
  "Voice recorder exists and uses MediaRecorder with real level analysis",
  teamLive.includes("new MediaRecorder") &&
    teamLive.includes("preferredVoiceMime") &&
    teamLive.includes("sampleVoiceLevel") &&
    teamLive.includes("startVoiceMeter"),
);
check(
  "Calls provide mute, camera, camera switch, screen share and quality",
  teamLive.includes("toggleMute") &&
    teamLive.includes("switchCamera") &&
    teamLive.includes("toggleScreenShare") &&
    teamLive.includes("qualityFromSample") &&
    teamLive.includes("pc.restartIce()"),
);
check(
  "Incoming calls provide accept, decline, ringing and missed handling",
  teamLive.includes("team_live_pending_invites") &&
    teamLive.includes("team_live_respond_call") &&
    teamLive.includes("INCOMING VIDEO CALL") &&
    teamLive.includes("Missed call"),
);
check(
  "Group calls are capped and cannot duplicate in the database",
  teamLiveCore.includes("MAX_CALL_PARTICIPANTS = 8") &&
    migration6.includes("team_calls_one_live") &&
    migration6.includes("A group call is already in progress in this team") &&
    migration6.includes("You are already in a call") &&
    migration6.includes("c.scope = 'group'"),
);
check(
  "TURN credentials are minted server-side with HMAC and no browser secret",
  turnFunction.includes("TURN_SHARED_SECRET") &&
    turnFunction.includes("hmacSha1Base64") &&
    turnFunction.includes("client.auth.getUser()") &&
    !/TURN_SHARED_SECRET\s*[:=]\s*["'][^"']+["']/i.test(teamLive + html + read("supabase-config.js")),
);
check(
  "Team Live cleanup stops local streams and peer connections",
  teamLive.includes("teardownCall") &&
    teamLive.includes("getTracks().forEach((track) => track.stop())") &&
    teamLive.includes("peer.pc.close()"),
);
check(
  "Migration 006 exists and creates the live communication tables",
  Boolean(migration6) &&
    [
      "team_conversations",
      "team_calls",
      "team_messages",
      "team_conversation_reads",
      "team_call_participants",
      "team_call_signals",
    ].every((table) => migration6.includes(table)),
);
check(
  "Migration 006 enables RLS and re-checks membership in security-definer RPCs",
  /alter table public\.team_conversations enable row level security/i.test(migration6) &&
    /alter table public\.team_calls enable row level security/i.test(migration6) &&
    /alter table public\.team_messages enable row level security/i.test(migration6) &&
    /security definer/i.test(migration6) &&
    /function public\.team_live_is_member/i.test(migration6),
);
check(
  "Migration 006 adds a private chat attachment bucket",
  migration6.includes("'team-chat'") &&
    migration6.includes("team_chat_attachments_select_member") &&
    migration6.includes("team_live_storage_conversation"),
);
check(
  "Migration 006 is additive",
  !/\bdrop table\b|\btruncate\b|\bdrop column\b|\bdisable row level security\b/i.test(migration6),
);
check(
  "Migration 006 guards message identity and supports soft deletion",
  /function public\.team_live_prepare_message/i.test(migration6) &&
    /function public\.team_live_guard_message_update/i.test(migration6) &&
    migration6.includes("Messages can only be soft-deleted"),
);
check(
  "Reaction migration exists and enforces one emoji per user per message",
  Boolean(migration8) &&
    /create unique index if not exists team_message_reactions_one_per_user/i.test(migration8) &&
    /on public\.team_message_reactions \(message_id, user_id\)/i.test(migration8) &&
    /alter table public\.team_message_reactions enable row level security/i.test(migration8) &&
    /replica identity full/i.test(migration8),
);
check(
  "Reaction migration ships the RPC overloads used by the client",
  [
    "team_live_join_call(p_call_id uuid)",
    "team_live_leave_call(p_call_id uuid)",
    "team_live_respond_call(p_call_id uuid, p_accept boolean)",
    "team_live_pending_invites()",
    "team_chat_mark_read(",
  ].every((signature) => migration8.includes(signature)),
);
check(
  "Reaction migration is additive and re-runnable",
  !/\bdrop table\b|\btruncate\b|\bdrop column\b|\bdisable row level security\b/i.test(migration8) &&
    /create table if not exists public\.team_message_reactions/i.test(migration8) &&
    /drop policy if exists/i.test(migration8),
);
check(
  "Reaction UI replaces a user's previous emoji and updates optimistically",
  teamLive.includes("setLocalUserReaction") &&
    teamLive.includes("S.reactionBusy.has(id)") &&
    teamLive.includes(".delete()") &&
    teamLive.includes("const removing = Boolean(existing && existing.emoji === emoji)"),
);
check(
  "Team Live files are included in the Capacitor build and service worker",
  read("scripts/build-web.js").includes('"team-live.js"') &&
    read("scripts/build-web.js").includes('"team-live.css"') &&
    sw.includes('"./team-live.js"') &&
    sw.includes('"./team-live.css"'),
);
check(
  "Flashcards core, database, sync and UI files are present and wired into the shell",
  ["flashcards-core.js", "flashcards-db.js", "flashcards-sync.js", "flashcards.js", "flashcards.css"].every((file) =>
    existsSync(join(root, file)),
  ) &&
    html.includes("flashcards-core.js") &&
    html.includes("flashcards-db.js") &&
    html.includes("flashcards-sync.js") &&
    html.includes("flashcards.js") &&
    html.includes("flashcards.css") &&
    html.includes('data-page="flashcards"'),
);
check(
  "Flashcards use a real spaced repetition core and local persistence",
  read("flashcards-core.js").includes("learning_steps") &&
    read("flashcards-core.js").includes("relearning_steps") &&
    read("flashcards-core.js").includes("estimateButtonIntervals") &&
    read("flashcards-db.js").includes("indexedDB") &&
    read("flashcards-sync.js").includes("flashcard_cards") &&
    read("flashcards.js").includes("Start review"),
);
check(
  "Android declares camera and microphone hardware support",
  read("android/app/src/main/AndroidManifest.xml").includes("android.permission.CAMERA") &&
    read("android/app/src/main/AndroidManifest.xml").includes("android.hardware.camera") &&
    read("android/app/src/main/AndroidManifest.xml").includes("android.permission.RECORD_AUDIO"),
);
check(
  "Team Live styles are responsive and use theme tokens",
  teamLiveCss.includes("@media") &&
    teamLiveCss.includes("var(--") &&
    teamLiveCss.includes(".live-shell") &&
    teamLiveCss.includes(".live-call-overlay"),
);

// Android / offline / theme platform checks.
const offline = read("offline-sync.js");
const nativeShell = read("native-shell.js");
const syncUi = read("sync-ui.js");
const themes = read("themes.css");
const themePresets = read("themes-presets.css");
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
check(
  "Offline queue stores the documented operation fields",
  [
    "operation_id",
    "user_id",
    "entity_type",
    "entity_id",
    "operation_type",
    "payload",
    "created_at",
    "updated_at",
    "sync_status",
    "retry_count",
    "last_error",
    "idempotency_key",
  ].every((field) => offline.includes(field)),
);
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
check(
  "Theme stylesheet defines every preset",
  [
    "original",
    "ocean",
    "emerald",
    "purple",
    "crimson",
    "midnight",
    "orange",
    "sky",
    "cyan",
    "turquoise",
    "teal",
    "mint",
    "lime",
    "violet",
    "lavender",
    "indigo",
    "rose",
    "pink",
    "magenta",
    "coral",
    "amber",
    "yellow",
    "graphite",
  ].every((id) => themePresets.includes(`data-theme-preset="${id}"`)),
);
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
