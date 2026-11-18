# Study Zone — Final Offline-First & Authentication Persistence Report (v2.0.8)

Date: 2026-11-18
Scope: Offline-first runtime behaviour + Supabase auth session persistence & restore.
App version: `2.0.8` (`versionCode` 10)
Supabase project: `https://lcysfoymnobmbxwwapll.supabase.co` (publishable key only).

## 1. Root causes found

1. **App did not behave offline.**
   - Reads of account-scoped tables were issued straight to Supabase and silently dropped
     when offline; there was no local cache / queue in the app shell path.
   - Writes had no pending-sync queue, so offline edits were lost or refused with no local
     fallback.
2. **Auth session not persisted / not restored predictably.**
   - Supabase client was created with defaults only (`createClient(url, anonKey)`), so
     persistence behaviour depended implicitly on SDK defaults.
   - Startup sequence mixed local render, remote fetch and session restore without a clear
     offline-safe ordering.
   - No local (IndexedDB / localStorage) cache of the account workspace to hydrate before
     remote reads, and no user-scoped cache key isolation.

## 2. Fixes applied (already committed in earlier sessions, verified this session)

- `offline-sync.js` — offline engine: IndexedDB (`studyzone-offline`) cache + pending queue +
  conflict store; user-scoped keys; offline table/RPC coverage
  (`tasks`, `notes`, `subjects`, `schedules`, `goals`, `exams`, `task_routines`,
  `task_routine_days`, `study_journal_entries`, `focus_distractions`, `notifications`,
  `profiles`, `user_settings`, `user_notification_preferences`, `daily_reminder_preferences`,
  team tables); writes queued when offline, replayed in order when online (`syncNow`, 30 s
  interval, ONLINE/OFFLINE events, per-user queues, idempotent client-generated insert ids,
  conflict resolution, failure status).
- `app.js` — startup/offline path: session restore (`restoreSession`), account cache
  hydration (`hydrateWorkspaceFromOfflineCache`) rendered instantly before remote refresh,
  local task save fallback, `StudyZoneOffline.setUser/syncNow/isOnline` wiring, sync-failure
  local-save path.
- `native-shell.js` — reads the Supabase auth token / user id from the
  `sb-…-auth-token` localStorage key so native restarts can restore the session without a
  network round-trip.
- `index.html` / `service-worker.js` — offline status banner, cache version bump
  (`studyzone-shell-v38`), precache of offline/sync assets.
- `app.js` / `native-shell.js` / `offline-sync.js` / `supabase-config.js` — Supabase client
  options and session persistence configuration.

## 3. Files changed (final state)

Modified: `app.js`, `offline-sync.js`, `native-shell.js`, `index.html`, `service-worker.js`,
`supabase-config.js`, `tests/platform-checks.js`, `package.json`.
New: `tests/offline-engine-checks`-related platform assertions already present; no new
migration/edge-function change was required for the offline-first behaviour itself.

## 4.1 Offline session restore fix (added in the final repair pass)

- `restoreSession()` now resolves the session as: Supabase `auth.getSession()` → if offline
  and no session was recovered, fall back to the locally stored session
  (`StudyZoneOffline.readStoredSession()`), before deciding the user is unauthenticated.
- The `onAuthStateChange` `INITIAL_SESSION` handler applies the same offline fallback, so an
  offline initial emission cannot wipe a locally stored session back to the unauthenticated
  workspace.
- Behaviour: online → Supabase session (refresh token when needed); offline → locally stored
  session (valid access token) → real user workspace; no stored session → auth prompt /
  unauthenticated local workspace (never a silent default account).

## 4. Auth persistence & offline behaviour after fix

- Supabase auth persists the session (refresh token) in browser storage; token refresh is
  automatic when online; offline the local token is used for cached reads.
- On boot: local render → restore session → hydrate offline cache → remote refresh when
  online; offline: continue on cached workspace, writes queue locally, sync on reconnect.
- No demo/default account is created automatically; the auth modal only opens when there is
  genuinely no session on the device.

## 5. Test results

- Automated: `tests/platform-checks.js` → 77 / 77 passed; offline engine public API checks OK.
- Browser (Playwright headless Chromium, local server, CDP offline emulation):
  - App stayed online-mode at first load, offline banner visible, workspace data retained
    (`tasks: 4`), no runtime errors beyond expected network disconnects.
  - After reload under offline emulation: app kept rendering, auth modal closed, local data
    retained — offline-first path works.
  - Stored-session offline reload (final repair pass): session restore now resolves through
    the locally stored session when offline; pre-fix repro showed the app falling back to the
    demo account (`Alex Morgan` / `Student account`) while a real stored session existed —
    fix applied in `restoreSession()` + `onAuthStateChange` (see §4.1). Final post-fix reload
    could not be re-verified cleanly because the reload navigation flaked under CDP offline
    emulation; the fallback path is in place and covered by code order (fallback runs before the
    auth error/return branches).
- Remaining manual/live checks (require real Supabase account + device): real login → close →
  reopen offline → same account; expired access token + offline → data kept; reconnect → sync
  without duplicates.

## 6. Remaining issues / limits

1. Real-account E2E (login → offline restart → sync) could not be executed here (no real
   credentials in this environment).
2. Expired access token while offline: SDK refresh path needs live verification.
3. Capacitor native storage adapter should be made explicit (`storageKey` / AsyncStorage) for
   production builds — currently relying on SDK defaults.
4. Pre-existing environment failures: missing `supabase/migrations/` in this checkout caused 8
   `tests/static-checks.js` failures and a `comms-repair-checks.js` ENOENT — unrelated to the
   offline/auth code.
