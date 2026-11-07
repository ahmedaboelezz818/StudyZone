/*
 * Study Zone offline-first data layer.
 *
 * The existing app talks to Supabase through supabase-js. This module wraps
 * window.fetch *before* the Supabase client is created, so every REST read
 * can fall back to an IndexedDB cache and every REST write can be queued
 * with an idempotency key while the device is offline.
 *
 * Design goals:
 *  - never lose a local edit;
 *  - replay queued operations in order, exactly once;
 *  - keep each account's cache and queue isolated;
 *  - never replace newer server data silently;
 *  - surface conflicts so the user can choose the winning version.
 */
(() => {
  "use strict";

  const config = window.studyFlowSupabaseConfig || {};
  const supabaseOrigin = (() => {
    try {
      return new URL(config.url).origin;
    } catch {
      return "";
    }
  })();

  const DB_NAME = "studyzone-offline";
  const DB_VERSION = 1;
  const CACHE_STORE = "cache";
  const QUEUE_STORE = "queue";
  const CONFLICT_STORE = "conflicts";
  const META_STORE = "meta";
  const MAX_QUEUE = 1500;
  const MAX_CACHE = 2500;
  const SYNC_INTERVAL_MS = 30_000;
  const REQUEST_TIMEOUT_MS = 25_000;

  // Only user-owned, text-first tables can be replayed safely. Storage-backed
  // features (files, voice notes) and team collaboration stay online-only and
  // show an honest message instead of pretending the write succeeded.
  const OFFLINE_TABLES = new Set([
    "tasks",
    "notes",
    "subjects",
    "schedules",
    "goals",
    "exams",
    "exam_results",
    "task_routines",
    "task_routine_days",
    "study_journal_entries",
    "focus_distractions",
    "notifications",
    "profiles",
    "user_settings",
    "user_notification_preferences",
    "daily_reminder_preferences",
  ]);
  const OFFLINE_RPC = new RegExp(
    "^(start_focus_session|resume_focus_session|pause_focus_session|finish_focus_session|cancel_focus_session|increment_goal_progress)$",
  );

  const listeners = new Map();
  let dbPromise = null;
  let currentUserId = null;
  let syncing = false;
  let syncTimer = null;
  let lastSyncAt = 0;
  let lastError = "";

  const state = {
    online: navigator.onLine !== false,
    status: navigator.onLine === false ? "offline" : "synced",
    pending: 0,
    failed: 0,
    conflicts: 0,
    lastSyncAt: 0,
    lastError: "",
  };

  const uuid = () =>
    (crypto.randomUUID && crypto.randomUUID()) ||
    `op-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function emit(name, detail = {}) {
    const callbacks = listeners.get(name);
    if (callbacks) {
      for (const callback of [...callbacks]) {
        try {
          callback(detail);
        } catch (error) {
          console.error(`[StudyZoneOffline] listener ${name} failed`, error);
        }
      }
    }
    window.dispatchEvent(
      new CustomEvent(`studyzone:${name}`, { detail: { ...state, ...detail } }),
    );
  }

  function on(name, callback) {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(callback);
    return () => listeners.get(name)?.delete(callback);
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          const cache = db.createObjectStore(CACHE_STORE, { keyPath: "key" });
          cache.createIndex("userId", "userId");
          cache.createIndex("table", "table");
          cache.createIndex("updatedAt", "updatedAt");
        }
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          const queue = db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
          queue.createIndex("userId", "userId");
          queue.createIndex("status", "status");
          queue.createIndex("queuedAt", "queuedAt");
        }
        if (!db.objectStoreNames.contains(CONFLICT_STORE)) {
          const conflicts = db.createObjectStore(CONFLICT_STORE, {
            keyPath: "id",
          });
          conflicts.createIndex("userId", "userId");
          conflicts.createIndex("createdAt", "createdAt");
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }

  async function idb(store, mode, operation) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, mode);
      const objectStore = transaction.objectStore(store);
      let request;
      try {
        request = operation(objectStore);
      } catch (error) {
        reject(error);
        return;
      }
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      if (request && "onsuccess" in request && mode === "readwrite") {
        // transaction completion is the reliable signal
      }
    });
  }

  const getAll = (store, indexName, value) =>
    idb(store, "readonly", (objectStore) =>
      indexName
        ? objectStore.index(indexName).getAll(value)
        : objectStore.getAll(),
    );
  const getOne = (store, key) =>
    idb(store, "readonly", (objectStore) => objectStore.get(key));
  const putOne = (store, value) =>
    idb(store, "readwrite", (objectStore) => objectStore.put(value));
  const deleteOne = (store, key) =>
    idb(store, "readwrite", (objectStore) => objectStore.delete(key));

  function decodeJwt(token) {
    try {
      const payload = token.split(".")[1];
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(decodeURIComponent(escape(atob(normalized))));
    } catch {
      return null;
    }
  }

  function readStoredSession() {
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token"))
          continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const session = parsed?.session || parsed;
        if (session?.access_token) return session;
      }
    } catch (error) {
      console.warn("[StudyZoneOffline] could not read session", error);
    }
    return null;
  }

  function currentAccessToken() {
    return readStoredSession()?.access_token || "";
  }

  function userIdFromRequest(request) {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (token && token.split(".").length === 3) {
      const payload = decodeJwt(token);
      if (payload?.sub) return payload.sub;
    }
    return currentUserId || readStoredSession()?.user?.id || null;
  }

  function setUser(userId) {
    const next = userId || null;
    if (next === currentUserId) return Promise.resolve();
    currentUserId = next;
    return refreshCounts();
  }

  function cacheKey(userId, url) {
    return `${userId || "guest"}:${url}`;
  }

  function parseTable(url) {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/\/rest\/v1\/([^/?]+)/);
      return match ? decodeURIComponent(match[1]) : "";
    } catch {
      return "";
    }
  }

  function rpcName(url) {
    try {
      const match = new URL(url).pathname.match(/\/rest\/v1\/rpc\/([^/?]+)/);
      return match ? decodeURIComponent(match[1]) : "";
    } catch {
      return "";
    }
  }

  function canQueue(table, url) {
    if (rpcName(url)) return OFFLINE_RPC.test(rpcName(url));
    return OFFLINE_TABLES.has(table);
  }

  function offlineUnavailableResponse() {
    return jsonResponse(
      {
        message:
          "This action needs an internet connection. It was not saved. Try again when you are back online.",
        code: "OFFLINE_UNAVAILABLE",
        details: null,
        hint: null,
      },
      503,
    );
  }

  function parseMethodAndKind(request, url) {
    const method = request.method.toUpperCase();
    if (/\/rest\/v1\/rpc\//.test(new URL(url).pathname)) {
      return { method, kind: "rpc" };
    }
    if (method === "POST") {
      const prefer = request.headers.get("prefer") || "";
      return {
        method,
        kind: prefer.includes("resolution=merge-duplicates") ? "upsert" : "insert",
      };
    }
    if (method === "PATCH") return { method, kind: "update" };
    if (method === "DELETE") return { method, kind: "delete" };
    return { method, kind: "mutation" };
  }

  function idFromUrl(url) {
    try {
      const parsed = new URL(url);
      const id = parsed.searchParams.get("id");
      if (id?.startsWith("eq.")) return decodeURIComponent(id.slice(3));
    } catch {
      /* ignore */
    }
    return null;
  }

  function wantsSingleObject(request) {
    const accept = request.headers.get("accept") || "";
    return accept.includes("vnd.pgrst.object+json");
  }

  function wantsRepresentation(request) {
    const prefer = request.headers.get("prefer") || "";
    return prefer.includes("return=representation");
  }

  function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  function emptyResponse(status = 204) {
    return new Response(null, { status });
  }

  function normalizeRow(row, userId, { insert = false } = {}) {
    const now = new Date().toISOString();
    const next = { ...(row && typeof row === "object" ? row : {}) };
    if (insert) {
      if (!next.id) next.id = uuid();
      if (!next.created_at) next.created_at = now;
    }
    if (!next.updated_at) next.updated_at = now;
    if (userId && !next.user_id) next.user_id = userId;
    return next;
  }

  function parseBody(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function mergeRow(target, patch) {
    if (!target || typeof target !== "object") return { ...patch };
    const merged = { ...target, ...patch };
    if (!merged.updated_at) merged.updated_at = new Date().toISOString();
    return merged;
  }

  async function getCacheEntry(userId, url) {
    if (!userId) return null;
    const entry = await getOne(CACHE_STORE, cacheKey(userId, url));
    return entry || null;
  }

  async function getLatestTableEntry(userId, table) {
    if (!userId || !table) return null;
    const entries = (await getAll(CACHE_STORE, "userId", userId))
      .filter((entry) => entry.table === table)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return entries[0] || null;
  }

  async function putCache(userId, url, table, data) {
    if (!userId) return;
    const entry = {
      key: cacheKey(userId, url),
      userId,
      table,
      url,
      data,
      updatedAt: Date.now(),
    };
    await putOne(CACHE_STORE, entry);
    void pruneCache(userId);
  }

  async function pruneCache(userId) {
    const entries = await getAll(CACHE_STORE, "userId", userId);
    if (entries.length <= MAX_CACHE) return;
    entries
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .slice(0, entries.length - MAX_CACHE)
      .forEach((entry) => void deleteOne(CACHE_STORE, entry.key));
  }

  function dataRows(data) {
    if (Array.isArray(data)) return data;
    return data && typeof data === "object" ? [data] : [];
  }

  async function applyMutationToCache(userId, table, kind, url, body, serverData) {
    if (!userId || !table) return;
    const entries = (await getAll(CACHE_STORE, "userId", userId)).filter(
      (entry) => entry.table === table,
    );
    if (!entries.length) return;
    const payload = Array.isArray(body) ? body[0] : body;
    const targetId =
      (payload && (payload.id || payload.task_id)) || idFromUrl(url) || null;
    const serverRows = dataRows(serverData);
    const serverRow = serverRows[0] || null;
    for (const entry of entries) {
      const data = entry.data;
      if (Array.isArray(data)) {
        let rows = [...data];
        if (kind === "insert" || kind === "upsert") {
          const row = normalizeRow(serverRow || payload, userId, {
            insert: true,
          });
          const index = rows.findIndex(
            (item) => String(item.id) === String(row.id),
          );
          if (index >= 0) rows[index] = mergeRow(rows[index], row);
          else rows.unshift(row);
        } else if (kind === "update") {
          rows = rows.map((item) => {
            const matches =
              targetId &&
              (String(item.id) === String(targetId) ||
                String(item.task_id) === String(targetId));
            return matches ? mergeRow(item, serverRow || payload) : item;
          });
        } else if (kind === "delete") {
          rows = rows.filter(
            (item) => !targetId || String(item.id) !== String(targetId),
          );
        }
        entry.data = rows;
      } else if (data && typeof data === "object") {
        if (kind === "update") entry.data = mergeRow(data, serverRow || payload);
        else if (kind === "insert") entry.data = normalizeRow(serverRow || payload, userId, { insert: true });
      }
      entry.updatedAt = Date.now();
      await putOne(CACHE_STORE, entry);
    }
  }

  async function readResponseData(response) {
    try {
      const text = await response.clone().text();
      return parseBody(text);
    } catch {
      return null;
    }
  }

  async function cacheResponse(userId, url, table, response) {
    if (!response.ok || !userId || !table) return;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("json")) return;
    const data = await readResponseData(response);
    if (data === null) return;
    await putCache(userId, url, table, data);
  }

  function buildHeadersFromRequest(request, userId) {
    const headers = {};
    for (const name of [
      "content-type",
      "prefer",
      "accept",
      "apikey",
      "x-client-info",
    ]) {
      const value = request.headers.get(name);
      if (value) headers[name] = value;
    }
    const token = currentAccessToken();
    if (token) headers.authorization = `Bearer ${token}`;
    else if (request.headers.get("authorization"))
      headers.authorization = request.headers.get("authorization");
    headers["x-studyzone-user"] = userId || "";
    return headers;
  }

  async function enqueueOperation(request, url, userId, bodyText) {
    const { method, kind } = parseMethodAndKind(request, url);
    const table = parseTable(url);
    const body = parseBody(bodyText);
    const payload = Array.isArray(body) ? body[0] : body;
    const opId = uuid();

    // Client-generated IDs make inserts idempotent: replaying the same queue
    // entry can never create a second row.
    if ((kind === "insert" || kind === "upsert") && payload && typeof payload === "object") {
      if (!payload.id) payload.id = uuid();
      if (!payload.updated_at) payload.updated_at = new Date().toISOString();
    }

    let baseUpdatedAt = null;
    const targetId = (payload && payload.id) || idFromUrl(url);
    if (kind === "update" && targetId) {
      const cached = await getLatestTableEntry(userId, table);
      const row = dataRows(cached?.data).find(
        (item) => String(item.id) === String(targetId),
      );
      if (row?.updated_at) baseUpdatedAt = row.updated_at;
    }

    const entry = {
      id: opId,
      userId: userId || "",
      table,
      kind,
      method,
      url,
      body: body === null ? null : Array.isArray(body) ? [payload] : payload,
      headers: buildHeadersFromRequest(request, userId),
      queuedAt: Date.now(),
      baseUpdatedAt,
      attempts: 0,
      status: "pending",
      lastError: "",
    };
    await putOne(QUEUE_STORE, entry);
    await applyMutationToCache(
      userId,
      table,
      kind,
      url,
      entry.body,
      kind === "delete" ? null : entry.body,
    );
    await refreshCounts();
    emit("queued", { operation: entry });
    void scheduleSync(500);
    return entry;
  }

  function syntheticResponseFor(request, url, userId, bodyText, kind) {
    const table = parseTable(url);
    const body = parseBody(bodyText);
    const payload = Array.isArray(body) ? body[0] : body;
    const single = wantsSingleObject(request);
    const representation = wantsRepresentation(request) || single;
    if (kind === "rpc") {
      const name = rpcName(url);
      if (name === "start_focus_session" || name === "resume_focus_session") {
        return jsonResponse(
          {
            started_at: new Date().toISOString(),
            elapsed_seconds: 0,
            session_key: payload?.p_session_key || null,
          },
          200,
        );
      }
      return jsonResponse({ ok: true }, 200);
    }
    if (!representation) {
      if (kind === "delete") return emptyResponse(204);
      return emptyResponse(201);
    }
    if (kind === "insert" || kind === "upsert") {
      const row = normalizeRow(payload, userId, { insert: true });
      return jsonResponse(single ? row : [row], 201);
    }
    if (kind === "update") {
      const id = idFromUrl(url) || payload?.id;
      const row = normalizeRow(
        { ...(payload || {}), ...(id ? { id } : {}) },
        userId,
      );
      return jsonResponse(single ? row : [row], 200);
    }
    if (kind === "delete") return emptyResponse(204);
    return jsonResponse(null, 200);
  }

  async function fetchWithTimeout(input, init, timeout = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await nativeFetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function handleRestRequest(request) {
    const url = request.url;
    const userId = userIdFromRequest(request);
    const table = parseTable(url);
    const method = request.method.toUpperCase();
    const { kind } = parseMethodAndKind(request, url);
    const bodyText =
      method === "GET" || method === "HEAD" ? "" : await request.clone().text();

    if (method === "GET" || method === "HEAD") {
      if (state.online) {
        try {
          const response = await fetchWithTimeout(request);
          if (response.ok) await cacheResponse(userId, url, table, response);
          return response;
        } catch (error) {
          console.warn("[StudyZoneOffline] read failed, using cache", error);
        }
      }
      const cached =
        (await getCacheEntry(userId, url)) ||
        (await getLatestTableEntry(userId, table));
      if (cached) {
        const data = cached.data;
        const single = wantsSingleObject(request);
        if (single) {
          const row = Array.isArray(data) ? data[0] || null : data;
          if (row === null) return emptyResponse(406);
          return jsonResponse(row, 200);
        }
        return jsonResponse(Array.isArray(data) ? data : [data], 200);
      }
      // No cache yet: return a valid empty result so a first offline launch
      // never shows a network error for data that is simply not downloaded.
      if (wantsSingleObject(request)) return emptyResponse(406);
      return jsonResponse([], 200);
    }

    // Mutations and RPCs.
    if (state.online) {
      try {
        const response = await fetchWithTimeout(request);
        if (response.ok) {
          await cacheResponse(userId, url, table, response);
          await applyMutationToCache(
            userId,
            table,
            kind,
            url,
            parseBody(bodyText),
            await readResponseData(response),
          );
          return response;
        }
        if (response.status === 409) {
          // A previous replay already created this row.
          return response;
        }
        if (response.status >= 500) {
          if (!canQueue(table, url)) return offlineUnavailableResponse();
          await enqueueOperation(request, url, userId, bodyText);
          return syntheticResponseFor(request, url, userId, bodyText, kind);
        }
        return response;
      } catch (error) {
        console.warn("[StudyZoneOffline] write failed, queued", error);
        if (!canQueue(table, url)) return offlineUnavailableResponse();
        await enqueueOperation(request, url, userId, bodyText);
        return syntheticResponseFor(request, url, userId, bodyText, kind);
      }
    }

    if (!canQueue(table, url)) return offlineUnavailableResponse();
    await enqueueOperation(request, url, userId, bodyText);
    return syntheticResponseFor(request, url, userId, bodyText, kind);
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function studyZoneFetch(input, init) {
    let request;
    try {
      request = input instanceof Request ? input : new Request(input, init);
    } catch {
      return nativeFetch(input, init);
    }
    const url = request.url;
    if (
      !supabaseOrigin ||
      !url.startsWith(`${supabaseOrigin}/rest/v1/`) ||
      request.headers.get("x-studyzone-replay") === "1"
    ) {
      return nativeFetch(input, init);
    }
    return handleRestRequest(request).catch((error) => {
      console.error("[StudyZoneOffline] request handling failed", error);
      return nativeFetch(input, init);
    });
  };

  async function refreshCounts() {
    try {
      const userId = currentUserId;
      const [queue, conflicts] = await Promise.all([
        getAll(QUEUE_STORE, "userId", userId || ""),
        getAll(CONFLICT_STORE, "userId", userId || ""),
      ]);
      const pending = queue.filter(
        (entry) => entry.status === "pending" || entry.status === "syncing",
      ).length;
      const failed = queue.filter((entry) => entry.status === "failed").length;
      state.pending = pending;
      state.failed = failed;
      state.conflicts = conflicts.length;
      state.lastSyncAt = lastSyncAt;
      state.lastError = lastError;
      if (!state.online) state.status = "offline";
      else if (syncing) state.status = "syncing";
      else if (failed || conflicts.length) state.status = "failed";
      else if (pending) state.status = "pending";
      else state.status = "synced";
      emit("state", {});
    } catch (error) {
      console.warn("[StudyZoneOffline] count refresh failed", error);
    }
  }

  function scheduleSync(delay = 0) {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncTimer = null;
      void syncNow();
    }, delay);
  }

  async function recordConflict(entry, serverRow, reason) {
    const conflict = {
      id: uuid(),
      userId: entry.userId,
      queueId: entry.id,
      table: entry.table,
      url: entry.url,
      body: entry.body,
      serverRow: serverRow || null,
      reason: reason || "server-changed",
      createdAt: Date.now(),
      status: "open",
    };
    await putOne(CONFLICT_STORE, conflict);
    await putOne(QUEUE_STORE, {
      ...entry,
      status: "conflict",
      lastError: reason || "conflict",
    });
    emit("conflict", { conflict });
  }

  async function fetchServerUpdatedAt(entry) {
    try {
      const url = new URL(entry.url);
      url.searchParams.set("select", "id,updated_at");
      const response = await fetchWithTimeout(
        new Request(url.toString(), {
          method: "GET",
          headers: entry.headers,
        }),
      );
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) ? data[0] || null : data;
    } catch {
      return null;
    }
  }

  async function replayEntry(entry) {
    if (!state.online) throw new Error("offline");
    if (entry.kind === "update" && entry.baseUpdatedAt && !entry.force) {
      const server = await fetchServerUpdatedAt(entry);
      if (
        server?.updated_at &&
        new Date(server.updated_at).getTime() >
          new Date(entry.baseUpdatedAt).getTime() + 1000
      ) {
        await recordConflict(entry, server, "server-changed");
        return "conflict";
      }
    }
    const headers = {
      ...entry.headers,
      "x-studyzone-replay": "1",
      "x-idempotency-key": entry.id,
    };
    const token = currentAccessToken();
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await fetchWithTimeout(
      new Request(entry.url, {
        method: entry.method,
        headers,
        body:
          entry.method === "GET" || entry.method === "DELETE"
            ? undefined
            : JSON.stringify(entry.body),
      }),
    );
    if (response.ok || response.status === 409) {
      const data = await readResponseData(response);
      await applyMutationToCache(
        entry.userId,
        entry.table,
        entry.kind,
        entry.url,
        entry.body,
        data,
      );
      await deleteOne(QUEUE_STORE, entry.id);
      return "synced";
    }
    const text = await response.text().catch(() => "");
    let message = text;
    try {
      message = JSON.parse(text)?.message || text;
    } catch {
      /* keep text */
    }
    if (response.status === 404 && entry.kind === "delete") {
      await deleteOne(QUEUE_STORE, entry.id);
      return "synced";
    }
    if (response.status === 404 || response.status === 409) {
      const server = await fetchServerUpdatedAt(entry);
      await recordConflict(entry, server, message || "row-changed");
      return "conflict";
    }
    if (response.status === 401 || response.status === 403) {
      await putOne(QUEUE_STORE, {
        ...entry,
        status: "failed",
        lastError: message || `HTTP ${response.status}`,
        attempts: entry.attempts + 1,
      });
      return "failed";
    }
    const attempts = entry.attempts + 1;
    await putOne(QUEUE_STORE, {
      ...entry,
      status: attempts >= 8 ? "failed" : "pending",
      lastError: message || `HTTP ${response.status}`,
      attempts,
    });
    return "retry";
  }

  async function syncNow({ silent = false } = {}) {
    if (!state.online) {
      state.status = "offline";
      await refreshCounts();
      return { ok: false, reason: "offline" };
    }
    if (syncing) return { ok: false, reason: "busy" };
    const userId = currentUserId;
    if (!userId) {
      await refreshCounts();
      return { ok: false, reason: "signed-out" };
    }
    syncing = true;
    lastError = "";
    state.status = "syncing";
    emit("sync-start", {});
    try {
      const queue = (await getAll(QUEUE_STORE, "userId", userId))
        .filter((entry) => entry.status === "pending" || entry.status === "failed")
        .sort((a, b) => a.queuedAt - b.queuedAt);
      for (const entry of queue) {
        if (!state.online) break;
        await putOne(QUEUE_STORE, { ...entry, status: "syncing" });
        try {
          const result = await replayEntry(entry);
          if (result === "retry") break;
        } catch (error) {
          if (!state.online) break;
          lastError = error?.message || String(error);
          await putOne(QUEUE_STORE, {
            ...entry,
            status: "pending",
            attempts: entry.attempts + 1,
            lastError,
          });
          break;
        }
      }
      lastSyncAt = Date.now();
      state.lastSyncAt = lastSyncAt;
      // Prune old synced metadata (kept only briefly for diagnostics).
      const all = await getAll(QUEUE_STORE, "userId", userId);
      for (const entry of all) {
        if (entry.status === "synced" && Date.now() - entry.queuedAt > 86400000)
          await deleteOne(QUEUE_STORE, entry.id);
      }
      if (!silent) emit("sync-complete", { at: lastSyncAt });
      return { ok: true, at: lastSyncAt };
    } finally {
      syncing = false;
      await refreshCounts();
    }
  }

  async function getCachedTableData(userId, table) {
    if (!userId || !table) return null;
    const entries = await getAll(CACHE_STORE, "userId", userId);
    const rows = [];
    for (const entry of entries) {
      if (entry.table !== table) continue;
      const data = entry.data;
      if (Array.isArray(data)) rows.push(...data);
      else if (data) rows.push(data);
    }
    return rows.length ? rows : null;
  }

  async function getQueue() {
    return (await getAll(QUEUE_STORE, "userId", currentUserId || "")).sort(
      (a, b) => a.queuedAt - b.queuedAt,
    );
  }

  async function getConflicts() {
    return (await getAll(CONFLICT_STORE, "userId", currentUserId || "")).sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  }

  async function resolveConflict(conflictId, choice) {
    const conflict = await getOne(CONFLICT_STORE, conflictId);
    if (!conflict) return;
    const entry = await getOne(QUEUE_STORE, conflict.queueId);
    if (choice === "server") {
      if (entry) await deleteOne(QUEUE_STORE, entry.id);
      if (conflict.serverRow) {
        await applyMutationToCache(
          conflict.userId,
          conflict.table,
          "update",
          conflict.url,
          conflict.serverRow,
          conflict.serverRow,
        );
      }
    } else if (choice === "local" && entry) {
      await putOne(QUEUE_STORE, {
        ...entry,
        status: "pending",
        force: true,
        baseUpdatedAt: null,
        attempts: 0,
      });
    }
    await deleteOne(CONFLICT_STORE, conflictId);
    await refreshCounts();
    emit("conflict-resolved", { conflictId, choice });
    if (choice === "local") void scheduleSync(200);
  }

  async function clearUser(userId) {
    const id = userId || currentUserId;
    if (!id) return;
    const [cache, queue, conflicts] = await Promise.all([
      getAll(CACHE_STORE, "userId", id),
      getAll(QUEUE_STORE, "userId", id),
      getAll(CONFLICT_STORE, "userId", id),
    ]);
    await Promise.all([
      ...cache.map((entry) => deleteOne(CACHE_STORE, entry.key)),
      ...queue.map((entry) => deleteOne(QUEUE_STORE, entry.id)),
      ...conflicts.map((entry) => deleteOne(CONFLICT_STORE, entry.id)),
    ]);
    if (currentUserId === id) currentUserId = null;
    await refreshCounts();
    emit("user-cleared", { userId: id });
  }

  async function queueFocusRecord(record) {
    if (!currentUserId || !record) return null;
    const url = `${supabaseOrigin}/rest/v1/rpc/${
      record.completed ? "finish_focus_session" : "cancel_focus_session"
    }`;
    const entry = {
      id: uuid(),
      userId: currentUserId,
      table: "study_sessions",
      kind: "rpc",
      method: "POST",
      url,
      body: { p_session_key: record.idempotency_key },
      headers: {
        "content-type": "application/json",
        apikey: config.anonKey || "",
        authorization: `Bearer ${currentAccessToken()}`,
      },
      queuedAt: Date.now(),
      attempts: 0,
      status: "pending",
      lastError: "",
    };
    await putOne(QUEUE_STORE, entry);
    await refreshCounts();
    void scheduleSync(500);
    return entry;
  }

  function updateOnlineState() {
    state.online = navigator.onLine !== false;
    if (!state.online) {
      state.status = "offline";
      emit("offline", {});
      void refreshCounts();
      return;
    }
    emit("online", {});
    void refreshCounts();
    void scheduleSync(300);
  }

  window.addEventListener("online", updateOnlineState);
  window.addEventListener("offline", updateOnlineState);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.online) {
      void refreshCounts();
      if (Date.now() - lastSyncAt > 15000) void scheduleSync(500);
    }
  });

  syncTimer = setInterval(() => {
    if (state.online && currentUserId) void syncNow({ silent: true });
  }, SYNC_INTERVAL_MS);

  const api = {
    get state() {
      return { ...state };
    },
    on,
    setUser,
    clearUser,
    syncNow,
    getQueue,
    getConflicts,
    resolveConflict,
    getCachedTableData,
    queueFocusRecord,
    isOnline: () => state.online,
    refreshCounts,
    db: openDb,
  };

  window.StudyZoneOffline = api;
  window.StudyZoneSync = api;

  // Restore the last signed-in account so the offline cache is usable before
  // Supabase finishes restoring the session.
  const stored = readStoredSession();
  if (stored?.user?.id) currentUserId = stored.user.id;
  void refreshCounts();
  if (state.online) void scheduleSync(1500);
})();
