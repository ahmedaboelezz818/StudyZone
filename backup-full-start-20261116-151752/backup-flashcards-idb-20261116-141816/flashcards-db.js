/*
 * Study Zone flashcards local database (IndexedDB).
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

  function openDb() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const open = () => {
          const request = indexedDB.open(DB_NAME, DB_VERSION);
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            Object.keys(STORES).forEach((store) => {
              if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "id" });
            });
            const cards = db.createObjectStore("cards", { keyPath: "id" });
            cards.createIndex("deck_id", "deck_id");
            cards.createIndex("due_at", "due_at");
            const reviews = db.createObjectStore("reviews", { keyPath: "id" });
            reviews.createIndex("card_id", "card_id");
            reviews.createIndex("reviewed_at", "reviewed_at");
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error || new Error("Flashcards: could not open IndexedDB"));
          request.onblocked = () => {};
        };
        open();
      });
    }
    return dbPromise;
  }

  function tx(store, mode, run) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      const transaction = db.transaction(store, mode);
      const storeObject = transaction.objectStore(store);
      const request = run(storeObject);
      transaction.oncomplete = () => resolve(request && request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    }));
  }

  function getAll(store) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      const transaction = db.transaction(store, "readonly");
      const request = transaction.objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    }));
  }

  function getOne(store, key) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      const transaction = db.transaction(store, "readonly");
      const request = transaction.objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    }));
  }

  function put(store, value) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      const transaction = db.transaction(store, "readwrite");
      transaction.objectStore(store).put(value, value && value.id);
      transaction.oncomplete = () => resolve(value);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    }));
  }

  function putMany(store, values) {
    const list = Array.isArray(values) ? values : [values];
    return openDb().then((db) => new Promise((resolve, reject) => {
      const transaction = db.transaction(store, "readwrite");
      const storeObject = transaction.objectStore(store);
      list.forEach((value) => storeObject.put(value, value && value.id));
      transaction.oncomplete = () => resolve(list.length);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    }));
  }

  function remove(store, keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    if (!list.length) return Promise.resolve(0);
    return openDb().then((db) => new Promise((resolve, reject) => {
      const transaction = db.transaction(store, "readwrite");
      list.forEach((key) => transaction.objectStore(store).delete(key));
      transaction.oncomplete = () => resolve(list.length);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    }));
  }

  function putIfExists(store, value) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      const transaction = db.transaction(store, "readwrite");
      const request = transaction.objectStore(store).put(value, value && value.id);
      request.onsuccess = () => resolve(value);
      request.onerror = () => reject(request.error);
      transaction.onabort = () => reject(transaction.error);
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
      async list(userId) { return getAll(STORES.decks).then((rows) => (rows || []).filter((row) => !row.user_id || row.user_id === userId && !row.deleted_at)); },
      async get(userId, id) { const row = await getOne(STORES.decks, id); return row && (!row.user_id || row.user_id === userId) ? row : null; },
      async put(userId, deck) { const next = { ...deck, user_id: userId }; await put(STORES.decks, next); return next; },
      async remove(userId, id) { const row = await get(userId, id); if (row) await put(STORES.decks, { ...row, deleted_at: new Date().toISOString() }); },
    },
    cards: {
      async list(userId, opts) {
        const rows = await getAll(STORES.cards);
        const visible = (rows || []).filter((row) => !row.user_id || row.user_id === userId);
        const filtered = opts && opts.deckId ? visible.filter((row) => row.deck_id === opts.deckId) : visible;
        return (filtered || []).filter((row) => !row.deleted_at).sort((a, b) => String(a.due_at || "").localeCompare(String(b.due_at || "")));
      },
      async get(userId, id) { const row = await getOne(STORES.cards, id); return row && (!row.user_id || row.user_id === userId) ? row : null; },
      async put(userId, card) { const next = { ...card, user_id: userId }; await put(STORES.cards, next); return next; },
      async remove(userId, id) { const row = await get(userId, id); if (row) await put(STORES.cards, { ...row, deleted_at: new Date().toISOString() }); },
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
            due_at: review.next_due_at || review.next_due_at,
            interval_days: review.next_interval_days != null ? review.next_interval_days : card.interval_days,
            ease: review.next_ease != null ? review.next_ease : card.ease,
            lapses: review.next_lapses != null ? review.next_lapses : card.lapses,
            learning_step: review.next_learning_step != null ? review.next_learning_step : card.learning_step,
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
      async put(userId, note) { const next = { ...note, user_id: userId }; await put(STORES.notes, next); return next; },
      async remove(userId, id) { const rows = await getAll(STORES.notes); const row = (rows || []).find((item) => item.id === id); if (row) await put(STORES.notes, { ...row, deleted_at: new Date().toISOString() }); },
    },
    media: {
      async list(userId) { const rows = await getAll(STORES.media); const visible = (rows || []).filter((row) => !row.user_id || row.user_id === userId); return visible.filter((row) => !row.deleted_at); },
      async put(userId, media) { const next = { ...media, user_id: userId }; await put(STORES.media, next); return next; },
      async remove(userId, id) { const rows = await getAll(STORES.media); const row = (rows || []).find((item) => item.id === id); if (row) await put(STORES.media, { ...row, deleted_at: new Date().toISOString() }); },
    },
    settings: {
      async get(userId) { const row = await getOne(STORES.settings, `settings_${userId}`); return row || null; },
      async put(userId, settings) { const next = typeof settings === "object" && settings !== null ? { ...settings, user_id: userId } : { user_id: userId, payload: settings }; await put(STORES.settings, next); return next; },
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
  };

  window.StudyZoneFlashcardsDb = apiRef;
  globalThis.StudyZoneFlashcardsDb = apiRef;
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { open: () => Promise.resolve(), clearUser: async () => true };
}
