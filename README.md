# StudyFlow

StudyFlow is a responsive, plain HTML/CSS/JavaScript student workspace using the Brunswick Green, Emerald Green, and Polar identity. There is no frontend build step.

## Run locally

Run the included dependency-free static server (rather than opening `index.html` directly):

```text
node server.js
```

Then open `http://127.0.0.1:5500`.

## Connect Supabase

1. For a new project, run `supabase/schema.sql` once in the SQL Editor, then apply `supabase/migrations/20261102223000_add_secure_study_rewards.sql`. For an existing StudyFlow project, run all files under `supabase/migrations/` in filename order.
2. Add the project URL and **public anon/publishable key** to `supabase-config.js`.
3. Keep the `service_role` key out of this project and all browser code.
4. Deploy `supabase/functions/deadline-reminders` and set `DEADLINE_CRON_SECRET` as a server-side Edge Function secret.
5. Schedule a trusted job to POST to `/functions/v1/deadline-reminders` with the `x-deadline-cron-secret` header. The function is idempotent and uses the service key only in its server-side environment.
6. Serve the app over HTTP and use the sign-in/create-account dialog.

The schema creates the private user-owned tables, RLS policies, a private `studyflow-files` Storage bucket, and a service-role-only XP function. Deadlines reuse `public.tasks`; they support database create/read/update/delete after sign-in and local browser persistence for guests. The `reminder_before_minutes` and notification idempotency columns are added by the deadline migration. Reminder delivery is not active until the Edge Function is deployed and scheduled. Other feature pages currently use preview content; their management endpoints are not implemented yet.

## Admin authorization

Apply `supabase/migrations/20261103003000_secure_admin_authorization.sql` in the Supabase SQL Editor. It creates a private `site_admins` allowlist with RLS enabled and no client read/write grants. The `is_current_user_admin()` RPC only returns whether the caller's authenticated user ID is on that list; it does not expose the allowlist. The browser hides the Admin link until this RPC succeeds and redirects denied or unverifiable sessions away from the Admin page.

To register the first administrator, sign up and confirm your account, then find its UUID in Supabase **Authentication → Users** (or query `select id, email from auth.users where lower(email) = lower('you@example.com');` in the SQL Editor). Replace the zero UUID in `supabase/setup/register_first_admin.sql` with that exact UUID and run the script in the SQL Editor. This is an explicit trusted database operation; never grant admin by changing browser state or user metadata. To revoke access, delete that user's row from `public.site_admins` in the SQL Editor.

The current Admin page contains informational placeholders only; this project has no user-management, system-settings, or other privileged admin endpoints yet. Do not add privileged data or actions until each backend query/RPC/Edge Function independently checks the caller against `site_admins` and applies appropriate RLS. The client-side gate is for navigation and UX, not the security boundary.

The language selector in Settings switches the shared navigation, all app pages, forms, dialogs, status messages, and accessibility labels between English and Arabic without reloading. Arabic sets the document to RTL and uses Arabic-localized dates and numbers; English restores LTR. Guest preferences are stored locally, and signed-in preferences sync to the profile after running the language migration. The existing plain-JavaScript app uses its dictionaries in `app.js` rather than an i18n package. User-entered names and content remain unchanged when switching languages.

The Focus page uses an animated CSS flip clock and timestamp-based countdown. Guest timer state, settings, and completed sessions stay in browser storage; authenticated timer preferences and history use the owner-scoped `user_settings` and `study_sessions` tables. Apply `supabase/migrations/20261102222000_add_focus_sessions.sql` and the later secure-rewards migration before using authenticated focus history. Authenticated users can read their own session rows; start, pause, resume, finish, and cancel use owner-scoped database RPCs, while direct session writes are revoked. History has a per-user idempotency key and an owner-matched optional task link. Browser notifications require explicit permission and are best-effort while the app is open; an installed PWA cannot guarantee alerts while closed.

## Rewards and motion

The secure-rewards migration reuses `user_xp`, `xp_transactions`, `achievements`, and `user_achievements`. Server-side rules award 10 XP once per completed task, 15 XP per completed focus session, and the configured achievement awards (25/50/100 XP). Database uniqueness constraints and triggers prevent repeat rewards; task rewards, verified focus rewards, streak updates, and achievement unlocks are never calculated or written by the browser. Focus time for signed-in accounts is tracked through authenticated database RPCs, including accumulated run time across pauses. Streak days use each profile's IANA timezone, falling back to UTC.

Guests can use the timer and see local completion feedback, but do not earn account XP or synced achievements. The app supports reduced motion through the operating-system preference and the Appearance setting. CSS/Web Animations are used because this project is plain HTML/CSS/JavaScript, not React; no Motion for React dependency or build pipeline was introduced. Goals, file uploads, notes, subjects, and exams remain preview/placeholder screens, so they do not issue rewards or claim completions.

## Install Study Zone

The app includes a Web App Manifest in `public/manifest.webmanifest`, branded PNG icons in `public/icons/`, and a service worker for the static app shell. The included `server.js` serves the manifest and icon assets at the root URLs referenced by the app. No build step or additional PWA plugin is required. Serve the app over HTTPS for installation (localhost is allowed for development).

- **Android:** In a supported browser, use the in-app Install app button and accept the browser prompt, or use the browser menu's Install app / Add to Home screen option when available.
- **iPhone/iPad:** Open the site in Safari, tap Share, then Add to Home Screen.
- **Windows/macOS:** Use the Install app prompt when supported. In Safari on macOS, use File > Add to Dock when available. Other browser menus and installation support vary.

The service worker caches only the versioned static app-shell files and branded icons. It does not cache requests to application data endpoints or other dynamic same-origin URLs. When an update is ready, use the in-app update notice to activate it and reload. Offline access is limited to the cached shell; Supabase and other network-backed features still require a connection.

## Notes

- In preview mode, task edits are stored in this browser's local storage.
- The browser loads Supabase JS v2 from jsDelivr. A network connection is needed for Supabase auth/database features.
- The Admin page shows no fabricated user-wide metrics. Admin authorization is backed by the `site_admins` allowlist; no cross-user admin data endpoint is implemented.
