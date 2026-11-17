/*
 * Second Brain flashcards local database (IndexedDB).
 *
 * Per-user persistent storage so decks, cards, reviews, notes, media and the
 * sync outbox survive restarts without any network connection. Only used while
 * signed in; cleared per account so guest devices never leak another user.
 */
(() => {
  "use strict";

  const DB_NAME = "studyzone_flashcards";
  const DB_VERSION = 1;
  const STORES = {
    decks: "decks",
    cards: "cards",
    reviews: "reviews",
    notes: "notes",
    media: "media",
    settings: "settings",
    outbox: "outbox",
    meta: "meta",
  };
  const REQUEST_STORE_ALIASES = {
    deck: "decks",
    card: "cards",
    review: "reviews",
    note: "notes",
    media: "media",
    settings: "settings",
  };

  let dbPromise = null;

  function generateId(prefix) {
    // Primary keys in Supabase are UUID; always generate UUIDs so local rows
    // can be upserted without HTTP 400.
    return uidCompat();
  }

  function uidCompat() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function isUuid(value) {
    return typeof value === "string" && UUID_RE.test(value);
  }

  function ensureStore(db, name, keyPath) {
    return db.objectStoreNames.contains(name)
      ? db.transaction ? null : null // placeholder; actual store obtained via upgrade tx
      : db.createObjectStore(name, { keyPath: keyPath || "id" });
  }

  function ensureIndex(store, name, keyPath) {
    if (!store || !name || !keyPath) return;
    if (!store.indexNames.contains(name)) store.createIndex(name, keyPath);
  }

  function openDb() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        let settled = false;
        const fail = (err) => {
          if (settled) return;
          settled = true;
          dbPromise = null; // allow retry after failure
          try { reject(err || new Error("Flashcards: could not open IndexedDB")); } catch (_) { reject(new Error("Flashcards: could not open IndexedDB")); }
        };
        try {
          const request = indexedDB.open(DB_NAME, DB_VERSION);
          request.onupgradeneeded = (event) => {
            try {
              const db = event.target.result;
              const tx = event.target.transaction;
              // Create all required stores if missing (preserve existing names/keyPaths)
              Object.keys(STORES).forEach((key) => {
                const storeName = STORES[key];
                if (!db.objectStoreNames.contains(storeName)) {
                  db.createObjectStore(storeName, { keyPath: "id" });
                }
              });
              // Ensure indexes on existing stores (idempotent)
              if (tx) {
                const cards = tx.objectStore(STORES.cards);
                ensureIndex(cards, "deck_id", "deck_id");
                ensureIndex(cards, "due_at", "due_at");
                const reviews = tx.objectStore(STORES.reviews);
                ensureIndex(reviews, "card_id", "card_id");
                ensureIndex(reviews, "reviewed_at", "reviewed_at");
              }
            } catch (err) {
              // Abort upgrade transaction so it doesn't leave DB in a bad partial state;
              // request.onerror will reject the open promise.
              try { event.target.transaction && event.target.transaction.abort(); } catch (_) {}
              console.error("Flashcards DB upgrade failed", err);
              throw err;
            }
          };
          request.onsuccess = () => {
            if (settled) return;
            settled = true;
            const db = request.result;
            // One-time legacy id → UUID migration. Best effort: never blocks boot.
            migrateLegacyIds(db).finally(() => resolve(db));
          };
          request.onerror = () => fail(request.error || new Error("Flashcards: could not open IndexedDB"));
          request.onblocked = () => {
            console.warn("Flashcards DB open blocked by another open connection/tab.");
          };
        } catch (err) {
          fail(err);
        }
      });
    }
    return dbPromise;
  }

  // ---------------------------------------------------------------------------
  // One-time legacy id migration (IndexedDB)
  //
  // Before the sync fix, local rows were created with non-UUID keys
  // ("deck_<hex>", "card_<hex>", "rev_<hex>"). Supabase primary keys are UUID,
  // so every upsert of an existing/new deck, card, note, media row or review
  // failed with HTTP 400. This migration remaps every living row to a UUID and
  // rewrites all references (deck_id / card_id / note_id / media_id / parent_id)
  // and the sync outbox. It is idempotent: a crash mid-way retries on the next
  // launch using the persisted mapping in the meta store.
  // ---------------------------------------------------------------------------
  const UUID_MIGRATION_META_ID = "meta_uuid_map_v1";
  const REF_FIELD_DEFS = [
    ["parent_id", "decks"],
    ["deck_id", "decks"],
    ["note_id", "notes"],
    ["media_id", "media"],
    ["card_id", "cards"],
  ];
  const OUTBOX_TABLE_MAP = {
    flashcard_decks: "decks",
    flashcard_cards: "cards",
    flashcard_notes: "notes",
    flashcard_media: "media",
    flashcard_reviews: "reviews",
    flashcard_review_logs: "reviews",
  };

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
      transaction.onabort = () => reject(transaction.error || transaction.abortReason || new Error("IndexedDB transaction aborted"));
    });
  }

  function applyRefs(row, maps) {
    const next = { ...row };
    let touched = false;
    for (const [field, storeName] of REF_FIELD_DEFS) {
      const value = next[field];
      if (value == null) continue;
      const id = String(value);
      const map = maps[storeName];
      if (map && map[id]) {
        next[field] = map[id];
        touched = true;
      }
    }
    return { next, touched };
  }

  function remapOutboxEntry(row, maps) {
    const next = { ...row };
    const originalTable = next.table;
    const mappedStore = originalTable ? OUTBOX_TABLE_MAP[originalTable] : null;
    if (originalTable === "flashcard_reviews") next.table = "flashcard_review_logs";
    let touched = next.table !== originalTable;
    const tableMap = mappedStore ? maps[mappedStore] : null;
    if (tableMap) {
      if (next.row_id != null && tableMap[String(next.row_id)]) {
        next.row_id = tableMap[String(next.row_id)];
        touched = true;
      }
      if (next.payload && typeof next.payload === "object" && !Array.isArray(next.payload)) {
        const payload = { ...next.payload };
        if (payload.id != null && tableMap[String(payload.id)]) {
          payload.id = tableMap[String(payload.id)];
          touched = true;
        }
        const refs = applyRefs(payload, maps);
        if (refs.touched) {
          Object.assign(payload, refs.next);
          touched = true;
        }
        next.payload = payload;
      }
    }
    return touched ? next : null;
  }

  function readStores(db, storeNames) {
    return new Promise((resolve, reject) => {
      const snap = {};
      const transaction = db.transaction(storeNames, "readonly");
      transactionDone(transaction).then(() => resolve(snap), reject);
      for (const name of storeNames) {
        const request = transaction.objectStore(name).getAll();
        request.onsuccess = () => { snap[name] = request.result || []; };
        request.onerror = () => reject(request.error);
      }
    });
  }

  function persistMigrationResult(db, maps) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("meta", "readwrite");
      transactionDone(transaction).then(resolve, reject);
      transaction.objectStore("meta").put({
        id: UUID_MIGRATION_META_ID,
        key: "uuid_map_v1",
        value: { ...maps, done: true },
      });
    });
  }

  async function migrateLegacyIds(db) {
    try {
      const present = ["decks", "cards", "notes", "media", "reviews", "outbox", "meta"]
        .filter((name) => db.objectStoreNames.contains(name));
      if (!present.includes("meta") || present.length < 2) return;
      const buildStores = present.filter((name) => name !== "meta");
      const snap = await readStores(db, present);
      const metaRow = (snap.meta || []).find((row) => row && row.id === UUID_MIGRATION_META_ID);
      const prev = (metaRow && metaRow.value) || {};
      if (prev.done === true) return; // already migrated

      const maps = {
        decks: { ...(prev.decks || {}) },
        cards: { ...(prev.cards || {}) },
        notes: { ...(prev.notes || {}) },
        media: { ...(prev.media || {}) },
        reviews: { ...(prev.reviews || {}) },
      };
      let changed = false;
      for (const storeName of Object.keys(maps)) {
        for (const row of snap[storeName] || []) {
          const id = row && row.id != null ? String(row.id) : "";
          if (!id || isUuid(id)) continue;
          if (!maps[storeName][id]) {
            maps[storeName][id] = uidCompat();
            changed = true;
          }
        }
      }
      const hasLegacyRefs = Object.keys(maps).some((storeName) =>
        (snap[storeName] || []).some((row) => applyRefs(row, maps).touched),
      );
      const hasLegacyOutbox = (snap.outbox || []).some((row) => row && remapOutboxEntry(row, maps) !== null);

      if (!changed && !hasLegacyRefs && !hasLegacyOutbox) {
        await persistMigrationResult(db, maps);
        return;
      }

      await new Promise((resolve, reject) => {
        const allStores = present; // includes meta
        const transaction = db.transaction(allStores, "readwrite");
        transactionDone(transaction).then(resolve, reject);
        const stores = {};
        for (const name of allStores) stores[name] = transaction.objectStore(name);

        // 1) Rewrite primary keys. Remap refs once here (row content changes once).
        for (const storeName of Object.keys(maps)) {
          for (const row of snap[storeName] || []) {
            const id = row && row.id != null ? String(row.id) : "";
            const mapped = maps[storeName][id];
            if (!mapped) continue;
            const next = { ...row, id: mapped };
            const fixed = applyRefs(next, maps);
            stores[storeName].delete(id);
            stores[storeName].put(fixed.next);
          }
        }
        // 2) Remap refs on rows whose own ids were already UUIDs (untouched above).
        for (const storeName of ["decks", "cards", "notes", "media", "reviews"]) {
          for (const row of snap[storeName] || []) {
            const id = row && row.id != null ? String(row.id) : "";
            if (maps[storeName][id]) continue; // handled in step 1
            const fixed = applyRefs(row, maps);
            if (fixed.touched) stores[storeName].put(fixed.next);
          }
        }
        // 3) Remap the outbox so pending changes reference new ids and tables.
        for (const row of snap.outbox || []) {
          if (!row) continue;
          const next = remapOutboxEntry(row, maps);
          if (next) stores.outbox.put(next);
        }
        // 4) Persist the id map + done flag atomically with the rewrite.
        stores.meta.put({
          id: UUID_MIGRATION_META_ID,
          key: "uuid_map_v1",
          value: { ...maps, done: true },
        });
      });
      console.info("Flashcards DB: legacy ids migrated to UUIDs.");
    } catch (error) {
      // Never break app boot: log and continue; migration retries next launch.
      console.warn("Flashcards DB: legacy id migration failed (will retry).", error);
    }
  }

  function tx(store, mode, run) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      let req;
      try {
        const transaction = db.transaction(store, mode);
        const storeObject = transaction.objectStore(store);
        req = run(storeObject);
        transaction.oncomplete = () => resolve(req && req.result);
        transaction.onerror = () => reject(transaction.error || new Error("Flashcards transaction failed"));
        transaction.onabort = () => reject(transaction.error || transaction.abortReason || new Error("Flashcards transaction aborted"));
      } catch (err) {
        reject(err);
      }
    }));
  }

  function getAll(store) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(store, "readonly");
        const request = transaction.objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || transaction.abortReason);
      } catch (err) { reject(err); }
    }));
  }

  function getOne(store, key) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(store, "readonly");
        const request = transaction.objectStore(store).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || transaction.abortReason);
      } catch (err) { reject(err); }
    }));
  }

  function assertKey(store, value) {
    if (value == null || value.id == null || value.id === "") {
      const err = new Error(`Flashcards DB: missing key "id" for store "${store}"`);
      err.name = "DataError";
      console.error("Flashcards DB put key missing", { store, keyPath: "id", valueType: typeof value });
      throw err;
    }
  }

  function put(store, value) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      try {
        assertKey(store, value);
        const transaction = db.transaction(store, "readwrite");
        transaction.objectStore(store).put(value);
        transaction.oncomplete = () => resolve(value);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || transaction.abortReason);
      } catch (err) { reject(err); }
    }));
  }

  function putMany(store, values) {
    const list = Array.isArray(values) ? values : [values];
    return openDb().then((db) => new Promise((resolve, reject) => {
      try {
        list.forEach((value) => assertKey(store, value));
        const transaction = db.transaction(store, "readwrite");
        const storeObject = transaction.objectStore(store);
        list.forEach((value) => storeObject.put(value));
        transaction.oncomplete = () => resolve(list.length);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || transaction.abortReason);
      } catch (err) { reject(err); }
    }));
  }

  function remove(store, keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    if (!list.length) return Promise.resolve(0);
    return openDb().then((db) => new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(store, "readwrite");
        list.forEach((key) => transaction.objectStore(store).delete(key));
        transaction.oncomplete = () => resolve(list.length);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || transaction.abortReason);
      } catch (err) { reject(err); }
    }));
  }

  function putIfExists(store, value) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      try {
        assertKey(store, value);
        const transaction = db.transaction(store, "readwrite");
        const request = transaction.objectStore(store).put(value);
        request.onsuccess = () => resolve(value);
        request.onerror = () => reject(request.error);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || transaction.abortReason);
      } catch (err) { reject(err); }
    }));
  }

  async function clearUser(userId) {
    const stores = Object.keys(STORES);
    const uid = userId == null ? "" : String(userId);
    for (const store of stores) {
      const rows = await getAll(store);
      if (!rows || !rows.length) continue;
      if (!uid) continue; // never wipe all users' flashcard data implicitly
      const toDelete = [];
      rows.forEach((row) => {
        if (!row || row.id == null) return;
        const id = String(row.id);
        // User-scoped singleton keys
        if (id === `settings_${uid}` || id === `meta_${uid}`) { toDelete.push(row.id); return; }
        if (Object.prototype.hasOwnProperty.call(row, "user_id")) {
          if (String(row.user_id || "") === uid) toDelete.push(row.id);
          return;
        }
        // Outbox entries may carry payload with user context
        if (store === STORES.outbox) {
          const p = row.payload || {};
          if (String(p.user_id || p.userId || "") === uid) toDelete.push(row.id);
        }
      });
      if (toDelete.length) await remove(store, toDelete);
    }
    return true;
  }

  const api = {
    async open() { return openDb(); },
    clearUser,
    decks: {
      async list(userId) {
        const all = await getAll(STORES.decks);
        return (all || []).filter((row) => row && (!row.user_id || row.user_id === userId) && !row.deleted_at);
      },
      async get(userId, id) { const row = await getOne(STORES.decks, id); return row && (!row.user_id || row.user_id === userId) ? row : null; },
      async put(userId, deck) { const next = { ...deck, user_id: userId }; if (next.id == null || next.id === "") next.id = generateId("deck"); await put(STORES.decks, next); return next; },
      async remove(userId, id) { const row = await getOne(STORES.decks, id); if (row && (!row.user_id || row.user_id === userId)) await put(STORES.decks, { ...row, deleted_at: new Date().toISOString() }); },
    },
    cards: {
      async list(userId, opts) {
        const rows = await getAll(STORES.cards);
        const visible = (rows || []).filter((row) => row && (!row.user_id || row.user_id === userId));
        const filtered = opts && opts.deckId ? visible.filter((row) => row.deck_id === opts.deckId) : visible;
        return (filtered || []).filter((row) => !row.deleted_at).sort((a, b) => String(a.due_at || "").localeCompare(String(b.due_at || "")));
      },
      async get(userId, id) { const row = await getOne(STORES.cards, id); return row && (!row.user_id || row.user_id === userId) ? row : null; },
      async put(userId, card) { const next = { ...card, user_id: userId }; if (next.id == null || next.id === "") next.id = generateId("card"); await put(STORES.cards, next); return next; },
      async remove(userId, id) { const row = await this.get(userId, id); if (row) await put(STORES.cards, { ...row, deleted_at: new Date().toISOString() }); },
    },
    reviews: {
      async list(userId) { const rows = await getAll(STORES.reviews); const visible = (rows || []).filter((row) => !row.user_id || row.user_id === userId); return visible.sort((a, b) => String(a.reviewed_at || "").localeCompare(String(b.reviewed_at || ""))); },
      async put(userId, rows) {
        const list = (Array.isArray(rows) ? rows : [rows]).map((row) => ({ ...row, user_id: userId }));
        const byCard = new Map();
        list.forEach((row) => { byCard.set(row.card_id, row); });
        const cards = await getAll(STORES.cards);
        const updates = (cards || []).filter((card) => byCard.has(card.id)).map((card) => {
          const review = byCard.get(card.id);
          return {
            ...card,
            state: review.state,
            due_at: review.next_due_at || card.due_at,
            // Prefer confirmed column names; fall back to legacy local-only aliases.
            interval_days: review.interval_days != null ? review.interval_days : review.next_interval_days,
            ease: review.ease != null ? review.ease : review.next_ease,
            lapses: review.lapses != null ? review.lapses : review.next_lapses,
            learning_step: review.learning_step != null ? review.learning_step : review.next_learning_step,
            last_reviewed_at: review.reviewed_at,
            updated_at: review.reviewed_at,
          };
        });
        await putMany(STORES.cards, updates);
        return putMany(STORES.reviews, list);
      },
      async remove(userId, ids) { const list = Array.isArray(ids) ? ids : [ids]; return remove(STORES.reviews, list.map((id) => String(id))); },
    },
    notes: {
      async list(userId) { const rows = await getAll(STORES.notes); const visible = (rows || []).filter((row) => !row.user_id || row.user_id === userId); return visible.filter((row) => !row.deleted_at); },
      async put(userId, note) { const next = { ...note, user_id: userId }; if (next.id == null || next.id === "") next.id = generateId("note"); await put(STORES.notes, next); return next; },
      async remove(userId, id) { const rows = await getAll(STORES.notes); const row = (rows || []).find((item) => item.id === id); if (row) await put(STORES.notes, { ...row, deleted_at: new Date().toISOString() }); },
    },
    media: {
      async list(userId) { const rows = await getAll(STORES.media); const visible = (rows || []).filter((row) => !row.user_id || row.user_id === userId); return visible.filter((row) => !row.deleted_at); },
      async put(userId, media) { const next = { ...media, user_id: userId }; await put(STORES.media, next); return next; },
      async remove(userId, id) { const rows = await getAll(STORES.media); const row = (rows || []).find((item) => item.id === id); if (row) await put(STORES.media, { ...row, deleted_at: new Date().toISOString() }); },
    },
    settings: {
      async get(userId) { const row = await getOne(STORES.settings, `settings_${userId}`); return row || null; },
      async put(userId, settings) {
        const base = typeof settings === "object" && settings !== null && !Array.isArray(settings) ? settings : { user_id: userId, payload: settings };
        const next = { ...base, id: `settings_${userId}`, user_id: userId };
        await put(STORES.settings, next);
        return next;
      },
    },
    // Low-level store access for the sync engine only. Not used by the UI.
    raw: {
      getAll: (store) => getAll(STORES[store] || store),
      getOne: (store, key) => getOne(STORES[store] || store, key),
      put: (store, value) => put(STORES[store] || store, value),
    },
    outbox: {
      async list() { return getAll(STORES.outbox); },
      async add(entry) { const next = { created_at: new Date().toISOString(), ...entry }; return put(STORES.outbox, next); },
      async remove(ids) { const list = Array.isArray(ids) ? ids : [ids]; return remove(STORES.outbox, list.map((id) => String(id))); },
    },
    meta: {
      async get(key) { const row = await getOne(STORES.meta, `meta_${key}`); return row || null; },
      async put(key, value) { const row = { id: `meta_${key}`, key, value }; await put(STORES.meta, row); return row; },
    },
  };

  const apiRef = {
    open,
    clearUser,
    decks: api.decks,
    cards: api.cards,
    reviews: api.reviews,
    notes: api.notes,
    media: api.media,
    settings: api.settings,
    outbox: api.outbox,
    meta: api.meta,
    raw: api.raw,
  };

  window.StudyZoneFlashcardsDb = apiRef;
  globalThis.StudyZoneFlashcardsDb = apiRef;
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { open: () => Promise.resolve(), clearUser: async () => true };
}
