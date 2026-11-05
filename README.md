# Study Zone

Study Zone is a responsive, plain HTML/CSS/JavaScript student workspace using the Brunswick Green, Emerald Green, and Polar identity. There is no frontend build step.

## Run locally

Run the included dependency-free static server (rather than opening `index.html` directly):

```text
node server.js
```

Then open `http://127.0.0.1:5500`.

## Connect Supabase

1. Apply the SQL migrations in `supabase/migrations/` in order in the Supabase SQL Editor (or with `supabase db push`). `001_studyzone_enhancements.sql` is idempotent and non-destructive; it adds the note color column, recurring-task indexes, private teams, voice-note metadata, and notification preferences. The original `supabase/schema.sql` referenced by earlier versions of this README is not present in this repository, so apply the migrations on top of an existing Study Zone project rather than assuming a fresh schema file can be run.
2. Add the project URL and **public anon/publishable key** to `supabase-config.js`.
3. Keep the `service_role` key out of this project and all browser code.
4. For daily Web Push, generate a VAPID key pair (for example, `npx web-push generate-vapid-keys`) and configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a `mailto:` contact), and `DEADLINE_CRON_SECRET` as server-side Edge Function secrets. Put only the matching public key in `supabase-config.js` as `vapidPublicKey`; never add the private key or service-role key to browser files. A current public key is already stored in `supabase-config.js` (`vapidPublicKey`); the matching private key, subject, and cron secret must still be set on the deployed `deadline-reminders` Edge Function before task notifications can be delivered.
5. Deploy `supabase/functions/deadline-reminders`, then schedule a trusted job to POST to `/functions/v1/deadline-reminders` at least every 15 minutes with the `x-deadline-cron-secret` header. It creates deadline/daily notifications idempotently and delivers pending Web Push notifications.
6. Serve the app over HTTPS (localhost is supported for development), sign in, and enable push reminders in Settings. The browser asks for notification permission only after the user enables them. The daily check-in uses the device timezone and selected time; disabling push reminders stops further sends. Push delivery while the app is closed depends on browser/OS support, permission, and the scheduled Edge Function.

The schema creates the user-owned tables and RLS policies, a private `studyflow-files` Storage bucket, private administrator allowlist, focus-session RPCs, and server-side reward functions. Deadlines and tasks support account-backed create/read/update/delete after sign-in. Subjects, schedules, files, notes, goals, exams/results, and profile editing also use the account tables; study files and profile photos use private Storage and signed URLs. XP and level achievements are awarded by trusted database functions; milestone rewards are granted once when the account reaches levels 5, 10, 20, and 50. Guest task data remains local to the browser. Web Push and scheduled reminders remain inactive until the schema is applied, the Edge Function is deployed with its secrets, and the cron job is configured.

Tasks and deadlines can repeat daily, weekly, monthly, or on selected weekdays. Choose a repeat-until date within one year; each occurrence is saved as an independent task so completion and XP are tracked separately. Deadlines also have a start date; the calendar draws a bar across each date from its start through its due date. Editing or deleting a repeated occurrence now asks for a scope: this occurrence only, this and all future occurrences, or the whole series, with an affected-count preview. Editing series details (title, subject, priority, and so on) keeps each occurrence's own date; changing the date shifts every selected occurrence by the same amount. Past occurrences are never regenerated after they are deleted. "Stop repeating" keeps the existing copies and removes their series metadata. Until `001_studyzone_enhancements.sql` is applied, the app detects the missing recurrence columns, keeps normal task loading and non-repeating task creation working, and asks you to apply the migration before creating a repeating task.

## Daily task workspace

The Tasks page opens on today and only shows what belongs to the selected day. Overdue, no-date, and completed work sit in separate collapsible sections, so a task never appears in two sections at once. The page includes previous/next day navigation, a seven-day strip with per-day open counts, a completion ring, per-day search and status filters, an "All tasks" view, an edit dialog, and a move dialog. Dates are built from local calendar parts (`getFullYear`, `getMonth`, `getDate`) so a task does not shift to the previous or next day because of UTC conversion.

## Rich notes and voice notes

Notes use the existing `notes.content` column for sanitized HTML: headings, paragraphs, bold/italic/underline/strikethrough, font size, text and highlight colors, lists, checklists, alignment, links, images, dividers, undo/redo, Ctrl+B/I/U, and RTL/LTR. Autosave reports unsaved, saving, saved, and failed states. Pinning uses the existing `is_favorite` column. The optional per-note color uses `notes.color`, which is enabled by the migration; until then the UI hides the color swatches and explains why.

Voice notes are recorded with `MediaRecorder`, including permission-denial handling, pause/resume, preview, and a 10-minute cap. Authenticated recordings upload to the private `voice-notes` Storage bucket under `<user-id>/…` and metadata is stored in `voice_notes`; playback uses short-lived signed URLs, and rename/delete are supported. Guest recordings are previewed for the current browser session only and are clearly labelled as such.

## Teams

The Teams page supports creating a private team, joining with a short code, listing members, and adding, completing, or deleting shared team tasks. RLS policies restrict every team row to its owner or members; the `join_team` RPC is the only way to join by code, and the client never receives the service-role key. The migration must be applied before the Teams page can load; otherwise the page shows an actionable setup message instead of failing silently.

## Static checks

This repository has no build step or browser test runner. Run the dependency-free static checks and syntax checks with:

```text
node --check app.js
node --check service-worker.js
node --check server.js
node tests/static-checks.js
```

The checks cover required page functions, modal/ID wiring, safe date helpers, absence of a service-role key in browser files, the new migration contents/RLS, and cache versioning. They do not replace authenticated multi-user testing against a real Supabase project.

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
- The browser loads Supabase JS v2 from jsDelivr. A network connection is needed for Supabase auth/database/storage features.
- The Admin page shows no fabricated user-wide metrics. Admin authorization is backed by the `site_admins` allowlist; no cross-user admin data endpoint is implemented.
- Voice transcription is optional and not implemented in this round; `voice_notes.transcription_status` is ready for a future Edge Function.
- Notification sounds and do-not-disturb hours are available in Settings, persist locally, and sync to `user_notification_preferences` when the migration has been applied. Task reminder sounds, Pomodoro sounds, preview, volume, duration, and repeat controls are available in Settings. The notification list is refreshed while the app is open; it is not a realtime subscription.
- The `team_task_comments` table is created by the migration, but the team comment UI is not wired yet.
- Recurring-series changes use separate owner-scoped updates. A network failure partway through a series update can leave some occurrences updated; there is no transactional series RPC yet.
- No automated browser test suite exists in the repository. Verification for this round was limited to static checks (`node --check`), ID/wiring audits, and a local server smoke test; authenticated RLS behavior still needs testing in a real Supabase project.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      