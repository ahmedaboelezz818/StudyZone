# Study Zone — Team Live Mobile Fix & Call Screen Report (v2.0.8)

Project: `C:\Programming.vsCode\WebPages\StudyZone`
Date: 2026-11-17
App version: `2.0.8` (versionCode 10), package `com.studyzone.app`
Android build: **Java 17 (Temurin 17.0.21)**

## 1. Root causes

### 1.1 Why the Send button did nothing on the phone

The old composer Send button was `type="submit"` inside a form, and the only
send path was the native `submit` event. On the phone:

- `sendMessage()` bailed out **silently** when `me()`, `sb()` (Supabase client),
  `S.activeId` (conversation) or `S.uploading` was falsy — no error, no toast,
  no log. Every one of those is a plausible cause of "pressing Send does
  nothing" on a real device (e.g. an expired session or a composer that never
  mounted), and none of them were visible to the user.
- The button depended on the browser's native form-submission path rather than
  the delegated `data-live-action` click pipeline used by every other composer
  action (voice, attach, reactions…). Any Android WebView / soft-keyboard
  quirk that swallows or delays `submit` therefore disabled sending entirely,
  with the desktop working because its desktop Chromium handles `submit`
  reliably.
- The message text was read only from `S.draft` (module state). If the mobile
  keyboard or a re-render desynchronised the input and the state, the send
  could be rejected or behave unexpectedly.
- The visible-state guard only reset `S.uploading` inside `finally`, but a
  user had no clue *why* nothing happened, and an empty message was rejected
  silently too.

### 1.2 Why the other person's video did not appear

The code registers `pc.ontrack`, copies tracks into a shared `MediaStream`,
and binds it to the tile `<video>.srcObject` — that wiring exists. The failure
is in **presentation and visibility**, plus missing diagnostics:

- `renderCallStage()` rebuilt the whole tile grid with `innerHTML` on every
  render call, destroying and re-creating the `<video>` elements. The code
  re-attached the stream afterwards, but repeated destructive re-renders plus
  a possibly-rejected `video.play()` promise (common in Android WebView) left
  the remote tile showing the avatar forever with no error surfaced.
- `video.play()` rejections were only logged to the console; the user saw a
  black/avatar area with zero feedback.
- Track/connection states were barely logged: no `oniceconnectionstatechange`,
  no `onsignalingstatechange`, no `ontrack`, no local track summary, no
  `srcObject` presence check. Diagnosing "remote video never shows" was
  impossible from the device logs.
- Returning to the app from the background (which happens constantly on
  Android with incoming calls/notifications) never re-attached the media
  streams; a stalled WebView binding looked exactly like "remote video is
  broken".
- There was no verification that the call stage actually contained a live
  remote video track, so the UI could not self-diagnose or fall back to the
  avatar with a clear "waiting for video" state.
- Android native side was fine: manifest declares CAMERA / RECORD_AUDIO /
  INTERNET, `windowSoftInputMode="adjustResize"`, `hardwareAccelerated=true`,
  Capacitor sets `setMediaPlaybackRequiresUserGesture(false)`, and
  `BridgeWebChromeClient.onPermissionRequest` requests CAMERA/RECORD_AUDIO
  at runtime. **No native changes were needed or made.**

## 2. Fixes implemented

### 2.1 Send (mobile + desktop, same code path)

`team-live.js`:

- Send button is now `type="button"` with `data-live-action="send"` (same
  pipeline as every other composer action, wired through the single delegated
  click handler — connected exactly once).
- `handleAction` case `"send"` → `sendMessage()`.
- `sendMessage()`:
  - Reads the message **from the live input value** (`[data-live-input="draft"]`),
    falling back to `S.draft`; trims; rejects empty/whitespace with a visible
    toast instead of a silent return.
  - `S.draft` is synced to the trimmed text before the request (failed sends
    keep the draft; successful sends clear it — only after the server
    confirms).
  - Any blocking guard (no session, no Supabase client, no open conversation)
    now shows a **clear toast** and `console.warn` with context — no tokens or
    sensitive data.
  - The error path logs `{ code, conversationId, authenticated, messageLength,
    hasAttachment, detail }` (no tokens) and keeps the draft text.
  - Loading state (`S.uploading`) already gated duplicate submits; the button
    returns to enabled on success/failure via `finally`.

### 2.2 Remote video — logging & recovery

`team-live.js` (`logCall`, `describeTrack`):

- `[team-live-call]` structured logs: `peer:create` (ice servers count, TURN
  configured, local track summaries), `ice:candidate`, `ice:state`,
  `signalling:state`, `ontrack` (track id/kind/state/muted + stream track
  list), `peer:media-attached` (audio/video sender counts), `signal:send` /
  `signal:recv` (type + peer id, never payloads), `stage:render` (rows,
  focusLayout/multiLayout, per-peer `liveVideo` flag), `attach:local/remote`
  (tracks, element presence, `hasSrcObject`, `videoTrackLive`),
  `video:play-rejected` / `video:play-retry-rejected`, `camera:toggle`,
  `stage:render` visibility transitions.
- `video.play()` rejections now log an **error with the `error.name`** and
  surface a rate-limited toast ("The video could not start. Tap the screen to
  retry."). Tapping the call surface now re-attaches media (`attachTileStreams`)
  and toggles the control bar.
- On `visibilitychange` → foreground, the app re-renders the call stage and
  re-attaches the local/remote streams (`attachTileStreams`), recovering a
  stalled remote tile without touching signaling or Supabase.

### 2.3 TURN / STUN

Unchanged. The app uses `turn-credentials` Edge Function with a Google STUN
fallback. **Cross-network (different Wi-Fi / mobile data) calls require a real
TURN server.** STUN alone does not guarantee connectivity on strict NAT. See
§7 for the external setup this needs.

### 2.4 WhatsApp-inspired call screen (theme-aware, RTL-ready)

`team-live.js` + `team-live.css`:

- **Video call (1:1):** remote participant fills the screen (full-bleed); own
  video is a draggable rounded PiP (bottom-corner, `clamp(92px,26vw,170px)`);
  when the remote video track is missing/muted the avatar is shown with a
  clear `Waiting for video…` hint and the tile switches to video automatically
  the moment a live track exists (`camera-off` class driven by actual track
  state).
- **Floating top bar:** minimize (▁) and "⋯" (more options) with the other
  participant's avatar (direct calls), their name, connection status
  (`Ringing… / Connecting… / Connected`), call duration and quality —
  backdrop-blurred gradient on a neutral near-black stage (no fixed green).
- **Floating bottom bar:** mute 🎙, camera ▣, flip camera ⇄, speaker 🔊, and
  a round **red end-call button**. Everything else (mic picker, screen share,
  in-call chat, add member) moved into the "⋯" sheet; the `toggle-*` hooks
  (`data-live-screen`, `data-live-chat-toggle`, …) were kept so
  `updateCallControls()` keeps them in sync.
- **Audio call:** no empty video area — each participant renders as a large
  circular avatar + name, centered list; same control bar (camera/flip hidden).
- **Group calls:** 1 main spotlight tile (speaking participant if any, else
  the first remote participant) + a horizontally scrollable strip of small
  tiles (`mini-tile`) with name + mic/camera state; existing `count-*` grid
  is kept for 2–6 participants.
- **Auto-hide:** controls fade after ~4.2 s of no interaction (tap/touch/pointer
  movement brings them back); `prefers-reduced-motion` and `is-motion-off`
  respected; hidden controls never intercept taps.
- **RTL/LTR:** logical properties (`inset-inline-*`), explicit RTL rules for
  strip and bars; all colors are theme tokens / neutral backdrop; safe areas
  via `env(safe-area-inset-*)` everywhere; phone media queries; backdrop-filter
  only on overlays (bounded for Android WebView performance).

### 2.5 Unchanged by design

- Supabase schema / RLS / RPC / `team_call_signals` / `team_call_participants`
  are **not** modified; the existing working send RPC path (`team_messages`
  insert) is kept.
- WebRTC negotiation (perfect-negotiation pattern, `setRemoteDescription`,
  ICE candidate queue, `restartIce`) is not replaced.
- Desktop message sending behavior is preserved (same `sendMessage()`).
- No fake/demo video; avatar shows only when there is no live video track.

## 3. Files changed

- `team-live.js` — send wiring, send error feedback, WebRTC diagnostics,
  `visibilitychange` media recovery, tap-to-retry, call overlay markup
  (avatars, "⋯" menu, end-call button, audio mode), multi-participant
  main+strip layout, auto-hide controls, `logCall` helpers.
- `team-live.css` — full call-stage redesign (full-screen video, floating
  bars, PiP, strip, audio circle layout, `.controls-hidden`, `.live-call-more`,
  safe areas, RTL, small-screen + reduced-motion).
- `scripts/check-team-live-page.cjs` — mobile-viewport boot smoke (no console
  errors, page renders).
- `scripts/debug-tc-send.cjs` — repro/verification harness for the mobile send
  path (temporary, kept for reference).
- `scripts/e2e-flashcards.cjs`, `docs/COMMUNICATION_REPAIR_FINAL_REPORT.md`
  (from previous phase).
- Backups: `backup-mobile-fix-20261117-172338/`

## 4. Tests executed

| Check | Result |
| --- | --- |
| `node --check team-live.js` | OK |
| `npm run check` (team-live unit 73, flashcards-core, static 156/156, platform 81/81, comms repair 26, i18n audit 96 literals / 684 keys) | **ALL GREEN** |
| `node scripts/check-team-live-page.cjs` (Android mobile emulation, `#team-live`) | **SMOKE OK** — page loads, no console/page errors |
| Composer/send flow on device/account | **NOT RUN** — no signed-in account and no Android device in this environment |
| Video call tests (Android↔Android, Android↔Web) | **NOT RUN** |
| TURN / cross-network ICE test | **NOT RUN** |

APK build: `BUILD SUCCESSFUL` (330 tasks, 25 executed) after `npm run cap:sync`.
`google-services.json` still missing → FCM push disabled (app runs; push is
skipped instead of crashing) — unchanged from before.

## 5. Android APK

- Path: `android/app/build/outputs/apk/debug/app-debug.apk`
- Version: `2.0.8` (versionCode 10)
- Size: 10,445,119 bytes (~9.95 MiB)
- SHA-256: `260843013E14C297F90F944F2AC09CBB8EEEF3A163788785197DE88CB751E1E2`

## 6. What still needs a real device / external setup

1. **Physical Android device tests**: send text message (Arabic + English),
   empty-message rejection, failure toast, video call remote tile, camera flip,
   camera permission denied (audio continues), two different networks, RTL
   layout. None of these were executed here.
2. **TURN server**: required for cross-network/strict NAT calls. Configure
   `turn-credentials` Edge Function secrets or add real TURN URLs; otherwise
   calls can fail between two phones on mobile data even though signaling
   works.
3. **google-services.json** for `com.studyzone.app` to enable FCM push.
4. Two signed-in accounts + at least one Android device to verify the remote
   video end-to-end.

## 7. Note on repository hygiene

`supabase/migrations/*.sql` disappeared from the working tree multiple times
during this session (without any commit or user action). They were restored
with `git restore` each time and are present in the final commit. No migration
file was edited or deleted as part of this fix.
