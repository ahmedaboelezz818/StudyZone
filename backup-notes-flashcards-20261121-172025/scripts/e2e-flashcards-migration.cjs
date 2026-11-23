// End-to-end check of the legacy IndexedDB id migration on a real browser.
// Seeds the v1 database with legacy ("deck_…", "card_…", "rev_…") ids and
// legacy review payloads, then reloads and verifies everything is UUID-mapped.
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

(async () => {
  const PORT = 5597;
  const BASE = `http://127.0.0.1:${PORT}/`;
  const server = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 1600));
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe",
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  page.on("console", (m) => {
    if (/legacy ids migrated|migration failed/i.test(m.text())) console.log("[console]", m.text());
  });

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  // Seed the legacy database (v1 shape + legacy ids).
  const seeded = await page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open("studyzone_flashcards", 1);
    open.onupgradeneeded = (event) => {
      const db = event.target.result;
      for (const name of ["decks", "cards", "reviews", "notes", "media", "settings", "outbox", "meta"]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      }
    };
    open.onerror = () => reject(open.error || new Error("open failed"));
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(["decks", "cards", "reviews", "outbox"], "readwrite");
      const deckId = "deck_legacyabc123def456";
      const cardId = "card_legacycard123456";
      const revId = "rev_legacyrev123456";
      tx.objectStore("decks").put({
        id: deckId, user_id: "local-user", name: "Biology (legacy)",
        description: "seeded", color: "#06D6A0", icon: "f", parent_id: null,
        created_at: "2026-11-16T10:00:00.000Z", updated_at: "2026-11-16T10:00:00.000Z", deleted_at: null,
      });
      tx.objectStore("cards").put({
        id: cardId, user_id: "local-user", deck_id: deckId, template: "basic", type: "basic",
        front: "What is photosynthesis?", back: "Energy conversion",
        state: "review", due_at: "2026-11-16T09:00:00.000Z", interval_days: 3,
        ease: 2.4, reps: 4, lapses: 0, learning_step: 0,
        created_at: "2026-11-16T10:00:00.000Z", updated_at: "2026-11-16T10:00:00.000Z", deleted_at: null,
        source: "manual",
      });
      tx.objectStore("reviews").put({
        id: revId, user_id: "local-user", card_id: cardId, deck_id: deckId,
        rating: 3, reviewed_at: "2026-11-16T10:05:00.000Z", local_day: "2026-11-16",
        was_new: false, state: "review", interval_days: 3, ease: 2.4,
        lapses: 0, learning_step: 0,
      });
      tx.objectStore("outbox").put({
        id: "fc_out_seed1", seq: 1700000000000,
        table: "flashcard_reviews", op: "upsert", row_id: revId,
        payload: {
          id: revId, user_id: "local-user", card_id: cardId, deck_id: deckId,
          rating: 3, reviewed_at: "2026-11-16T10:05:00.000Z", local_day: "2026-11-16",
          was_new: false, state: "review",
          next_interval_days: 6, next_ease: 2.3, next_lapses: 0, next_learning_step: 0,
          next_due_at: "2026-11-22T10:05:00.000Z",
        },
        created_at: "2026-11-16T10:05:01.000Z", attempts: 3, status: "pending",
      });
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => reject(tx.error || new Error("seed failed"));
    };
  }));
  console.log("seeded legacy rows:", seeded);

  // Reload so the app opens the DB and runs the migration.
  await page.goto(BASE + "#flashcards", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6000);

  const check = await page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open("studyzone_flashcards", 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(["decks", "cards", "reviews", "outbox", "meta"], "readonly");
      const store = (name) => tx.objectStore(name);
      const out = {};
      store("decks").getAll().onsuccess = (e) => { out.decks = e.target.result; };
      store("cards").getAll().onsuccess = (e) => { out.cards = e.target.result; };
      store("reviews").getAll().onsuccess = (e) => { out.reviews = e.target.result; };
      store("outbox").getAll().onsuccess = (e) => { out.outbox = e.target.result; };
      store("meta").getAll().onsuccess = (e) => { out.meta = e.target.result; };
      tx.oncomplete = () => { db.close(); resolve(out); };
      tx.onerror = () => reject(tx.error);
    };
  }));

  const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ""));
  const deckId = check.decks[0] && check.decks[0].id;
  const cardId = check.cards[0] && check.cards[0].id;
  const revId = check.reviews[0] && check.reviews[0].id;
  console.log("decks:", JSON.stringify(check.decks.map((d) => d.id)));
  console.log("cards:", JSON.stringify(check.cards.map((c) => ({ id: c.id, deck_id: c.deck_id }))));
  console.log("reviews:", JSON.stringify(check.reviews.map((r) => ({ id: r.id, card_id: r.card_id, deck_id: r.deck_id }))));
  console.log("outbox:", JSON.stringify(check.outbox.map((o) => ({ table: o.table, row_id: o.row_id, payload: o.payload })), null, 2));
  console.log("meta flag:", JSON.stringify((check.meta || []).map((m) => m.value && { done: m.value.done })));

  const ok =
    isUuid(deckId) && isUuid(cardId) && isUuid(revId) &&
    check.cards[0].deck_id === deckId &&
    check.reviews[0].card_id === cardId &&
    check.reviews[0].deck_id === deckId &&
    check.outbox[0] && check.outbox[0].table === "flashcard_review_logs" &&
    isUuid(check.outbox[0].row_id) &&
    check.outbox[0].payload && isUuid(check.outbox[0].payload.id) &&
    check.outbox[0].payload.card_id === cardId &&
    check.outbox[0].payload.deck_id === deckId &&
    check.meta.some((m) => m.id === "meta_uuid_map_v1" && m.value && m.value.done === true);
  console.log(ok ? "MIGRATION E2E PASSED" : "MIGRATION E2E FAILED");
  server.kill();
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
