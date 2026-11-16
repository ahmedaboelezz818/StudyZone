# Study Zone Android build, calls and push

This document is the source of truth for the Android build that accompanies the
web app. It lists what was changed, what must be configured outside the
repository, and what has **not** been verified.

## Build facts

| Item | Value |
| --- | --- |
| Application id | `com.studyzone.app` |
| Version | `2.0.6` (`versionCode` 8) |
| Minimum Android | API 23 (Android 6.0 Marshmallow) |
| Target / compile SDK | API 35 |
| Java | 17 (`sourceCompatibility` / `targetCompatibility`) |
| Android Gradle Plugin | 8.7.2 |
| Gradle | 8.11.1 |
| Capacitor | 7.4.3 |
| Output | Universal debug APK |

The debug APK is universal: `android/app/build.gradle` keeps
`armeabi-v7a`, `arm64-v8a`, `x86` and `x86_64` in `abiFilters`. The app itself
is Java/Kotlin only, so the APK normally contains no native `.so` libraries and
therefore runs on every ABI Android supports. Third-party native libraries, if
added later, are packaged for all four ABIs.

## Flashcards feature (added 2026-11-16)

The Anki-style spaced repetition feature is implemented inside the existing web
app shell:

- `flashcards-core.js` — pure SM-2 scheduler (learning/relearning steps,
  graduated intervals, ease, ratings), queue building, statistics, forecast,
  delimited text and cloze tokenizing. Unit checked in `tests/flashcards-core.js`.
- `flashcards-db.js` — per-user IndexedDB persistence (decks, cards, notes,
  reviews, media, settings, outbox, meta).
- `flashcards-sync.js` — outbox push + server pull with last-write-wins merges.
- `flashcards.js` + `flashcards.css` — UI: dashboard, decks, browser, editor,
  review, statistics, import/export, settings, animations.

Database migration: `supabase/migrations/009_flashcards_system.sql` (additive,
RLS enabled for all flashcard tables, immutable `user_id`, unique
`(user_id, note_id, template)` for note-generated cards, XP ledger
`flashcard_xp_awards`).

Offline-first behaviour: decks/cards/reviews are stored locally; every answer is
written immediately into the local outbox and pushed when online.

Not verified yet: real device behaviour of the new feature, migration execution
on a live database, and FCM delivery.

### Building with Java 17

The machine may have an invalid `JAVA_HOME`. Point it at a real JDK 17 for the
build:

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.21.9-hotspot"
cd android
.\gradlew.bat assembleDebug --console=plain
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

Last verified build (2026-11-16):

| Item | Value |
| --- | --- |
| Size | 7,283,895 bytes (~6.9 MiB) |
| SHA-256 | `B55595518979194067308860A00A6DDD059EF6D0B05082556D84A520151C5FBA` |
| Package / version | `com.studyzone.app` / `2.0.5` (code 7) |
| minSdk / targetSdk | 23 / 35 |
| Native libraries | none (`lib/` is empty; app is Java + WebView only) |
| Bundled web assets | 68 files under `assets/public`, including the updated `team-live.js`, `app.js`, `native-shell.js` |

The bundled `team-live.js` was checked byte-for-byte against the repository copy,
so the APK is not stale. Rebuild with `npm run cap:sync` first; `cap sync`
regenerates `www/` from the repository root.

`service-worker.js` uses a versioned cache (`studyzone-shell-v29`). When app
assets change, bump that string and update the matching assertion in
`tests/static-checks.js`, otherwise installed PWAs keep serving the old shell
while offline.

Repository checks (also run in CI if configured):

```powershell
npm run check
npm run cap:sync
```

## Database migration

Apply `supabase/migrations/008_team_live_reactions_and_rpc_compat.sql` after
`006_team_live_communication.sql` and `007_device_push_tokens_for_calls.sql`.
It is additive and safe to run more than once.

It does four things:

1. Creates `team_message_reactions` with a unique index on
   `(message_id, user_id)`, RLS policies and realtime publication. Existing
   duplicate reactions are reduced to the newest row so the unique index can be
   created without losing the latest valid choice.
2. Adds the message columns the client already uses (`team_id`,
   `attachment_path`, `edited_at`, `deleted_by`) and fills missing values from
   the conversation. `body` is made nullable because attachment-only messages
   have no text.
3. Adds triggers that set `sender_id`, `team_id` and timestamps on insert and
   block changing a message's sender or conversation on update.
4. Adds the RPC overloads the client calls:
   `team_live_join_call(call)`, `team_live_leave_call(call)`,
   `team_live_respond_call(call, accept)`, `team_live_pending_invites()`,
   `team_chat_mark_read(conversation, at, message)`, plus the new
   `team_live_open_task_chat(team, task)` entry point. The task-chat RPC gets a
   fresh name because PostgreSQL forbids renaming input parameters through
   `CREATE OR REPLACE`, and different deployments used different names.
   The signed-in user always comes from `auth.uid()`.

The join RPC also fixes a real bug in migration 006: its "already in a call"
check matched the invite row of the call being joined, so joining always failed.
The new overload ignores the current call and only counts *accepted* calls.

`supabase/migrations/001`, `002`, `004` and `005` are not present in this
checkout. The web app treats those features as optional, but a brand-new
database needs those migrations (or the equivalent production schema) before
teams/tasks work.

## Firebase Cloud Messaging (incoming calls)

Push is **not active** in this checkout. The native code and the Edge Function
are complete, but these external pieces are required:

1. **Firebase project + Android app**

   - Create a Firebase project.
   - Register Android app `com.studyzone.app`.
   - Download `google-services.json` into `android/app/google-services.json`.
   - `android/app/build.gradle` applies the Google Services plugin only when
     that file exists.

   Without this file the APK builds and runs, but `FirebaseMessaging` cannot get
   a token and no push can arrive.

2. **Supabase Edge Function secrets**

   ```powershell
   supabase secrets set FCM_PROJECT_ID="your-firebase-project-id"
   supabase secrets set FCM_SERVICE_ACCOUNT_JSON="$(Get-Content service-account.json -Raw)"
   ```

   `FCM_SERVICE_ACCOUNT_JSON` is the Firebase service-account JSON (client
   email + private key). Never put it in the app or in git.

3. **Deploy the functions**

   ```powershell
   supabase functions deploy team-live-call-push
   supabase functions deploy team-live-message-push
   ```

   The client calls `team-live-call-push` after starting a call, on decline,
   on timeout, and when a call ends. Terminal states (`ended`, `declined`,
   `missed`) are sent so other devices remove their ringing notification.

4. **Device permission and battery settings**

   - Android 13+: allow notifications (`POST_NOTIFICATIONS`).
   - Some OEMs (Xiaomi, Huawei, Samsung, Oppo, Vivo) need "Autostart" and
     "Unrestricted battery" enabled for timely delivery.
   - Doze and background restrictions can delay data pushes.

### What push can and cannot do

- FCM can wake a backgrounded or recently killed app and start the incoming-call
  notification/Activity.
- FCM **cannot** wake an app the user has force-stopped from Android settings.
  Android blocks all components until the user opens the app again. No client
  code or server code can bypass this.
- A full-screen incoming-call Activity also depends on
  `USE_FULL_SCREEN_INTENT` policy on Android 14+. If the system rejects the
  full-screen intent, the notification is still posted and the user can tap it.

## Calls

- Audio/video is WebRTC peer-to-peer. Supabase carries messages, presence and
  signaling; TURN relays media when a direct route fails.
- Calls are **not end-to-end encrypted in the messaging sense**. WebRTC uses
  DTLS-SRTP for media in transit, and TURN relays those encrypted packets, but
  this app does not implement an additional E2E layer and does not claim one.
- Microphone acquisition is now audio-first. A video call requests the
  microphone first, then tries the camera. If the camera is unavailable or
  denied, the call continues as audio-only instead of failing with
  "No microphone is available."
- Android permissions are requested through `StudyZonePermissions` before
  `getUserMedia`, which removes the WebView/native permission race.
- The foreground service uses `microphone` and, only when the camera is really
  granted, `camera` types. It falls back to microphone-only if an OEM rejects
  the camera type.

## Reactions

- One emoji per user per message. Choosing a different emoji replaces the old
  one; choosing the same emoji again removes it.
- The UI updates optimistically, then confirms with the server. A failed write
  restores the previous state.
- The database enforces the rule with a unique index, so two devices or a
  double tap cannot create two rows for the same user.
- Realtime DELETE needs `REPLICA IDENTITY FULL`, which migration 008 sets.

## Not verified

- No physical Android device and no emulator were available in this
  environment (`adb devices` was empty and no AVDs existed). No real-device
  call, camera, microphone, notification or FCM delivery test was executed.
- No Firebase project, `google-services.json` or FCM service account was
  available, so push delivery was not tested.
- The Supabase project was not reachable with database credentials from this
  environment. Migration 008 was written and statically checked but not applied
  to the live database here.
- The APK was built locally; installation and runtime behavior on a device
  remain to be validated.
