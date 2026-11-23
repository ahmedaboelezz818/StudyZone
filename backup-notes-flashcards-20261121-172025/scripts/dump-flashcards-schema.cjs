const fs = require("fs");
const s = fs.readFileSync("backup-repair-pass-20261116-113719/migration_009_flashcards_system.sql.bak", "utf8");
for (const t of ["flashcard_cards", "flashcard_notes", "flashcard_media", "flashcard_user_settings", "flashcard_decks", "flashcard_review_logs"]) {
  const marker = `create table if not exists public.${t}`;
  const i = s.indexOf(marker);
  const end = s.indexOf(");", i);
  console.log("=".repeat(24), t);
  console.log(i >= 0 && end > i ? s.slice(i, end + 2) : "NOT IN MIGRATION 009");
  console.log();
}
