/*
 * Study Zone flashcards sync engine.
 *
 * Pushes the local outbox to Supabase and pulls the latest server rows, then
 * merges them into the local IndexedDB with last-write-wins semantics based on
 * the server row's `updated_at`. The golden rule: never overwrite a row that
 * has a pending local outbox change — that would silently drop offline edits.
 * Conflicts are counted and surfaced instead of being resolved silently.
 *
 * Design:
 *  - local IndexedDB is the source of truth for rendering (offline-first);
 *  - writes go to the local outbox first, so offline study never blocks;
 *  - the push runs only while online, in order, and never blocks the UI;
 *  - pull-merge is idempotent and safe to run repeatedly;
 *  - rows are keyed by `id` on both sides, so repeated syncs cannot create
 *    duplicate decks/cards/reviews.
 */
(() => {
  "use strict";

  const TABLES = [
    "flashcard_decks",
    "flashcard_notes",
    "flashcard_cards",
    "flashcard_reviews",
    "flashcard_media",
    "flashcard_user_settings",
  ];
  const STORE_FOR_TABLE = {
    flashcard_decks: "decks",
    flashcard_notes: "notes",
    flashcard_cards: "cards",
    flashcard_reviews: "reviews",
    flashcard_media: "media",
    flashcard_user_settings: "settings",
  };
  // Reviews have no updated_at column; use reviewed_at.
  const STAMP_FOR_TABLE = {
    flashcard_decks: "updated_at",
    flashcard_notes: "updated_at",
    flashcard_cards: "updated_at",
    flashcard_reviews: "reviewed_at",
    flashcard_media: "updated_at",
    flashcard_user_settings: "updated_at",
  };
  const MERGE_ORDER = [
    "flashcard_decks",
    "flashcard_media",
    "flashcard_notes",
    "flashcard_cards",
    "flashcard_reviews",
    "flashcard_user_settings",
  ];
  const MAX_ATTEMPTS = 8;

  let sessionUserId = null;
  let supabaseClient = null;
  let lastError = null;
  let lastSyncAt = 0;
  let lastConflicts = 0;
  let pushing = false;
  let syncing = false;

  function client() { return supabaseClient; }
  function isOnline() {
    try { return typeof navigator === "undefined" || navigator.onLine !== false; }
    catch (_) { return true; }
  }

  function localDb() { return window.StudyZoneFlashcardsDb || null; }

  function outboxRows() {
    const db = localDb();
    return db && db.outbox && typeof db.outbox.list === "function"
      ? db.outbox.list().catch(() => [])
      : Promise.resolve([]);
  }

  async function enqueue(table, op, rowId, payload) {
    const db = localDb();
    if (!db || !db.outbox) return null;
    if (!table || !rowId) return null;
    const entry = {
      id: `fc_out_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      seq: Date.now() * 1000 + Math.floor(Math.random() * 1000),
      table,
      op,
      row_id: String(rowId),
      payload: payload || {},
      created_at: new Date().toISOString(),
      attempts: 0,
      status: "pending",
    };
    try { await db.outbox.add(entry); return entry; }
    catch (err) { console.warn("Flashcards sync: could not enqueue change", err); return null; }
  }

  async function pendingIds() {
    const rows = await outboxRows();
    return new Set((rows || [])
      .filter((row) => row && row.status !== "synced")
      .map((row) => String(row.row_id || (row.payload && row.payload.id) || "")));
  }

  async function listOutbox() {
    const rows = await outboxRows();
    return (rows || []).sort((a, b) => Number(a.seq || 0) - Number(b.seq || 0));
  }

  async function removeSynced(ids) {
    const db = localDb();
    if (!db || !db.outbox || !ids.length) return;
    await db.outbox.remove(ids);
  }

  async function setOutboxEntry(id, patch) {
    const db = localDb();
    if (!db || !db.outbox) return;
    const rows = await db.outbox.list();
    const row = (rows || []).find((item) => String(item.id) === String(id));
    if (!row) return;
    row.attempts = Number(row.attempts || 0) + 1;
    Object.assign(row, patch, { attempts: row.attempts, updated_at: new Date().toISOString() });
    await db.outbox.put(row);
  }

  async function pushOutbox() {
    if (pushing) return { pushed: 0, errors: [], skipped: "already-running" };
    pushing = true;
    const errors = [];
    let pushed = 0;
    try {
      if (!client() || !sessionUserId) return { pushed: 0, errors: [], skipped: "signed-out" };
      if (!isOnline()) return { pushed: 0, errors: [], skipped: "offline" };
      const entries = await listOutbox();
      const doomed = [];
      for (const entry of entries) {
        if (entry.status === "failed" && Number(entry.attempts || 0) >= MAX_ATTEMPTS) {
          // Keep the entry; do not retry forever, but never delete it either.
          errors.push({ id: entry.id, table: entry.table, op: entry.op, error: "max attempts reached" });
          continue;
        }
        const table = entry.table;
        const payload = entry.payload || {};
        const rowId = entry.row_id;
        if (!table || !rowId) { doomed.push(entry.id); continue; }
        try {
          if (entry.op === "delete") {
            // Todos use soft deletes (deleted_at); hard delete is never pushed.
            // Push the soft-delete as an upsert instead of a DELETE.
            const soft = payload && Object.keys(payload).length ? payload : { id: rowId, deleted_at: new Date().toISOString() };
            const result = await client().from(table).upsert(soft, { onConflict: "id" });
            if (result.error) throw result.error;
          } else if (entry.op === "upsert" || entry.op === "insert") {
            if (entry.op === "insert" && table === "flashcard_reviews") {
              const result = await client().from(table).upsert(payload, { onConflict: "id" });
              if (result.error) throw result.error;
            } else {
              const result = await client().from(table).upsert(payload, { onConflict: "id" });
              if (result.error) throw result.error;
            }
          } else {
            const result = await client().from(table).upsert(payload, { onConflict: "id" });
            if (result.error) throw result.error;
          }
          doomed.push(entry.id);
        } catch (error) {
          const message = String((error && error.message) || error);
          errors.push({ id: entry.id, table, op: entry.op, error: message });
          await setOutboxEntry(entry.id, { status: "pending", last_error: message });
        }
      }
      if (doomed.length) await removeSynced(doomed);
      pushed = doomed.length;
      return { pushed, errors };
    } catch (error) {
      errors.push({ error: String((error && error.message) || error) });
      return { pushed: 0, errors };
    } finally {
      pushing = false;
    }
  }

  async function pullTable(table) {
    const response = await client().from(table).select("*");
    const data = Array.isArray(response.data) ? response.data : response.data ? [response.data] : [];
    return data.filter((row) => row && row.id);
  }

  function stampOf(table, row) {
    if (!row) return "";
    const key = STAMP_FOR_TABLE[table] || "updated_at";
    if (table === "flashcard_reviews") {
      return String(row.reviewed_at || row.created_at || "");
    }
    return String(row.updated_at || row.reviewed_at || row.created_at || "");
  }

  async function mergeTable(table, rows, stats) {
    const db = localDb();
    const store = STORE_FOR_TABLE[table];
    if (!db || !store) return;
    const pending = await pendingIds();
    // Local rows indexed by id for comparison.
    let localRows = [];
    try {
      if (store === "decks") localRows = await db.decks.list(sessionUserId);
      else if (store === "cards") localRows = await db.cards.list(sessionUserId, {});
      else if (store === "notes") localRows = await db.notes.list(sessionUserId);
      else if (store === "media") localRows = await db.media.list(sessionUserId);
      else if (store === "reviews") localRows = await db.reviews.list(sessionUserId);
      else if (store === "settings") { const row = await db.settings.get(sessionUserId); localRows = row ? [row] : []; }
    } catch (err) {
      console.warn("Flashcards sync: local read failed for", table, err);
      return;
    }
    const localById = new Map((localRows || []).map((row) => [String(row.id), row]));

    for (const remote of rows || []) {
      if (!remote || !remote.id) continue;
      const id = String(remote.id);
      const local = localById.get(id);

      // Never overwrite a row with unsynced local changes.
      if (pending.has(id)) { stats.conflicts += 1; continue; }

      if (store === "settings") {
        // Only seed settings on a fresh device; never clobber a configured local profile.
        if (!local) {
          try {
            const payload = remote.payload && typeof remote.payload === "object" ? remote.payload : remote;
            await db.settings.put(sessionUserId, payload);
            stats.applied += 1;
          } catch (_) { /* ignore */ }
        }
        continue;
      }

      if (store === "reviews") {
        // Reviews are append-only: insert what we do not have, keep local otherwise.
        if (local) continue;
        try {
          await db.raw.put("reviews", { ...remote, user_id: sessionUserId });
          stats.applied += 1;
        } catch (_) { /* duplicate id → skip */ }
        continue;
      }

      if (!local) {
        try {
          const payload = { ...remote, user_id: sessionUserId };
          delete payload.payload;
          await db.raw.put(store, payload);
          stats.applied += 1;
        } catch (_) { /* ignore */ }
        continue;
      }

      const localStamp = stampOf(table, local);
      const remoteStamp = stampOf(table, remote);
      const remoteIsDeleted = Boolean(remote.deleted_at);
      const localIsDeleted = Boolean(local.deleted_at);

      if (remoteIsDeleted && !localIsDeleted) {
        try { await db.raw.put(store, { ...remote, user_id: sessionUserId }); stats.applied += 1; } catch (_) { /* ignore */ }
        continue;
      }
      if (!remoteIsDeleted && remoteStamp && remoteStamp > localStamp) {
        try { await db.raw.put(store, { ...remote, user_id: sessionUserId }); stats.applied += 1; } catch (_) { /* ignore */ }
      }
    }
  }

  async function syncNow() {
    if (syncing) return { pushed: 0, applied: 0, conflicts: 0, errors: [], skipped: "already-running" };
    syncing = true;
    const summary = { pushed: 0, applied: 0, conflicts: 0, errors: [] };
    try {
      if (!client() || !sessionUserId) return { ...summary, skipped: "signed-out" };
      if (!isOnline()) return { ...summary, skipped: "offline" };
      const pushed = await pushOutbox();
      summary.pushed = pushed.pushed;
      summary.errors = pushed.errors || [];
      // Pull and merge remaining server state. Pull order avoids FK surprises.
      const stats = { applied: 0, conflicts: 0 };
      for (const table of MERGE_ORDER) {
        if (table === "flashcard_user_settings") {
          // Settings merge is cheap; still attempt it.
        }
        let rows = [];
        try { rows = await pullTable(table); } catch (error) {
          summary.errors.push({ table, error: String((error && error.message) || error) });
          continue;
        }
        await mergeTable(table, rows, stats);
      }
      summary.applied = stats.applied;
      summary.conflicts = stats.conflicts;
      lastConflicts = stats.conflicts;
      lastSyncAt = Date.now();
      return summary;
    } catch (error) {
      summary.errors.push({ error: String((error && error.message) || error) });
      return summary;
    } finally {
      syncing = false;
    }
  }

  async function getStatus() {
    const db = localDb();
    let pending = 0;
    let failed = 0;
    try {
      const rows = db && db.outbox ? await db.outbox.list() : [];
      (rows || []).forEach((row) => {
        if (!row) return;
        if (row.status === "failed") failed += 1;
        else pending += 1;
      });
    } catch (_) { /* ignore */ }
    return {
      online: isOnline(),
      signedIn: Boolean(client() && sessionUserId),
      pending,
      failed,
      lastSyncAt,
      lastConflicts,
      lastError: lastError ? String(lastError) : "",
      syncing,
    };
  }

  function start() {
    return {
      syncNow,
      pushOutbox,
      enqueue,
      getStatus,
      getLastError: () => lastError,
      setSession: (userId, client) => { sessionUserId = userId || null; supabaseClient = client || null; },
      getSession: () => sessionUserId,
      getClient: () => supabaseClient,
    };
  }

  window.StudyZoneFlashcardsSync = start();
  globalThis.StudyZoneFlashcardsSync = window.StudyZoneFlashcardsSync;
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { start };
}
