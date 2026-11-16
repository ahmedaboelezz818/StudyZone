// Behavioral test of the sync engine push path against a mocked Supabase client.
// Run: node tests/flashcards-sync-behavior.cjs
const assert = require("assert");

const pushes = [];

// In-memory outbox with a legacy entry (pre-fix shape), a valid deck entry,
// a settings entry and a card entry carrying an unsupported `source` field.
const legacyReview = {
  id: "fc_out_1",
  seq: 1,
  table: "flashcard_reviews", // legacy name
  op: "upsert",
  row_id: "rev_legacy123",
  payload: {
    id: "rev_legacy123",
    user_id: "user-1",
    card_id: "card_legacy456",
    deck_id: "deck_legacy789",
    rating: 3,
    reviewed_at: "2026-11-16T10:00:00.000Z",
    local_day: "2026-11-16",
    was_new: true,
    state: "review",
    next_interval_days: 3,   // legacy field name
    next_ease: 2.4,
    next_lapses: 0,
    next_learning_step: 0,
    next_due_at: "2026-11-19T10:00:00.000Z", // no such column
  },
  attempts: 0,
  status: "pending",
};
const deckEntry = {
  id: "fc_out_2",
  seq: 2,
  table: "flashcard_decks",
  op: "upsert",
  row_id: "2f3c1e5a-3a4b-4f2c-9f1f-7a2b1d2f9a11",
  payload: {
    id: "2f3c1e5a-3a4b-4f2c-9f1f-7a2b1d2f9a11",
    user_id: "user-1",
    name: "Biology",
    description: null,
    color: "#06D6A0",
    icon: "f",
    parent_id: null,
    created_at: "2026-11-16T10:00:00.000Z",
    updated_at: "2026-11-16T10:00:00.000Z",
    deleted_at: null,
    bogus_field: "must-be-dropped",
  },
  attempts: 0,
  status: "pending",
};
const settingsEntry = {
  id: "fc_out_3",
  seq: 3,
  table: "flashcard_user_settings",
  op: "upsert",
  row_id: "settings_user-1",
  payload: { user_id: "user-1", payload: { new_per_day: 20 } },
  attempts: 0,
  status: "pending",
};
const cardEntry = {
  id: "fc_out_4",
  seq: 4,
  table: "flashcard_cards",
  op: "upsert",
  row_id: "3f3c1e5a-3a4b-4f2c-9f1f-7a2b1d2f9a22",
  payload: {
    id: "3f3c1e5a-3a4b-4f2c-9f1f-7a2b1d2f9a22",
    user_id: "user-1",
    deck_id: "2f3c1e5a-3a4b-4f2c-9f1f-7a2b1d2f9a11",
    front: "Q",
    back: "A",
    source: "manual",      // local-only field, not a column
    template: "basic",
    type: "basic",
    created_at: "2026-11-16T10:00:00.000Z",
    updated_at: "2026-11-16T10:00:00.000Z",
  },
  attempts: 0,
  status: "pending",
};
const entries = [legacyReview, deckEntry, settingsEntry, cardEntry];
const removed = [];

const fakeDb = {
  outbox: {
    async list() { return entries.filter((e) => !removed.includes(e.id)); },
    async add(entry) { entries.push(entry); return entry; },
    async remove(ids) { removed.push(...ids); return ids.length; },
    async put(row) { Object.assign(entries.find((e) => e.id === row.id) || {}, row); return row; },
  },
  reviews: { list: async () => [] },
  decks: { list: async () => [] },
  cards: { list: async () => [] },
  notes: { list: async () => [] },
  media: { list: async () => [] },
  settings: { get: async () => null, put: async () => null },
  raw: { put: async () => true },
};

global.window = {};
global.globalThis = global.window;
global.navigator = { onLine: true };
global.window.StudyZoneFlashcardsDb = fakeDb;

// Mocked Supabase client recording every call.
const fakeClient = {
  from(table) {
    return {
      async upsert(payload, opts) {
        pushes.push({ table, payload, onConflict: opts && opts.onConflict });
        return { data: payload, error: null };
      },
      select() {
        return { then: () => Promise.resolve({ data: [], error: null }) };
      },
    };
  },
};

(async () => {
  require("../flashcards-sync.js");
  const api = global.window.StudyZoneFlashcardsSync;
  assert(api, "sync module should expose StudyZoneFlashcardsSync");
  api.setSession("user-1", fakeClient);

  const result = await api.pushOutbox();
  console.log("pushed:", result.pushed, "errors:", result.errors);

  const byTable = new Map();
  for (const p of pushes) {
    if (!byTable.has(p.table)) byTable.set(p.table, []);
    byTable.get(p.table).push(p);
  }

  // 1) Legacy review rows are pushed to flashcard_review_logs.
  assert(byTable.has("flashcard_review_logs"), "legacy review must go to flashcard_review_logs");
  const reviewPush = byTable.get("flashcard_review_logs")[0];
  assert.strictEqual(reviewPush.onConflict, "id");
  // 2) Unknown columns are dropped, legacy names renamed.
  assert.strictEqual(reviewPush.payload.next_due_at, undefined, "next_due_at must be dropped");
  assert.strictEqual(reviewPush.payload.next_interval_days, undefined, "legacy next_interval_days must not be sent");
  assert.strictEqual(reviewPush.payload.interval_days, 3);
  assert.strictEqual(reviewPush.payload.ease, 2.4);
  assert.strictEqual(reviewPush.payload.lapses, 0);
  assert.strictEqual(reviewPush.payload.learning_step, 0);
  // 3) Deck pushed with only confirmed columns; conflict target id.
  const deckPush = byTable.get("flashcard_decks")[0];
  assert.strictEqual(deckPush.payload.bogus_field, undefined, "bogus_field must be dropped");
  assert.strictEqual(deckPush.payload.name, "Biology");
  // 4) Settings upserts by user_id without id.
  const settingsPush = byTable.get("flashcard_user_settings")[0];
  assert.strictEqual(settingsPush.onConflict, "user_id");
  assert.strictEqual(settingsPush.payload.id, undefined);
  assert.strictEqual(settingsPush.payload.user_id, "user-1");
  // 5) Card's local-only `source` dropped.
  const cardPush = byTable.get("flashcard_cards")[0];
  assert.strictEqual(cardPush.payload.source, undefined);
  // 6) All pending entries confirmed pushed (fake client returns no error).
  assert.strictEqual(result.pushed, 4, "all four entries should be pushed");
  assert.strictEqual(result.errors.length, 0);

  console.log("behavior test PASSED — all 6 assertions hold");
  process.exit(0);
})().catch((e) => {
  console.error("BEHAVIOR TEST FAILED:", e.message);
  process.exit(1);
});
