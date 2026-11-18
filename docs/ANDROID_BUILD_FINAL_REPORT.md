# Study Zone — Android Update Build Report (2026-11-18)

Package: `com.studyzone.app` · Target: Android Debug APK · Java: **JDK 17 (Temurin 17.0.21+9)**

## 1. What was applied in this update

- **Calendar** (`app.js` + new `sz-calendar.css` + `timeline-core.js`): redesigned grid,
  capped events with elegant `+N more`, full-day sheet, theme-aware pills, month/week/day/agenda
  views, full CRUD, Arabic/English + all 15 theme presets.
- **Deadlines**: mandatory display rule — items appear **only when they span ≥ 2 real calendar
  days** (start→due), never due-date-only; bar width proportional to the actual day span;
  filters (search/status/sort) and stats scoped to the same multi-day set; display-only (tasks
  are not deleted, hidden only from the Deadlines screen, still visible in Tasks/Calendar).
- **Offline / auth**: session-restore hardening — `restoreSession()` now falls back to the
  locally stored session when offline (`StudyZoneOffline.readStoredSession()`), and the
  `onAuthStateChange` `INITIAL_SESSION` handler applies the same fallback; `offline-sync.js`
  exposes the stored-session accessor.
- **Flashcards**: premium theme-aware redesign layer appended to `flashcards.css` (ambient glow,
  stacked-deck silhouettes behind the card, premium glass card, strengthened 3D flip,
  enhanced progress fill, reduced-motion handling). Deck/XP/Spaced-Repetition logic untouched.

## 2. Files modified (working tree, uncommitted)

`app.js`, `index.html`, `offline-sync.js`, `flashcards.css`, `package.json`, `scripts/build-web.js`,
`service-worker.js` (`studyzone-shell-v39`), `timeline-core.js` (new), `tests/timeline-core.js` (new,
**93/93**), `sz-calendar.css` (new), `docs/*` (final reports), `android/app/build.gradle`.

## 3. Build details

- Web assets rebuilt (`npm run build:web` → `www/`) and synced to
  `android/app/src/main/assets/public` via `cap sync android`.
- `android/app/build.gradle`: `versionCode 10 → 11`, `versionName 2.0.8 → 2.0.9`
  (applicationId unchanged: `com.studyzone.app`, namespace unchanged).
- Toolchain: Gradle (current), AGP (current), compileSdk/targetSdk **35**, minSdk 23,
  `source/targetCompatibility = JavaVersion.VERSION_17`; build run with JDK 17 only.
- Command: `.\gradlew.bat assembleDebug` → **BUILD SUCCESSFUL in 4m35s** (299 UP-TO-DATE, 31
  executed).

## 4. Verified artifact

- Path: `android/app/build/outputs/apk/debug/app-debug.apk`
- Size: **10,179,686 bytes**
- Last-Modified: 2026-11-18 12:29
- `aapt dump badging`: package `com.studyzone.app`, `versionCode='11'`, `versionName='2.0.9'`,
  `minSdkVersion` 23, `targetSdkVersion` 35, `debuggable: true`, `application-label: Second Brain`.
- `apksigner verify --print-certs`: signed with the Android debug certificate
  (`CN=Android Debug`, SHA-256 `0aa60474f008f69373df41fb1f6fdaae59f188c77d1ab6ba538ddb8a69c06572`) —
  the same debug signing used by previously installed debug builds, so the APK installs **as an
  update over the existing one without data loss** (the existing installation shares the same
  debug certificate). `META-INF/*.version` signature warnings are standard Gradle debug output.

## 5. Test results (actually executed)

- Calendar: renders month grid (42 cells), 60 events, +More affordances, no console errors.
- Deadlines: mandatory multi-day rule enforced in timeline + list (1d/2d/3d/7d/30d/due-only/
  daily-recurring cases — 93/93 unit checks); timeline/list render with empty state on demo data,
  no console errors.
- Offline/auth: offline banner + workspace retained offline; real-account E2E not executed here.
- Android WebView / on-device install: **not executed in this session** (APK built and verified,
  not installed on a physical device).
- Build verifications above (badging, signing, size, path): executed against the built APK.
