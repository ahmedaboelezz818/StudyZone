/*
 * Second Brain flashcards sync engine.
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
 *
 * Notes on the remote schema (confirmed, see supabase/migrations/009):
 *  - the review history table is `public.flashcard_review_logs`;
 *    there is NO `public.flashcard_reviews` table. Legacy outbox entries that
 *    still reference "flashcard_reviews" are mapped to it on push/pull.
 *  - primary keys are uuid; the client must generate UUIDs for new rows
 *    (see generateId()/uid() using crypto.randomUUID).
 *  - every payload is whitelisted against the confirmed columns before push,
 *    so a stale local field can never produce an HTTP 400 again.
 *  - `flashcard_user_settings` is keyed by `user_id` (not id) and upserts
 *    on that conflict target.
 */
(() => {
  "use strict";

  // Remote table names (what Supabase/PostgREST actually exposes).
  const TABLES = [
    "flashcard_decks",
    "flashcard_notes",
    "flashcard_cards",
    "flashcard_review_logs",
    "flashcard_media",
    "flashcard_user_settings",
  ];
  const STORE_FOR_TABLE = {
    flashcard_decks: "decks",
    flashcard_notes: "notes",
    flashcard_cards: "cards",
    flashcard_review_logs: "reviews",
    flashcard_media: "media",
    flashcard_user_settings: "settings",
  };
  // Reviews have no updated_at column; use reviewed_at.
  const STAMP_FOR_TABLE = {
    flashcard_decks: "updated_at",
    flashcard_notes: "updated_at",
    flashcard_cards: "updated_at",
    flashcard_review_logs: "reviewed_at",
    flashcard_media: "updated_at",
    flashcard_user_settings: "updated_at",
  };
  // Legacy outbox rows may still say "flashcard_reviews" — map them to the real table.
  const REMOTE_TABLE_FOR = {
    flashcard_reviews: "flashcard_review_logs",
  };
  // Confirmed public columns per table (supabase/migrations/009 + live facts).
  const COLUMNS_FOR_TABLE = {
    flashcard_decks: ["id", "user_id", "parent_id", "name", "description", "color", "icon", "subject_id",
      "new_per_day", "reviews_per_day", "desired_retention", "sort_order",
      "created_at", "updated_at", "deleted_at"],
    flashcard_notes: ["id", "user_id", "deck_id", "type", "fields", "tags", "notes",
      "created_at", "updated_at", "deleted_at"],
    flashcard_cards: ["id", "user_id", "note_id", "deck_id", "template", "type", "front", "back",
      "media_id", "state", "due_at", "interval_days", "ease", "reps", "lapses",
      "learning_step", "last_reviewed_at", "suspended",
      "created_at", "updated_at", "deleted_at"],
    flashcard_review_logs: ["id", "user_id", "card_id", "deck_id", "rating", "reviewed_at",
      "local_day", "was_new", "state", "interval_days", "ease", "lapses",
      "learning_step", "duration_ms", "created_at"],
    flashcard_media: ["id", "user_id", "kind", "name", "mime_type", "data_url", "byte_size",
      "created_at", "updated_at", "deleted_at"],
    flashcard_user_settings: ["user_id", "payload", "updated_at"],
  };
  // Rename local/aliased fields to confirmed columns; null = drop the field entirely.
  const FIELD_MAP_FOR_TABLE = {
    flashcard_review_logs: {
      next_interval_days: "interval_days",
      next_ease: "ease",
      next_lapses: "lapses",
      next_learning_step: "learning_step",
      next_due_at: null,
    },
    flashcard_cards: {
      next_interval_days: "interval_days",
      next_ease: "ease",
      next_lapses: "lapses",
      next_learning_step: "learning_step",
      next_due_at: null,
      source: null, // local-only field kept by the app
    },
  };
  // Upsert conflict target per table (flashcard_user_settings is keyed by user_id).
  const CONFLICT_FOR_TABLE = {
    flashcard_user_settings: "user_id",
  };
  const MERGE_ORDER = [
    "flashcard_decks",
    "flashcard_media",
    "flashcard_notes",
    "flashcard_cards",
    "flashcard_review_logs",
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

  function remoteTable(table) {
    return REMOTE_TABLE_FOR[table] || table;
  }

  // Whitelist a push payload against the confirmed schema. Never mutates the input.
  function sanitizePayload(table, payload) {
    const remote = remoteTable(table);
    const allowed = COLUMNS_FOR_TABLE[remote];
    if (!allowed || !payload || typeof payload !== "object") return { ...(payload || {}) };
    const map = FIELD_MAP_FOR_TABLE[remote];
    const out = {};
    for (const key of Object.keys(payload)) {
      let target = key;
      if (map && Object.prototype.hasOwnProperty.call(map, key)) {
        const mapped = map[key];
        if (mapped === null) continue; // drop explicitly
        target = mapped;
      }
      if (allowed.includes(target)) out[target] = payload[key];
    }
    return out;
  }

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

  function pushPayload(table, payload) {
    const remote = remoteTable(table);
    const clean = sanitizePayload(table, payload);
    // flashcard_user_settings is keyed by user_id and stores everything else in payload jsonb.
    if (remote === "flashcard_user_settings") {
      const settings = clean.payload && typeof clean.payload === "object" ? clean.payload : clean;
      return { user_id: clean.user_id || sessionUserId, payload: settings };
    }
    return clean;
  }

  async function upsertRemote(table, payload) {
    const remote = remoteTable(table);
    const onConflict = CONFLICT_FOR_TABLE[remote] || "id";
    return client().from(remote).upsert(payload, { onConflict });
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
        const remote = remoteTable(table);
        const payloadRaw = entry.payload || {};
        const rowId = entry.row_id;
        if (!table || !rowId) { doomed.push(entry.id); continue; }
        try {
          if (entry.op === "delete") {
            // All flashcards tables use soft deletes (deleted_at); hard delete is never pushed.
            // Push the soft-delete as an upsert instead of a DELETE.
            const merged = Object.keys(payloadRaw).length ? payloadRaw : { id: rowId, deleted_at: new Date().toISOString() };
            const soft = sanitizePayload(table, merged);
            const result = await upsertRemote(table, soft);
            if (result.error) throw result.error;
          } else if (entry.op === "upsert" || entry.op === "insert") {
            const payload = pushPayload(table, payloadRaw);
            const result = await upsertRemote(table, payload);
            if (result.error) throw result.error;
          } else {
            const payload = pushPayload(table, payloadRaw);
            const result = await upsertRemote(table, payload);
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
    const remote = remoteTable(table);
    const response = await client().from(remote).select("*");
    const data = Array.isArray(response.data) ? response.data : response.data ? [response.data] : [];
    return data.filter((row) => row && (row.id || row.user_id));
  }

  function stampOf(table, row) {
    if (!row) return "";
    const key = STAMP_FOR_TABLE[table] || STAMP_FOR_TABLE[remoteTable(table)] || "updated_at";
    if (remoteTable(table) === "flashcard_review_logs") {
      return String(row.reviewed_at || row.created_at || "");
    }
    return String(row.updated_at || row.reviewed_at || row.created_at || "");
  }

  async function mergeTable(table, rows, stats) {
    const db = localDb();
    const store = STORE_FOR_TABLE[table] || STORE_FOR_TABLE[remoteTable(table)];
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
      if (!remote) continue;
      const isSettings = store === "settings";
      const id = isSettings ? String(remote.user_id || "") : String(remote.id || "");
      if (!id) continue;
      const local = localById.get(id);

      // Never overwrite a row with unsynced local changes.
      if (pending.has(id) || (isSettings && pending.has("settings_" + id))) { stats.conflicts += 1; continue; }

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
          await db.raw.put("reviews", { ...remote, id: remote.id, user_id: sessionUserId });
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
      sanitizePayload, // exported for tests
      remoteTable, // exported for tests
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
  module.exports = { instance: globalThis.StudyZoneFlashcardsSync || null };
}
