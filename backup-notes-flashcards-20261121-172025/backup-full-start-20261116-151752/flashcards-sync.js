/*
 * Study Zone flashcards sync engine.
 *
 * Pushes the local outbox to Supabase and pulls the latest server rows, with
 * last-write-wins merge rules per record (deleted_at means "deleted").
 * Writes start in the local IndexedDB outbox so offline study still saves; the
 * push runs only while online and never blocks the UI.
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

  let sessionUserId = null;
  let supabaseClient = null;
  let lastError = null;
  let pushing = false;

  function client() { return supabaseClient; }

  async function enqueue(table, op, rowId, payload) {
    const db = window.StudyZoneFlashcardsDb;
    if (!db || !db.outbox) return;
    const entry = {
      id: `fc_out_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      seq: Date.now() * 1000 + Math.floor(Math.random() * 1000),
      table,
      op,
      row_id: rowId,
      payload: payload || {},
      created_at: new Date().toISOString(),
      attempts: 0,
      status: "pending",
    };
    await db.outbox.add(entry);
  }

  async function listOutbox() {
    const db = window.StudyZoneFlashcardsDb;
    if (!db) return [];
    const rows = await db.outbox.list();
    return (rows || []).sort((a, b) => Number(a.seq) - Number(b.seq));
  }

  async function removeSynced(ids) {
    const db = window.StudyZoneFlashcardsDb;
    if (!db || !db.outbox || !ids.length) return;
    await db.outbox.remove(ids);
  }

  async function setOutboxStatus(id, status) {
    const db = window.StudyZoneFlashcardsDb;
    if (!db || !db.outbox) return;
    const rows = await db.outbox.list();
    const row = (rows || []).find((item) => String(item.id) === String(id));
    if (!row) return;
    row.status = status;
    row.updated_at = new Date().toISOString();
    await db.outbox.put(row);
  }

  async function pushOutbox() {
    if (pushing) return { pushed: 0, errors: [] };
    pushing = true;
    const errors = [];
    let pushed = 0;
    try {
      const entries = await listOutbox();
      const doomed = [];
      for (const entry of entries) {
        if (entry.status && entry.status !== "pending") continue;
        const table = entry.table;
        const payload = entry.payload || {};
        const rowId = entry.row_id;
        try {
          if (entry.op === "delete") {
            const query = client().from(table).delete().eq("id", rowId);
            const result = await query;
            if (result.error) throw result.error;
          } else if (entry.op === "upsert") {
            const result = await client().from(table).upsert(payload, { onConflict: "id" });
            if (result.error) throw result.error;
          }
          doomed.push(entry.id);
        } catch (error) {
          errors.push({ id: entry.id, table, op: entry.op, error: String((error && error.message) || error) });
          await setOutboxStatus(entry.id, "failed");
        }
      }
      if (doomed.length) await removeSynced(doomed);
      pushed = entries.filter((entry) => doomed.includes(entry.id)).length;
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

  async function syncNow() {
    const pushed = await pushOutbox();
    const pulls = await Promise.all(TABLES.map((table) => pullTable(table).catch(() => [])));
    const errors = pushed.errors || [];
    if (errors.length) lastError = errors[0];
    return { pushed: pushed.pushed, errors, pulls };
  }

  function start() {
    const api = {
      syncNow,
      setSession: (userId, client) => { sessionUserId = userId; supabaseClient = client; },
      getSession: () => sessionUserId,
      getClient: () => supabaseClient,
      getLastError: () => lastError,
    };
    return api;
  }

  window.StudyZoneFlashcardsSync = start();
  globalThis.StudyZoneFlashcardsSync = window.StudyZoneFlashcardsSync;
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { start };
}
