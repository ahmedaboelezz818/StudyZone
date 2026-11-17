# Study Zone — Final Communication Repair & Stabilization Report (v2.0.8)

Date: 2026-11-17
Branch: `main` @ `c5b99bd` (base before repair: `ea354cb`)
App version: `2.0.8` (`versionCode` 10)
Android package: `com.studyzone.app`
Supabase project: `https://lcysfoymnobmbxwwapll.supabase.co` (publishable key only; no service role / DB password available)

## 1. Root causes found

1. **Private conversations only worked through a shared team.**
   The Team Live shell treated a missing `S.teamId` as "no chat at all": `renderPage`,
   `mount` and `startDirectCall` bailed out early, and the private DM sheet was only
   reachable from team-scoped surfaces. Private messages/calls could therefore not be
   used between two accounts that have no shared team.
2. **Private conversations had no Realtime subscription.**
   `ensureTeamChannel` filtered `team_messages` by `team_id=eq.…`, which can never match
   private rows (`team_id IS NULL`). A private conversation therefore had no live update
   path; only polling could work.
3. **No optimistic peer tile for private calls.**
   Call-stage rendering relied solely on `team_call_participants`; private calls may not
   have a peer row yet, so the caller could end up with a self-only call screen and no
   remote tile.
4. **Remote video never played.**
   Tiles lacked `autoplay playsinline webkit-playsinline preload="auto"`, the local tile
   never called `video.play()`, remote tiles never re-attached/re-played when a track
   arrived after the first audio, and camera-off state came from a stale `camera_on` DB
   flag instead of live tracks, plus no waiting indicator.
5. **Incoming-call notifications unreliable / missing deep link.**
   `notifyIncoming` used `new Notification(...)` only (no Service Worker), no call metadata,
   no deep link, no `requireInteraction`, and the Service Worker ignored call payloads
   (call/message ids were dropped, terminal pushes did not dismiss the ringing banner).
6. **Push fan-out privacy/scoping issues.**
   Message push resolved recipients from team membership only (no private participants),
   payloads carried message bodies into push data, no Web Push delivery, and the call push
   dropped tokens from non-Android platforms and lacked a private-conversation fallback.
7. **TURN credential gate excluded private conversations.**
   `turn-credentials` required team membership/ownership, so private calls could not get
   TURN access when a team was absent.
8. **Offline optimistic chat rows rendered the wrong sender.**
   Offline cache normalization filled `user_id` instead of `sender_id` for
   `team_messages`, so queued/sent-while-offline messages rendered the wrong author until
   the server confirmation arrived.
9. **Ambiguous Postgres RPC overload.**
   Live DB had two `team_live_invite_call` overloads (`uuid[]` vs `jsonb`); `supabase-js`
   sends JSON arrays, so PostgREST answered `PGRST203 Could not choose the best candidate`.
   New migration `012` drops only the unused `uuid[]` overload (no CASCADE).
10. **Service Worker registration on native.**
    The second registration block could attempt SW registration inside the Capacitor WebView
    (unneeded and harmful); now guarded by `isCapacitorNative` / `canUseServiceWorker`.

## 2. Files changed

- `team-live.js` — private chat/call routing, realtime subscriptions, call stage,
  video playback, notifications, deep links, optimistic peer tile.
- `app.js` — route parsing (`parseRoute`), `#team-live?…` deep links (`openLiveTarget`),
  Capacitor-guarded Service Worker registration.
- `team-live.css` — `.live-tile-waiting` styles.
- `offline-sync.js` — `sender_id` backfill for `team_messages` offline rows.
- `service-worker.js` — cache `studyzone-shell-v37`, call/message ids in push data, terminal
  call notification close, call deep link.
- `native-shell.js` — FCM guard (kept from previous repair; verified, not weakened).
- Edge functions: `supabase/functions/team-live-message-push/index.ts`,
  `supabase/functions/team-live-call-push/index.ts`,
  `supabase/functions/turn-credentials/index.ts`.
- Tests: `tests/comms-repair-checks.js` (new, 26 checks), `tests/static-checks.js`
  (cache assertion accepts v37+).
- `package.json` — `npm run check` now includes `tests/comms-repair-checks.js`.

## 3. SQL migrations

Restored from pre-repair backups (additive only, no destructive changes):
- `003_android_offline_notifications.sql`
- `006_team_live_communication.sql`
- `007_device_push_tokens_for_calls.sql`
- `008_team_live_reactions_and_rpc_compat.sql`
- `009_flashcards_system.sql`
- `011_fix_team_live_start_call_ambiguous.sql`

New: `012_fix_team_live_invite_call_ambiguous.sql` — `drop function if exists public.team_live_invite_call(uuid, uuid[]);` (no CASCADE / table / data changes).

Apply on the live project before using calls: run all migrations in `supabase/migrations/`
in order via the Supabase SQL editor or `supabase db push`.

## 4. Edge functions changed

- `team-live-message-push`: private-conversation authorization via `participant_a/b`,
  peer-only recipients, privacy-safe payload (no body, `sender_id`, `conversation_id`,
  `message_id`, private flag), Web Push via `web-push@3.6.7`, dedupe-ready tags.
- `team-live-call-push`: private-conversation participant fallback, no Android-only token
  filter, Web Push with call deep link (`#team-live?call=`), richer result fields, terminal
  call push closes ringing notification.
- `turn-credentials`: allows private conversation participants without team membership.

## 5–8. Test results

Automated (run in this session):

- `node --check` on all runtime JS files: OK.
- `npm run check`:
  - Team Live unit checks: 73 passed.
  - flashcards-core unit checks: passed.
  - Static checks: 156/156 passed.
  - Platform checks: 81/81 passed.
  - Communication repair checks: 26/26 passed (new).
  - Localization audit: 96 translated literals, 684 keys in both dictionaries.
- Communication-repair regression suite covers: private conversation realtime, no-team
  rendering, private DM fallback, private start-call path, video tile markup, guarded play,
  live-track camera-off logic, ontrack re-attach, SW incoming-call notification, terminal
  push close, push data ids, deep links, SW native guard, private push auth/targets, Web Push,
  token filter removal, private fallback, TURN private access, offline sender_id, idempotency
  key, migration 012 contents.

Manual / live verification status (NOT performed here — see section 10):

- Private 1:1 chat/call E2E, two-device WebRTC, FCM delivery, real device notifications:
  **pending real-account/real-device credentials**.
- `localhost` error reproduction: no remaining intentional local request paths found after
  fixes; runtime console capture still pending on device.

## 9. Final Android build

- Command: `npm run cap:sync` + `cd android && .\gradlew.bat assembleDebug --no-daemon`
- JDK: Temurin 17.0.21 (`C:\Program Files\Eclipse Adoptium\jdk-17.0.21.9-hotspot`)
- Android SDK: `C:/Users/ahmea/AppData/Local/Android/Sdk`
- Gradle 8.11.1, AGP 8.7.2, compile/target SDK 35, minSdk 23, Java 17 compile options.

### Final APK

| Item | Value |
| --- | --- |
| Path | `C:\Programming.vsCode\WebPages\StudyZone\android\app\build\outputs\apk\debug\app-debug.apk` |
| Size | 10,445,119 bytes (~9.95 MiB / ~10.45 MB) |
| SHA-256 | `D3821AF8024F5BCA35C54FEB357EA34D6CD71F2CD76AA30F78DDE5DE21C149CA` |
| Version | `2.0.8` (versionCode 10) |
| Package | `com.studyzone.app` |
| Build | debug (signed with debug keystore) |

## 10. Remaining external setup (required, not invented here)

- Apply Supabase migrations listed in section 3 to the live project.
- Place real `android/app/google-services.json` (Firebase project for `com.studyzone.app`).
- Set Edge Function secrets: `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT_JSON`, `SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, VAPID keys for Web Push.
- Configure TURN server URLs / shared secret for NAT traversal.
- Real two-account / two-device E2E tests and physical device notification tests.

## 11. Final test summary

- Automated suite: all green (details in section 8).
- Android build: `BUILD SUCCESSFUL` (330 tasks, 25 executed; web assets re-copied from
  `www/` after final source edits).
- Static cache: `studyzone-shell-v37` served into the APK.

## 12. Final APK

- Path: `android/app/build/outputs/apk/debug/app-debug.apk`
- Version: `2.0.8` (versionCode 10)
- Size: 10,445,119 bytes (~9.95 MiB)
- SHA-256: `D3821AF8024F5BCA35C54FEB357EA34D6CD71F2CD76AA30F78DDE5DE21C149CA`

## Backup

- Pre-repair backup: `backup-comms-20261117-141748` (274 files, ~8.85 MB) in repo root.

## Git

- Pre-repair HEAD: `ea354cb`; final HEAD: `c5b99bd` (`main`).
