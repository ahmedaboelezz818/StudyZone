# Second Brain — Final technical report (2026-11-16)

## 1. Deliverables

### Android

- Source version: `2.0.6` (`versionCode` 8), minSdk 23, compile/targetSdk 35, Java 17,
  AGP 8.7.2, Gradle 8.11.1, Capacitor 7.4.3.
- Universal debug APK path: `android/app/build/outputs/apk/debug/app-debug.apk`.
- Last **successful** debug build before the flashcard bundle: size 7,283,895 bytes,
  SHA-256 `B55595518979194067308860A00A6DDD059EF6D0B05082556D84A520151C5FBA`,
  written 2026-11-16 09:48:05, versionName `2.0.5`, versionCode `7`.
- After the flashcard feature the version was bumped to `2.0.6` / code 8 in
  `android/app/build.gradle`, `www/` was regenerated with the new modules and a final
  `assembleDebug` was attempted. It failed in `:app:packageDebug` with
  `java.io.IOException: Unable to delete directory 'C:\...\android\app\build\outputs\apk\debug'`.
  The stale `app-debug.apk` could not be removed (EBUSY/permission denied) so Gradle
  refused to overwrite it.

## 2. Checks

- `npm run check`: PASS (team-live 73/73, flashcards-core unit, static 156/156,
  platform 79/79, localization audit).
- `npm run cap:sync`: PASS.

## 3. Flashcard feature (implemented in this session)

- `flashcards-core.js` — pure spaced repetition (SM-2 family: learning steps, relearning
  steps, graduating/easy intervals, ease, ratings Again/Hard/Good/Easy, button interval
  estimates, queues, statistics, forecast, delimited text, cloze).
- `flashcards-db.js` — per-user IndexedDB persistence (decks, cards, notes, reviews,
  media, settings, outbox, meta).
- `flashcards-sync.js` — outbox push + server pull with last-write-wins merge.
- `flashcards.js` / `flashcards.css` — UI (dashboard, decks, browse, editor, review,
  stats, import/export, settings, motion levels) + premium redesign pass (theme tokens,
  3D flip review card, rating buttons with expected intervals, charts, motion levels).
- `supabase/migrations/009_flashcards_system.sql` — additive flashcards schema (decks,
  notes, cards, review logs, media, settings, XP ledger), RLS, immutable user_id, unique
  note/templated card constraint, XP award function.

## 4. Voice message recording fix (team chat, implemented in this session)

Root cause: the voice recording UI is only mounted when `S.voice.state !== "idle"`, but the
state transitions (`startVoiceRecording`, `pauseVoiceRecording`, recorder `onstop`,
`resetVoiceRecording`) only called `updateVoiceComposerUi()`, which queries
`[data-live-voice-wrap]` — an element that only exists after the composer HTML is re-rendered.
Because the composer was last rendered while the state was `idle`, every update was a no-op and
the recording screen never appeared, even though `getUserMedia` + `MediaRecorder` were running.

Fix:
- `resetVoiceRecording()` now calls `refreshComposer()`.
- `startVoiceRecording()` refreshes the composer when the state becomes `recording` and on error.
- `pauseVoiceRecording()` refreshes the composer.
- recorder `onstop` refreshes the composer after switching to the `ready` (preview) state.
- `sendVoiceMessage()` validates the captured blob (non-empty, minimum length) before upload.

Result: pressing the mic button re-renders the in-chat recording UI (red indicator, pulse,
real AudioContext waveform meter, timer from 00:00, stop/pause/resume/cancel/preview/send).

## 5. Honest limitations of this session

- The final APK could not be rebuilt into the new version after the flashcard bundle
  because of a filesystem-level delete lock on the previous APK; the delivered APK file is
  therefore the pre-flashcard build (v2.0.5).
- No Android device / emulator was available; no real-device test executed.
- No Firebase project / `google-services.json` / FCM service account; push not delivered.
- Live Supabase migration not applied; migration 009 written and statically checked.
- Calls use WebRTC (DTLS-SRTP + TURN) — not an additional end-to-end encryption layer.
- FCM cannot wake a force-stopped app.
- Flashcard gaps in this pass: native reminder scheduling wiring, media upload, full study
  modes polish, `.apkg` support (by design unsupported).
