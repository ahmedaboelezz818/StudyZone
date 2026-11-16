// Static/behavioral checks for the flashcards sync fixes.
// Run: node tests/flashcards-sync-checks.js
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

let failures = 0;
function check(name, condition) {
  if (condition) console.log("  ✓", name);
  else { console.error("  ✗", name); failures += 1; }
}
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }

const sync = read("flashcards-sync.js");
const core = read("flashcards-core.js");
const db = read("flashcards-db.js");
const flash = read("flashcards.js");

console.log("review table mapping");
check("no REST reference to flashcard_reviews remains", !/from\("flashcard_reviews"\)/.test(sync));
check("pullTable uses flashcard_review_logs", sync.includes("flashcard_review_logs"));
check("legacy outbox table name is mapped, not dropped", /REMOTE_TABLE_FOR\s*=\s*\{[\s\S]*flashcard_reviews/.test(sync));
check("local store name 'reviews' preserved", sync.includes('flashcard_review_logs: "reviews"'));
check("flashcards.js enqueues review_logs", flash.includes('"flashcard_review_logs"'));

console.log("deck upsert");
check("uid() returns a real UUID", /function uid\([\s\S]*?randomUUID\(\)/.test(core) && !/prefix \|\| "id"}_/.test(core));
check("db generateId no longer prefixes ids", !/generateId\([\s\S]*?"\$\{prefix \|\| "id"}_\$\{random\}`/.test(db));
check("payload whitelist exists for flashcard_decks", sync.includes('flashcard_decks: ["id"'));
check("settings upsert targets user_id", sync.includes('flashcard_user_settings: "user_id"'));
check("settings push strips synthetic id", sync.includes("return { user_id: clean.user_id || sessionUserId, payload: settings }"));
check("env sweep: no next_* columns pushed to review_logs (mapped/dropped)", /next_due_at: null,/.test(sync) && /next_interval_days: "interval_days"/.test(sync));

console.log("offline-first safety");
check("outbox entries are never deleted on failure", /status: "pending", last_error: message/.test(sync) || /setOutboxEntry\(entry\.id, \{ status: "pending"/.test(sync));
check("pendingIds keeps non-synced rows", /status !== "synced"/.test(sync));
check("IndexedDB migration is idempotent (meta flag)", /UUID_MIGRATION_META_ID|uuid_map_v1/.test(db));
check("no deleteDatabase anywhere", !/deleteDatabase/.test(db) && !/deleteDatabase/.test(core) && !/deleteDatabase/.test(flash));

console.log("page-clobber guard");
check("flashcards render() never clobbers other pages", flash.includes('window.StudyZoneApp?.page') && flash.includes('"flashcards"') && /if \(pageNow && pageNow !== "flashcards"\) return ""/.test(flash));

console.log("XP isolation");
check("sync engine never imports user_xp", !/user_xp/.test(sync));
check("flashcards.js does not write public.user_xp", !/from\("user_xp"\)/.test(flash));

console.log(failures ? `FAILED (${failures})` : "ALL FLASHCARDS SYNC CHECKS PASSED");
process.exit(failures ? 1 : 0);
