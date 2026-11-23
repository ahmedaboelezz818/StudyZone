/*
 * StudyZone notes local store.
 *
 * Notes are still mirrored to localStorage for fast synchronous startup, but
 * localStorage has a small quota and can be cleared by the OS/browser. This
 * module keeps a durable copy of every note (and the editor draft) in
 * IndexedDB. It never deletes anything on its own and it is account-scoped by
 * the ownerId stored on each record.
 */
(function () {
  "use strict";

  const DB_NAME = "studyzone-notes-store";
  const DB_VERSION = 1;
  const NOTES_STORE = "notes";
  const DRAFT_STORE = "drafts";
  let dbPromise = null;

  function available() {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  }

  function openDb() {
    if (!available()) return Promise.reject(new Error("IndexedDB unavailable"));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(NOTES_STORE)) {
          const store = db.createObjectStore(NOTES_STORE, { keyPath: "id" });
          store.createIndex("ownerId", "ownerId");
          store.createIndex("updated_at", "updated_at");
        }
        if (!db.objectStoreNames.contains(DRAFT_STORE)) {
          db.createObjectStore(DRAFT_STORE, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Notes store blocked"));
    });
    return dbPromise;
  }

  function run(storeName, mode, operation) {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          let request;
          const transaction = db.transaction(storeName, mode);
          transaction.oncomplete = () => resolve(request ? request.result : undefined);
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
          try {
            request = operation(transaction.objectStore(storeName));
          } catch (error) {
            reject(error);
          }
        }),
    );
  }

  function safe(record) {
    if (!record || typeof record !== "object" || !record.id) return null;
    return { ...record, id: String(record.id) };
  }

  async function getAll() {
    try {
      const rows = await run(NOTES_STORE, "readonly", (store) => store.getAll());
      return (rows || []).map(safe).filter(Boolean);
    } catch {
      return [];
    }
  }

  async function putMany(records) {
    const list = (records || []).map(safe).filter(Boolean);
    if (!list.length) return 0;
    try {
      return await run(NOTES_STORE, "readwrite", (store) => {
        let count = 0;
        list.forEach((record) => {
          store.put(record);
          count += 1;
        });
        return count;
      });
    } catch {
      return 0;
    }
  }

  async function put(record) {
    const row = safe(record);
    if (!row) return false;
    try {
      await run(NOTES_STORE, "readwrite", (store) => store.put(row));
      return true;
    } catch {
      return false;
    }
  }

  async function remove(id) {
    if (!id) return false;
    try {
      await run(NOTES_STORE, "readwrite", (store) => store.delete(String(id)));
      return true;
    } catch {
      return false;
    }
  }

  async function removeMany(ids) {
    const list = (ids || []).map(String).filter(Boolean);
    if (!list.length) return 0;
    try {
      return await run(NOTES_STORE, "readwrite", (store) => {
        list.forEach((id) => store.delete(id));
        return list.length;
      });
    } catch {
      return 0;
    }
  }

  async function putDraft(draft) {
    if (!draft || !draft.key) return false;
    const row = { ...draft, key: String(draft.key) };
    try {
      await run(DRAFT_STORE, "readwrite", (store) => store.put(row));
      return true;
    } catch {
      return false;
    }
  }

  async function getDraft(key) {
    if (!key) return null;
    try {
      return await run(DRAFT_STORE, "readonly", (store) => store.get(String(key)));
    } catch {
      return null;
    }
  }

  async function clearDraft(key) {
    if (!key) return false;
    try {
      await run(DRAFT_STORE, "readwrite", (store) => store.delete(String(key)));
      return true;
    } catch {
      return false;
    }
  }

  async function listDrafts() {
    try {
      return (await run(DRAFT_STORE, "readonly", (store) => store.getAll())) || [];
    } catch {
      return [];
    }
  }

  window.StudyZoneNotesStore = {
    available,
    getAll,
    put,
    putMany,
    remove,
    removeMany,
    putDraft,
    getDraft,
    clearDraft,
    listDrafts,
  };
})();
