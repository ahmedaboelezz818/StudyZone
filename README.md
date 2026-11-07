# Study Zone

Study Zone is a responsive, plain HTML/CSS/JavaScript student workspace using the Brunswick Green, Emerald Green, and Polar identity. There is no frontend build step.

## Run locally

Run the included dependency-free static server (rather than opening `index.html` directly):

```text
node server.js
```

Then open `http://127.0.0.1:5500`.

## Connect Supabase

1. Apply the SQL migrations in `supabase/migrations/` in order in the Supabase SQL Editor (or with `supabase db push`). `001_studyzone_enhancements.sql` is idempotent and non-destructive; it adds the note color column, recurring-task indexes, private teams, voice-note metadata, and notification preferences. `002_focus_intelligence.sql` is also idempotent and additive: it adds all-day/usage columns to `tasks`, the `task_routines` and `task_routine_days` tables, `focus_distractions`, `study_journal_entries`, indexes, triggers, and owner-scoped RLS policies. The original `supabase/schema.sql` referenced by earlier versions of this README is not present in this repository, so apply the migrations on top of an existing Study Zone project rather than assuming a fresh schema file can be run. The app detects missing columns/tables at runtime and keeps working with reduced features until each migration is applied.
2. Add the project URL and **public anon/publishable key** to `supabase-config.js`.
3. Keep the `service_role` key out of this project and all browser code.
4. For daily Web Push, generate a VAPID key pair (for example, `npx web-push generate-vapid-keys`) and configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a `mailto:` contact), and `DEADLINE_CRON_SECRET` as server-side Edge Function secrets. Put only the matching public key in `supabase-config.js` as `vapidPublicKey`; never add the private key or service-role key to browser files. A current public key is already stored in `supabase-config.js` (`vapidPublicKey`); the matching private key, subject, and cron secret must still be set on the deployed `deadline-reminders` Edge Function before task notifications can be delivered.
5. Deploy `supabase/functions/deadline-reminders`, then schedule a trusted job to POST to `/functions/v1/deadline-reminders` at least every 15 minutes with the `x-deadline-cron-secret` header. It creates deadline/daily notifications idempotently and delivers pending Web Push notifications.
6. Serve the app over HTTPS (localhost is supported for development), sign in, and enable push reminders in Settings. The browser asks for notification permission only after the user enables them. The daily check-in uses the device timezone and selected time; disabling push reminders stops further sends. Push delivery while the app is closed depends on browser/OS support, permission, and the scheduled Edge Function.

The schema creates the user-owned tables and RLS policies, a private `studyflow-files` Storage bucket, private administrator allowlist, focus-session RPCs, and server-side reward functions. Deadlines and tasks support account-backed create/read/update/delete after sign-in. Subjects, schedules, files, notes, goals, exams/results, and profile editing also use the account tables; study files and profile photos use private Storage and signed URLs. XP and level achievements are awarded by trusted database functions; milestone rewards are granted once when the account reaches levels 5, 10, 20, and 50. Guest task data remains local to the browser. Web Push and scheduled reminders remain inactive until the schema is applied, the Edge Function is deployed with its secrets, and the cron job is configured.

Tasks and deadlines can repeat daily, weekly, monthly, or on selected weekdays. Choose a repeat-until date within one year; each occurrence is saved as an independent task so completion and XP are tracked separately. Deadlines also have a start date; the calendar draws a bar across each date from its start through its due date. Editing or deleting a repeated occurrence now asks for a scope: this occurrence only, this and all future occurrences, or the whole series, with an affected-count preview. Editing series details (title, subject, priority, and so on) keeps each occurrence's own date; changing the date shifts every selected occurrence by the same amount. Past occurrences are never regenerated after they are deleted. "Stop repeating" keeps the existing copies and removes their series metadata. Until `001_studyzone_enhancements.sql` is applied, the app detects the missing recurrence columns, keeps normal task loading and non-repeating task creation working, and asks you to apply the migration before creating a repeating task.

## Daily task workspace

The Tasks page opens on today and only shows what belongs to the selected day. Overdue, no-date, and completed work sit in separate collapsible sections, so a task never appears in two sections at once. The page includes previous/next day navigation, a seven-day strip with per-day open counts, a completion ring, per-day search and status filters, an "All tasks" view, an edit dialog, and a move dialog. Dates are built from local calendar parts (`getFullYear`, `getMonth`, `getDate`) so a task does not shift to the previous or next day because of UTC conversion.

## Routines, all-day tasks, and priorities

Permanent routines are stored once in `task_routines` and rendered as virtual tasks for each matching date; completion, skip, or reopen is stored per date in `task_routine_days`. A routine supports daily, selected-weekday, and fixed-interval schedules, an optional end date, and pause/resume. Pausing records the pause date so past days keep their history, and editing or deleting the definition never rewrites earlier completion rows. Because no daily copy of the task is created, there is no duplicate-occurrence or rollover drift; the selected day is always derived from local calendar parts.

Permanent routines coexist with the earlier materialized series model (`recurrence_group_id` + `001` columns), which remains supported for backwards compatibility. All-day tasks use the new `tasks.is_all_day` flag and are labelled "All day" instead of a fake time; an untimed task never becomes overdue merely because the clock passed a default time.

The Tasks page also offers **Smart priorities** (an explained, suggested order based on overdue state, priority, postponements, and opens) and **Most used** (ranked from `open_count`/`completed_count`). Suggestions never change a task's fields or a user's chosen order unless the user explicitly enables smart order. Quick capture (`Q`) and global search (`Ctrl/⌘+K`) are available from the topbar and floating action button.

## Focus intelligence

The Focus page supports a short preparation step (subject, linked task, session goal, tools, session length) before starting. The countdown remains timestamp-based, so recovery after sleep, tab suspension, or reload does not lose time, and a session can only be saved once because saves use a per-session idempotency key. A per-session duration overrides the global Pomodoro length without changing saved settings.

Deep focus hides navigation and unrelated chrome; full screen uses the browser Fullscreen API when available. During an active focus session, **Distracted** logs a reason (with an optional custom reason) to `focus_distractions`; today's, this week's, and most-common counts are shown on the Focus page and feed the weekly review. Break suggestions follow the configured long-break interval, and completion sounds are the existing configurable alert sounds.

Focus soundscapes (Rain, White, Brown, Forest, Fireplace) are synthesized in-browser with the Web Audio API, so no external audio files or licences are required. The selection and volume are stored locally and the sound stops when the session or page ends.

## Study journal and weekly review

The Study journal page records an optional daily reflection: what went well, what stayed unfinished, what got in the way, a 1–5 focus rating, and the most important thing for tomorrow. One entry per local date is stored in `study_journal_entries` for signed-in users and in browser storage for guests. Past reflections can be reopened by date. A weekly review compares this week with last week on focus hours, sessions, task completion, top subject, and distractions, then offers non-punitive suggestions. Streaks only count activity days; rest days are not penalized or erased.

## Backup and restore

Settings can export a JSON backup containing tasks, routines, per-date routine history, notes, journal entries, focus records, distractions, and preferences. Restore validates the file type/version/size first, then merges: tasks are deduplicated by normalized title plus due date and notes by title plus created time. Existing records are never overwritten, imports are capped at 500 tasks and 500 notes per restore for safety, and nothing is uploaded anywhere; a guest restore stays in the browser.

## Rich notes and voice notes

Notes use the existing `notes.content` column for sanitized HTML: headings, paragraphs, bold/italic/underline/strikethrough, font size, text and highlight colors, lists, checklists, alignment, links, images, dividers, undo/redo, Ctrl+B/I/U, and RTL/LTR. Autosave reports unsaved, saving, saved, and failed states. Pinning uses the existing `is_favorite` column. The optional per-note color uses `notes.color`, which is enabled by the migration; until then the UI hides the color swatches and explains why.

Voice notes are recorded with `MediaRecorder`, including permission-denial handling, pause/resume, preview, and a 10-minute cap. Authenticated recordings upload to the private `voice-notes` Storage bucket under `<user-id>/…` and metadata is stored in `voice_notes`; playback uses short-lived signed URLs, and rename/delete are supported. Guest recordings are previewed for the current browser session only and are clearly labelled as such.

## Teams

The Teams page supports creating a private team, joining with a short code, listing members, and adding, completing, or deleting shared team tasks. RLS policies restrict every team row to its owner or members; the `join_team` RPC is the only way to join by code, and the client never receives the service-role key. The migration must be applied before the Teams page can load; otherwise the page shows an actionable setup message instead of failing silently.

## Static checks

The website has no frontend build step. The Android wrapper is generated with Capacitor. Run every dependency-free syntax, static, platform and localization check with:

```text
npm install
npm run check
```

The checks cover required page functions, modal/ID wiring, safe date helpers, absence of a service-role key in browser files, routine/journal/distraction/search/backup wiring, migration contents/RLS, cache versioning, the Capacitor configuration, the offline queue, native notification wiring, the six theme presets, and Arabic/English dictionary parity. They do not replace authenticated multi-user testing against a real Supabase project or a physical Android device.

## Admin authorization

The schema creates a private `site_admins` allowlist with RLS enabled and no client read/write grants. The `is_current_user_admin()` RPC only returns whether the caller's authenticated user ID is on that list; it does not expose the allowlist. The browser hides the Admin link until this RPC succeeds and redirects denied or unverifiable sessions away from the Admin page. The Admin dashboard reads a searchable, paginated account list through `admin_list_users()`, a `SECURITY DEFINER` function that checks the allowlist again on every call; direct client access to `auth.users` is not granted.

To register an administrator, sign up and confirm the account, then find its UUID in Supabase **Authentication → Users**. In the SQL Editor, insert that exact UUID into `public.site_admins`; to revoke access, delete that user's row. These are trusted database operations; never grant admin by changing browser state or user metadata.

The Admin page is read-only and shows registered account names, email addresses, roles, join dates, last sign-in, and email-confirmation status. It does not expose password data or provide account-management actions. The client-side gate is for navigation and UX, not the security boundary.

On the first visit in a browser profile, the sign-in/create-account dialog opens before the guest preview. Dismissing it allows guest access; the prompt is not shown again on that browser unless its local storage is cleared.

The language selector in Settings switches the shared navigation, all app pages, forms, dialogs, status messages, and accessibility labels between English and Arabic without reloading. Arabic sets the document to RTL and uses Arabic-localized dates and numbers; English restores LTR. Guest preferences are stored locally, and signed-in preferences sync to the profile. The existing plain-JavaScript app uses its dictionaries in `app.js` rather than an i18n package. User-entered names and content remain unchanged when switching languages.

The Focus page uses an animated CSS flip clock and timestamp-based countdown. Guest timer state, settings, and completed sessions stay in browser storage; authenticated timer preferences and history use the owner-scoped `user_settings` and `study_sessions` tables. Authenticated users can read their own session rows; start, pause, resume, finish, and cancel use owner-scoped database RPCs, while direct session writes are revoked. The functions track elapsed run time across pauses, and only a completed focus session verified by the database can earn XP. Failed saves remain pending and are not displayed as saved history. History has a per-user idempotency key and owner-matched optional task/subject links. Browser notifications require explicit permission and are best-effort while the app is open; an installed PWA cannot guarantee alerts while closed.

## Rewards and motion

Server-side rules award 10 XP once per completed task, 15 XP per completed focus session, and achievement awards. Database uniqueness constraints and triggers prevent repeat rewards; task rewards, verified focus rewards, streak updates, and achievement unlocks are never calculated or written by the browser. Focus time for signed-in accounts is tracked through authenticated database RPCs, including accumulated run time across pauses. Streak days use each profile's IANA timezone, falling back to UTC.

Guests can use the timer and see local completion feedback, but do not earn account XP or synced achievements. The app supports Full Motion, Reduced Motion, and Motion Off from Settings, and also respects the operating-system reduced-motion preference. The saved setting is device-local. CSS/Web Animations are used because this project is plain HTML/CSS/JavaScript, not React; no Motion for React dependency or build pipeline was introduced.

## Install Study Zone

The app includes `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, a Web App Manifest in `public/manifest.json`, and four branded PNG icons in `public/icons/`. The service worker caches only the static app shell and icons; it does not cache the Supabase client configuration, signed-in data, or API responses. Offline mode provides the cached shell, but network-backed data cannot be loaded or saved while disconnected. The included `server.js` serves the manifest and icon assets at the root URLs referenced by the app, and the included `vercel.json` rewrites send `/manifest.json` and `/icons/*` to the public assets for static hosting. No build step or additional PWA plugin is required. Serve the app over HTTPS for installation (localhost is allowed for development).

- **Android:** In a supported browser (Google Chrome, Microsoft Edge, Samsung Internet, Opera), use the in-app Install app button and accept the browser prompt, or use the browser menu's Install app / Add to Home screen option when available. Firefox and other browsers offer their own supported installation paths or instructions.
- **iPhone/iPad:** Open the site in Safari, tap Share, then choose Add to Home Screen, then confirm. The in-app Install button detects the iOS standalone-capable environment and shows these manual instructions instead of a fake automatic prompt.
- **Desktop:** Use the native browser install prompt when supported (Google Chrome, Microsoft Edge, Opera). In Safari on macOS, use File > Add to Dock when available.

The install experience tracks one state: `Install Available` (a `beforeinstallprompt` event is held and used only after an explicit user action), `Already Installed` (standalone display mode is detected), or `Instructions` (the manual Add to Home Screen / browser menu steps for the current browser and device). The install prompt is never fired without a user gesture, and it is not shown for iOS or unsupported browsers.

Task notifications in the installed app come from the Web Push setup: enable task notifications from the Notifications page; the app requests permission and subscribes via the service worker. Delivery while closed still requires OS/browser push support, the scheduled Edge Function, VAPID configuration, and a reachable HTTPS origin.

The service worker caches only the versioned static app-shell files and branded icons. It does not cache requests to application data endpoints or other dynamic same-origin URLs. When an update is ready, use the in-app update notice to activate it and reload. Offline access is limited to the cached shell; Supabase and other network-backed features still require a connection.

## Notes

- In preview mode, task, note, and voice-note edits are stored in this browser (voice previews are session-only). Sign in for account-backed sync.
- Supabase JS v2 is vendored locally at `vendor/supabase.js`, and fonts are stored in `fonts/`, so the interface shell works without a CDN. Supabase auth/database/storage still needs a network connection.
- The Admin page shows no fabricated user-wide metrics. Admin authorization is backed by the `site_admins` allowlist; no cross-user admin data endpoint is implemented.
- Voice transcription is optional and not implemented in this round; `voice_notes.transcription_status` is ready for a future Edge Function.
- Notification sounds and do-not-disturb hours are available in Settings, persist locally, and sync to `user_notification_preferences` when the migration has been applied. Task reminder sounds, Pomodoro sounds, preview, volume, duration, and repeat controls are available in Settings. The notification list is refreshed while the app is open; it is not a realtime subscription.
- The `team_task_comments` table is created by the migration, but the team comment UI is not wired yet.
- Recurring-series changes use separate owner-scoped updates. A network failure partway through a series update can leave some occurrences updated; there is no transactional series RPC yet.
- `002_focus_intelligence.sql` has not been applied to the live Supabase project from this environment (no admin/service credentials), so the new routines, distractions, and journal tables are only present locally until you run it. The app detects this and stores guest data locally, but signed-in sync of the new tables requires the migration.
- Offline mode now keeps the cached app shell plus an IndexedDB read cache and write queue for tasks, notes, subjects, schedules, goals, exams, routines, journal entries, distractions, profiles, settings and focus-session RPCs. Pending writes are replayed automatically with idempotency keys; simultaneous edits are detected and surfaced in Settings for the user to resolve. Storage-backed files and team collaboration stay online-only and say so explicitly.
- No browser automation suite is included. Verification uses `npm run check` plus manual Android emulator/device testing; authenticated RLS and push delivery still need testing against the live Supabase/Firebase projects.


## Android app (Capacitor)

The website in the repository root is still the canonical app. `scripts/build-web.js` copies it into `www/`, and Capacitor packages that folder as a native Android application. No page, design or feature is rebuilt or replaced.

### Requirements

- Node.js 18 or newer.
- Android Studio with Android SDK 35 (or the SDK required by the installed Capacitor version).
- JDK 21 (the JDK bundled with Android Studio is sufficient).
- For release builds: a private keystore and its passwords.

### Build and run

```text
npm install
npm run build:web
npx cap add android      # first time only
npm run cap:sync         # copy the latest website into the Android project
npm run android:debug    # assemble a debug APK
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. Open the project with `npm run cap:open` to run it on an emulator or a connected device from Android Studio. Every change to the website must be followed by `npm run cap:sync` before rebuilding.

### Release signing

1. Create a keystore once (keep it out of git):

   ```text
   keytool -genkeypair -v -keystore studyzone-release.jks -alias studyzone -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Create `android/keystore.properties` (ignored by git):

   ```text
   storeFile=../studyzone-release.jks
   storePassword=YOUR_STORE_PASSWORD
   keyAlias=studyzone
   keyPassword=YOUR_KEY_PASSWORD
   ```

3. Reference it from `android/app/build.gradle` as described in the Capacitor signing guide, then run `npm run android:release`. The release APK is written to `android/app/build/outputs/apk/release/`. Use `bundletool` or Android Studio to produce an `.aab` for Google Play.

The keystore, passwords, `keystore.properties`, `google-services.json` and any service-role key are deliberately excluded from the repository. They cannot be generated by this project and must be supplied by the account owner.

### Native behaviour

- `native-shell.js` detects Capacitor and configures the status bar, splash screen, keyboard resize, safe areas, hardware back button, deep links and app lifecycle. On the website it is a no-op.
- The Android back button closes an open dialog, then the mobile sidebar, then returns to the dashboard; pressing it again at the dashboard minimises the app.
- Resuming the app reconciles the timestamp-based focus timer, refreshes reminders and runs the offline sync queue. A focus session is still saved only once because the database RPC receives the per-session idempotency key.
- Local notifications use three Android channels: study reminders, focus timer and achievements. Per-type switches in Settings are respected. Reminders are scheduled from the data already loaded by the app, so they work while the app is closed.
- File and image inputs continue to use the Android document picker and camera because `captureInput` is enabled.

### Push notifications (external requirement)

Local notifications need no external service. Real server-sent push requires a Firebase project:

1. Create a Firebase Android app with package name `com.studyzone.app`.
2. Download `google-services.json` into `android/app/`.
3. Add the Google Services Gradle plugin and the Firebase Messaging dependency as described by Capacitor Push Notifications.
4. Deploy a trusted server/Edge Function that reads `device_push_tokens` and sends FCM messages with the service-role key. The key must never appear in `www/` or any browser file.

Without these external files, the app still builds and local notifications still work; only remote push delivery is disabled.

## Offline-first data

`offline-sync.js` loads before the Supabase client and wraps `window.fetch`. GET responses for user-owned tables are cached in IndexedDB per account. Writes to safe text-first tables and focus RPCs are queued when the network is unavailable, receive a generated UUID and idempotency key, and replay in order when connectivity returns. The queue is retried automatically every 30 seconds, when the app becomes visible, when Android reports a network change, and when the user taps **Sync now**.

Each account has an isolated cache, queue and conflict list. Signing out clears the local copy for that account. Settings shows the live state (Synced, Pending sync, Syncing, Sync failed, Offline), queued/failed counts, the last sync time, and any conflicts. For a conflict the user can keep the device version or the server version. Files, voice notes and team collaboration remain online-only and return an explicit message rather than a false success.

Apply `supabase/migrations/003_android_offline_notifications.sql` to add the profile theme/notification columns and the owner-scoped `device_push_tokens` table. The migration is additive and safe to re-run; it does not drop or rewrite existing data.

## Themes and localization

Six color presets are available in Settings: Original, Ocean Blue, Emerald, Purple, Crimson and Midnight. They are implemented with CSS custom properties in `themes.css`; `data-theme` still controls light/dark so the existing toggle keeps working, while `data-theme-preset` selects the palette. The choice applies instantly, is saved on the device before first paint, and syncs to `profiles.theme` when the account is online.

The Arabic and English dictionaries are generated from the original `interfaceText` source into `locales/ar.json`, `locales/en.json` and `locales.js`. Run `npm run locales` after changing the dictionary and `npm run i18n:audit` to verify parity. Language switching updates the document direction, dates, numbers, navigation, dialogs, status messages and accessibility labels without a reload; user-entered content is never translated.

## Verification checklist

- `npm run check` — syntax, static wiring, Capacitor/platform wiring and localization parity.
- Website smoke test with `npm start` at `http://127.0.0.1:5500`.
- Android emulator/device: install the debug APK, sign in with the same account as the website, and confirm shared tasks/notes/goals/focus history.
- Airplane mode: create/edit a task, note, goal and focus session; confirm the pending badge, then reconnect and confirm replay.
- Theme: switch all six presets, toggle light/dark, force-stop and reopen the app; confirm persistence and account sync.
- Language: switch Arabic/English, confirm RTL/LTR and that no static label stays in the other language.
- Notifications: grant permission, create a task due in a few minutes and a focus session; confirm the native notification appears with the app closed.
- Back button: open a dialog, the mobile sidebar and a sub-page; confirm each back press closes the right layer.
