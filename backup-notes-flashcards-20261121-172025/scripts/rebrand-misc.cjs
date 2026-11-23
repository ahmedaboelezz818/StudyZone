const fs = require("fs");
const files = [
  "locales/extra.ar.json",
  "tests/platform-checks.js",
  "tests/static-checks.js",
  "design-tokens.css",
  "premium-dashboard.css",
  "premium-pages.css",
  "premium-responsive.css",
  "premium.css",
  "mobile.css",
  "flashcards.css",
  "team-live.css",
  "themes-presets.css",
  "themes.css",
  "ui-controls.css",
  "docs/ANDROID_BUILD_AND_PUSH.md",
  "docs/FLASHCARDS_FINAL_REPORT.md",
  "SUPABASE_SQL_FIX_INSTRUCTIONS.md",
  "scripts/build-web.js",
  "scripts/e2e-flashcards.cjs",
  "scripts/extract-locales.js",
  "scripts/fetch-fonts.js",
  "scripts/generate-theme-presets.js",
  "supabase/functions/deadline-reminders/index.ts",
  "supabase/functions/team-live-call-push/index.ts",
  "supabase/functions/team-live-message-push/index.ts",
  "supabase/functions/turn-credentials/index.ts",
  "package.json",
];
const pairs = [
  ["Study Zone", "Second Brain"],
  ["STUDY ZONE", "SECOND BRAIN"],
];
for (const file of files) {
  let text = fs.readFileSync(file, "utf8");
  const before = text;
  for (const [from, to] of pairs) text = text.split(from).join(to);
  if (text !== before) {
    fs.writeFileSync(file, text, "utf8");
    console.log("updated", file);
  }
}
