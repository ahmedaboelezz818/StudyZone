/*
 * Second Brain flashcards UI module — complete redesign.
 *
 * Owns the "Flashcards" section: dashboard, deck manager, card browser,
 * editor, review (SM-2), statistics, import/export and settings. Runs fully
 * offline against IndexedDB; mirrors to Supabase through the outbox-backed
 * sync engine (window.StudyZoneFlashcardsSync) when signed in.
 *
 * Design: matches the Second Brain shell (design tokens, themes, motion levels),
 * logical CSS properties for RTL/LTR, localized strings (Arabic/English),
 * keyboard + touch support, and theme-aware colors (never hard-coded greens).
 */

(() => {
  "use strict";

  const core = window.StudyZoneFlashcardsCore;
  const MS_PER_DAY = 86400000;

  const VIEW = {
    DASHBOARD: "dashboard",
    DECKS: "decks",
    BROWSE: "browse",
    EDITOR: "editor",
    REVIEW: "review",
    STATS: "stats",
    IMPORT: "import",
    SETTINGS: "settings",
  };

  const RATING_LABEL = {
    again: ["Again", "مرة أخرى"],
    hard: ["Hard", "صعب"],
    good: ["Good", "جيد"],
    easy: ["Easy", "سهل"],
  };
  const STATE_LABEL = {
    new: ["New", "جديد"],
    learning: ["Learning", "قيد التعلم"],
    relearning: ["Relearning", "إعادة تعلم"],
    review: ["Review", "للمراجعة"],
    mastered: ["Mastered", "متقنة"],
  };
  const DIFFICULTY_LABEL = {
    easy: ["Easy", "سهل"],
    medium: ["Medium", "متوسط"],
    hard: ["Hard", "صعب"],
  };
  // XP awarded locally per rating; the server ledger stays authoritative when online.
  const XP_BY_RATING = { again: 2, hard: 5, good: 10, easy: 15 };
  const DECK_COLORS = ["#8b5cf6", "#22d3ee", "#34d399", "#fbbf24", "#fb7185", "#60a5fa", "#f97316", "#a3e635"];
  const DECK_ICONS = ["🧠", "📚", "🔬", "🌍", "➗", "🧪", "💊", "💻", "🎨", "🗣️"];
  // Real speech synthesis (Web Speech API) powers the pronunciation / slow-play
  // buttons. When unavailable the buttons never render — no fake sounds.
  const ttsSupported = typeof window !== "undefined" && Boolean(window.speechSynthesis);

  let host = null;
  let evaluationInFlight = false;
  let ratingInFlight = false;
  let view = VIEW.DASHBOARD;
  let decks = null; // null = not loaded yet
  let cards = [];
  let reviews = [];
  let settings = Object.assign({}, core.DEFAULT_SETTINGS);
  const fcUi = { deckId: null, cardId: null };
  let userId = null;
  let dbApi = null;
  let sessionState = null;
  let hotkeyDisposers = [];
  let mounted = false;
  let lastRenderedView = VIEW.DASHBOARD;
  let swipeStart = null; // { x, y, pointerId } while a touch/pointer swipe is in progress
  let swipeGuardUntil = 0; // ignore the click that follows a swipe gesture
  let deckQuery = "";
  let deckSort = "name";
  let deckFilter = "all";
  let browseQuery = "";
  let browseDeckId = "";
  let browsePage = 0;
  let browseFilter = "all";
  let browseSort = "due";
  let browseView = "grid";
  let editorDraft = null;
  const flippedTiles = new Set();
  let modal = null; // { kind, ...payload } — rendered by modalsHtml()
  let importPreview = null; // { rows, duplicates, invalid, fileName }
  let importTargetDeck = "";
  let importNewDeckName = "";
  let importSkipDuplicates = true;
  let syncState = { online: true, signedIn: false, pending: 0, failed: 0, lastSyncAt: 0, conflicts: 0, syncing: false };
  let syncTimer = null;
  let syncInterval = null;
  try { const saved = localStorage.getItem("studyflow.flashcards-view"); if (saved === "grid" || saved === "list") browseView = saved; } catch (_) { /* ignore */ }
  // Pronunciation speed preference (settings → sound). Kept in localStorage so
  // it never touches the SRS settings row or the review log.
  let speechRate = 1;
  try {
    const storedRate = Number(localStorage.getItem("studyflow.flashcards-speech-rate"));
    if ([0.75, 1, 1.25].includes(storedRate)) speechRate = storedRate;
  } catch (_) { /* ignore */ }

  // Local XP ledger (offline-first). Server ledger (flashcard_xp_awards) wins when online.
  let xpLocal = { total: 0, byDay: {}, seen: [] };
  let xpState = { loading: false, loaded: false, totalXp: 0 };
  let xpFetchKey = "";

  // Form drafts preserved across the app shell's frequent re-renders, so the
  // user never loses typed content even if a background render recreates the DOM.
  const deckFormCache = { name: undefined, desc: undefined };
  const settingsFormCache = {};
  let importTextCache = "";

  // ------------------------------------------------------------------ host/bridge

  function hostCall(name, ...args) {
    if (!host) return undefined;
    const value = host[name];
    return typeof value === "function" ? value.apply(host, args || []) : value;
  }
  function t(en, ar) {
    const lang = hostCall("getLanguage");
    return lang === "ar" ? ar : en;
  }
  function isAr() { return hostCall("getLanguage") === "ar"; }
  function esc(value) {
    const fn = hostCall("escapeHtml");
    return typeof fn === "function" ? fn(value) : String(value == null ? "" : value);
  }
  function numFmt() {
    return new Intl.NumberFormat(isAr() ? "ar-EG" : "en");
  }
  function fmtInt(value) {
    const n = Math.round(Number(value) || 0);
    try { return numFmt().format(n); } catch (_) { return String(n); }
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    try { return new Intl.DateTimeFormat(isAr() ? "ar-EG" : "en", { dateStyle: "medium" }).format(new Date(iso)); }
    catch (_) { return String(iso).slice(0, 10); }
  }
  function fmtRelative(iso) {
    if (!iso) return t("Never", "أبدًا");
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return "—";
    const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
    if (mins < 1) return t("just now", "الآن");
    if (mins < 60) return `${mins} ${t("min ago", "د مضت")}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ${t("h ago", "س مضت")}`;
    const days = Math.floor(hours / 24);
    return `${days} ${t("d ago", "ي مضت")}`;
  }
  function localeNum(n) {
    try { return new Intl.NumberFormat(isAr() ? "ar-EG" : "en").format(Math.round(Number(n) || 0)); }
    catch (_) { return String(Math.round(Number(n) || 0)); }
  }
  function nowIso() { return new Date().toISOString(); }
  function dayKey(date) { return core.dayKey(date instanceof Date ? date : new Date(date)); }

  function motionAllowed(effectId) {
    const fn = hostCall("shouldAnimate");
    if (typeof fn !== "function") return false;
    try { return Boolean(fn(effectId)); } catch (_) { return false; }
  }
  function motionClass() {
    const stored = hostCall("getLocal", "studyflow.flashcards-motion");
    const pref = stored && ["off", "subtle", "full"].includes(stored) ? stored
      : (hostCall("getMotionPreference") || hostCall("getMotionLevel") || "subtle");
    if (pref === "off" || !motionAllowed("flashcards")) return "is-motion-off";
    if (pref === "full") return "is-motion-full";
    return "is-motion-subtle";
  }

  // Flip debounce: rapid taps on the study card must never restart the 3D
  // transition mid-flight (which shows jitter / doubles the animation).
  const FC_FLIP_LOCK_MS = 300;
  let lastStudyFlipAt = 0;

  // True card navigation: moves the session index and reveals the next/previous
  // card. Never touches review state (no SRS write, no XP) — only reveal flips
  // through the normal UI.
  function navigateCard(delta) {
    const state = sessionState;
    if (!state || !Array.isArray(state.queue) || !state.queue.length || state.done) return null;
    const nextIndex = Math.max(0, Math.min(state.queue.length - 1, state.index + delta));
    if (nextIndex === state.index) return null;
    stopFlashcardSpeech();
    state.navDirection = delta > 0 ? "next" : "prev";
    state.index = nextIndex;
    state.currentCard = state.queue[nextIndex] || null;
    state.revealed = false;
    state.peekIndex = null;
    const direction = state.navDirection;
    const html = render();
    state.navDirection = null;
    return html;
  }

  // Applies a reveal flip through the debounce lock and keeps session state in
  // sync with the rendered card element.
  function applyStudyFlip(tile) {
    const studyState = sessionState;
    const currentlyRevealed = Boolean(studyState && studyState.revealed) || tile.classList.contains("is-revealed");
    const next = !currentlyRevealed;
    const now = Date.now();
    if (now - lastStudyFlipAt < FC_FLIP_LOCK_MS) return false;
    lastStudyFlipAt = now;
    tile.classList.toggle("is-revealed", next);
    tile.setAttribute("aria-pressed", next ? "true" : "false");
    if (studyState) studyState.revealed = next;
    const stageCard = tile.closest("[data-fc-card]");
    if (stageCard) stageCard.classList.toggle("is-revealed", next);
    return true;
  }

  // Keyboard navigation respects reading direction: ArrowLeft/ArrowRight map to
  // previous/next in LTR, and mirror in RTL.
  function fcNavKeyDelta(key) {
    const rtl = isAr();
    if (key === "ArrowLeft") return rtl ? 1 : -1;
    if (key === "ArrowRight") return rtl ? -1 : 1;
    return 0;
  }

  function fcNavSwipeDelta(dx) {
    const rtl = isAr();
    const movingNext = rtl ? dx > 0 : dx < 0;
    return movingNext ? 1 : -1;
  }

  function flipKeyTarget(tile, onStudyCard) {
    if (onStudyCard) return applyStudyFlip(tile);
    const tileId = tile.getAttribute("data-card-id");
    const flipped = !tile.classList.contains("is-flipped");
    if (tileId) { if (flipped) flippedTiles.add(tileId); else flippedTiles.delete(tileId); }
    tile.setAttribute("aria-pressed", flipped ? "true" : "false");
    return flipped;
  }

  async function getDb() {
    if (!dbApi) dbApi = window.StudyZoneFlashcardsDb;
    return dbApi;
  }

  function syncApi() {
    return window.StudyZoneFlashcardsSync || null;
  }

  function enqueueSync(table, op, payload) {
    const sync = syncApi();
    if (!sync || typeof sync.enqueue !== "function") return;
    const row = payload || {};
    const id = row.id != null
      ? row.id
      : (row.user_id != null
          ? row.user_id
          : (row.payload && row.payload.id));
    if (!id) return;
    try { void sync.enqueue(table, op || "upsert", id, row); } catch (_) { /* offline enqueue best-effort */ }
    scheduleSync();
  }

  function scheduleSync() {
    if (syncTimer) window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => { void runSync(true); }, 2500);
  }

  async function runSync(background) {
    const sync = syncApi();
    if (!sync || typeof sync.syncNow !== "function") {
      syncState = { ...syncState, online: isBrowserOnline(), signedIn: Boolean(userId), pending: syncState.pending, syncing: false };
      return;
    }
    syncState.syncing = true;
    try {
      const summary = await sync.syncNow();
      syncState = {
        ...syncState,
        online: isBrowserOnline(),
        signedIn: Boolean(userId),
        syncing: false,
        pending: Math.max(0, (syncState.pending || 0) - (summary.pushed || 0)),
        lastSyncAt: summary.skipped ? syncState.lastSyncAt : Date.now(),
        conflicts: summary.conflicts || syncState.conflicts,
      };
      if (!background) {
        const applied = summary.applied || 0;
        const pushed = summary.pushed || 0;
        if (summary.skipped === "offline") showToast(t("You are offline. Changes stay on this device.", "أنت غير متصل. تبقى التغييرات على هذا الجهاز."));
        else if (summary.errors && summary.errors.length) showToast(t("Some changes could not sync yet.", "تعذرت مزامنة بعض التغييرات بعد."));
        else showToast(`${t("Synced", "تمت المزامنة")} · ${pushed + applied} ${t("changes", "تغييرات")}`);
      }
      if (background) await refreshAfterSync();
    } catch (_) {
      syncState = { ...syncState, syncing: false };
    }
  }

  async function refreshAfterSync() {
    try { await loadAll(); } catch (_) { /* ignore */ }
    try { await refreshSyncState(); } catch (_) { /* ignore */ }
    try { if (view) render(); } catch (_) { /* ignore */ }
  }

  async function refreshSyncState() {
    const sync = syncApi();
    if (!sync || typeof sync.getStatus !== "function") {
      syncState = { ...syncState, online: isBrowserOnline(), signedIn: Boolean(userId), syncing: false };
      return syncState;
    }
    try {
      const st = await sync.getStatus();
      syncState = {
        online: st.online !== false,
        signedIn: Boolean(st.signedIn),
        pending: st.pending || 0,
        failed: st.failed || 0,
        lastSyncAt: st.lastSyncAt || 0,
        conflicts: st.lastConflicts || 0,
        syncing: Boolean(st.syncing),
      };
    } catch (_) {
      syncState = { ...syncState, online: isBrowserOnline(), signedIn: Boolean(userId), syncing: false };
    }
    return syncState;
  }

  function isBrowserOnline() {
    try { return typeof navigator === "undefined" || navigator.onLine !== false; }
    catch (_) { return true; }
  }

  function showToast(message) {
    if (hostCall("showToast")) {
      try { hostCall("showToast", message); } catch (_) { /* noop */ }
    }
  }

  // ------------------------------------------------------------------ data loading

  async function loadAll() {
    try {
      const db = await getDb();
      const deckRows = db && db.decks ? await db.decks.list(userId) : [];
      const cardRows = db && db.cards ? await db.cards.list(userId, {}) : [];
      const reviewRows = db && db.reviews ? await db.reviews.list(userId) : [];
      const settingsRow = db && db.settings ? await db.settings.get(userId) : null;
      const xpRow = db && db.meta ? await db.meta.get("flashcards_xp") : null;
      decks = (deckRows || []).filter((deck) => deck && !deck.deleted_at);
      cards = (cardRows || []).filter((card) => card && !card.deleted_at);
      reviews = reviewRows || [];
      const stored = settingsRow ? (settingsRow.payload && typeof settingsRow.payload === "object" ? settingsRow.payload : settingsRow) : null;
      settings = Object.assign({}, core.normalizeSettings(stored), { reminder: stored && stored.reminder });
      if (xpRow && xpRow.value && typeof xpRow.value === "object") {
        xpLocal = {
          total: Math.max(0, Number(xpRow.value.total) || 0),
          byDay: xpRow.value.byDay && typeof xpRow.value.byDay === "object" ? xpRow.value.byDay : {},
          seen: Array.isArray(xpRow.value.seen) ? xpRow.value.seen.map(String) : [],
        };
        if (xpLocal.seen.length > 2000) xpLocal.seen = xpLocal.seen.slice(-1500);
      } else {
        xpLocal = { total: 0, byDay: {}, seen: [] };
      }
      return { decks, cards, reviews, settings };
    } catch (err) {
      console.error("Flashcards: failed to load local data", err);
      decks = decks || [];
      cards = cards || [];
      reviews = reviews || [];
      showToast(t("Could not open Flashcards data. Please reload.", "تعذر فتح بيانات البطاقات. أعد تحميل الصفحة."));
      return { decks, cards, reviews, settings, error: err };
    }
  }

  async function refreshData() {
    await loadAll();
    try { await refreshSyncState(); } catch (_) { /* ignore */ }
    return null;
  }

  async function awardLocalXp(reviewId, rating) {
    const key = String(reviewId || "");
    if (!key) return 0;
    if (xpLocal.seen.includes(key)) return 0; // never award twice for the same review
    const amount = XP_BY_RATING[rating] || 0;
    if (!amount) return 0;
    const day = dayKey(new Date());
    xpLocal.total += amount;
    xpLocal.byDay[day] = (Number(xpLocal.byDay[day]) || 0) + amount;
    xpLocal.seen.push(key);
    if (xpLocal.seen.length > 2000) xpLocal.seen = xpLocal.seen.slice(-1500);
    try {
      const db = await getDb();
      if (db && db.meta) await db.meta.put("flashcards_xp", xpLocal);
    } catch (err) {
      console.warn("Flashcards: could not persist XP ledger", err);
    }
    return amount;
  }

  async function loadFlashcardXpIfNeeded() {
    if (xpState.loading || xpState.loaded) return;
    const key = String(userId || "");
    if (!key) { xpState = { loading: false, loaded: true, totalXp: 0 }; return; }
    if (xpFetchKey === key && xpState.loaded) return;
    xpFetchKey = key;
    const sb = hostCall("getSupabase");
    if (!sb || typeof sb.from !== "function") { xpState = { loading: false, loaded: true, totalXp: xpLocal.total }; return; }
    xpState.loading = true;
    try {
      // Server ledger stays authoritative; local ledger covers offline reviews.
      const res = await sb.from("flashcard_xp_awards").select("amount").eq("user_id", userId);
      let total = 0;
      if (!res.error && Array.isArray(res.data)) {
        total = res.data.reduce((sum, row) => sum + (Number(row && row.amount) || 0), 0);
      }
      xpState = { loading: false, loaded: true, totalXp: Math.max(total, xpLocal.total) };
    } catch (_) {
      xpState = { loading: false, loaded: true, totalXp: xpLocal.total };
    }
    try { if (view === VIEW.DASHBOARD || view === VIEW.STATS) render(); } catch (_) { /* keep screen stable */ }
  }

  function getXpDisplay(stats) {
    const serverXp = xpState.loaded ? Math.max(0, Number(xpState.totalXp) || 0) : xpLocal.total;
    const totalXp = Math.max(serverXp, xpLocal.total);
    const level = Math.max(1, Math.floor(totalXp / 100) + 1);
    const today = dayKey(new Date());
    const dailyXp = Number(xpLocal.byDay[today]) || 0;
    const currentStreak = Number(stats && stats.streak) || 0;
    const bestStreak = computeLocalBestStreak(reviews);
    return { totalXp, level, currentStreak, bestStreak, dailyXp, loading: xpState.loading };
  }

  function computeLocalBestStreak(reviewRows) {
    const days = new Set();
    (reviewRows || []).forEach((r) => {
      const key = r && (r.local_day || (r.reviewed_at ? dayKey(r.reviewed_at) : ""));
      if (key) days.add(String(key));
    });
    if (!days.size) return 0;
    const sorted = Array.from(days).sort();
    let best = 1, run = 1;
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = new Date(`${sorted[i - 1]}T00:00:00`);
      const curr = new Date(`${sorted[i]}T00:00:00`);
      const diff = Math.round((curr - prev) / MS_PER_DAY);
      if (diff === 1) run += 1; else run = 1;
      if (run > best) best = run;
    }
    return best;
  }

  // ------------------------------------------------------------------ helpers

  function deckName(id) {
    const deck = (decks || []).find((item) => item && item.id === id);
    return deck ? esc(deck.name) : esc(String(id || ""));
  }
  function deckById(id) {
    return (decks || []).find((item) => item && item.id === id) || null;
  }
  function cardCount(deckId) {
    return (cards || []).filter((card) => card && card.deck_id === deckId && !card.deleted_at).length;
  }
  function deckStats(deckId) {
    const list = (cards || []).filter((card) => card && card.deck_id === deckId && !card.deleted_at);
    const now = Date.now();
    const fresh = list.filter((card) => core.cardState(card) === "new").length;
    const due = list.filter((card) => card.due_at && new Date(card.due_at).getTime() <= now).length;
    const mastered = list.filter((card) => core.cardState(card) === "review" && Number(card.interval_days) >= 21).length;
    const learning = list.filter((card) => ["learning", "relearning"].includes(core.cardState(card))).length;
    const lastReview = (reviews || [])
      .filter((review) => review && review.deck_id === deckId)
      .map((review) => review.reviewed_at)
      .filter(Boolean)
      .sort()
      .pop();
    return { total: list.length, fresh, due, mastered, learning, lastReview };
  }
  function stateBadge(card) {
    const state = core.cardState(card);
    const mastered = state === "review" && Number(card.interval_days) >= 21;
    const key = mastered ? "mastered" : state;
    const label = (STATE_LABEL[key] || STATE_LABEL.new)[isAr() ? 1 : 0];
    return `<span class="fc-badge fc-badge-${esc(key)}">${esc(label)}</span>`;
  }
  function difficultyLabelOf(card) {
    const d = String((card && card.difficulty) || "medium");
    return (DIFFICULTY_LABEL[d] || DIFFICULTY_LABEL.medium)[isAr() ? 1 : 0];
  }
  function dueLabel(card) {
    if (!card || !card.due_at) return "—";
    const due = new Date(card.due_at).getTime();
    if (!Number.isFinite(due)) return "—";
    if (due <= Date.now()) return t("Due now", "مستحق الآن");
    const days = Math.ceil((due - Date.now()) / MS_PER_DAY);
    if (days <= 1) return t("Tomorrow", "غدًا");
    return `${fmtInt(days)} ${t("days", "أيام")}`;
  }
  function norm(str) { return String(str || "").trim().toLowerCase().replace(/\s+/g, " "); }
  function matchesQuery(haystacks, query) {
    const q = norm(query);
    if (!q) return true;
    return haystacks.some((h) => norm(h).includes(q));
  }
  function matchesFilter(card, filter) {
    const state = core.cardState(card);
    if (filter === "all") return true;
    if (filter === "new") return state === "new";
    if (filter === "learning") return state === "learning" || state === "relearning";
    if (filter === "due") return new Date(card.due_at).getTime() <= Date.now();
    if (filter === "mastered") return state === "review" && Number(card.interval_days) >= 21;
    if (filter === "difficult") return Number(card.lapses || 0) >= 2 || Number(card.ease || 2.5) < 2.1;
    return true;
  }
  function sortCards(list, sort) {
    const arr = list.slice();
    if (sort === "name") arr.sort((a, b) => norm(a.front).localeCompare(norm(b.front), isAr() ? "ar" : "en"));
    else if (sort === "created") arr.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    else if (sort === "due") arr.sort((a, b) => String(a.due_at || "").localeCompare(String(b.due_at || "")));
    else if (sort === "difficulty") arr.sort((a, b) => String(a.difficulty || "medium").localeCompare(String(b.difficulty || "medium")));
    return arr;
  }
  function sortDecks(list, sort) {
    const arr = list.slice();
    if (sort === "name") arr.sort((a, b) => norm(a.name).localeCompare(norm(b.name), isAr() ? "ar" : "en"));
    else if (sort === "created") arr.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    else if (sort === "cards") arr.sort((a, b) => cardCount(b.id) - cardCount(a.id));
    else if (sort === "due") arr.sort((a, b) => deckStats(b.id).due - deckStats(a.id).due);
    return arr;
  }
  function greetingText() {
    const hour = new Date().getHours();
    const key = hour < 12 ? "morning" : hour < 18 ? "day" : "evening";
    const en = { morning: "Good morning", day: "Good afternoon", evening: "Good evening" }[key];
    const ar = { morning: "صباح الخير", day: "طاب يومك", evening: "مساء الخير" }[key];
    return isAr() ? ar : en;
  }
  // ------------------------------------------------------------------ shared UI bits

  function statCard(icon, label, value) {
    return `<div class="sz-card fc-stat-card">
      <div class="fc-stat-icon" aria-hidden="true">${esc(icon)}</div>
      <div class="fc-stat-value">${esc(String(value))}</div>
      <small>${esc(label)}</small>
    </div>`;
  }
  function heroRightHtml() {
    return `<div class="fc-hero-right"><button type="button" class="fc-home-btn" data-action="fc-go-dashboard" title="${esc(t("Flashcards home", "رئيسية البطاقات"))}" aria-label="${esc(t("Flashcards home", "رئيسية البطاقات"))}">⌂</button>${syncChipHtml()}</div>`;
  }

  function syncChipHtml() {
    const online = syncState.online;
    const pending = Number(syncState.pending) || 0;
    const syncing = Boolean(syncState.syncing);
    const icon = !syncState.signedIn ? "📍" : !online ? "◐" : syncing ? "⟳" : pending > 0 ? "⇅" : "●";
    const label = !syncState.signedIn
      ? t("Local only", "محلي فقط")
      : !online
        ? t("Offline · saved locally", "بدون اتصال · محفوظ محليًا")
        : syncing
          ? t("Syncing…", "جارٍ المزامنة…")
          : pending > 0
            ? `${fmtInt(pending)} ${t("pending", "معلقة")}`
            : t("Synced", "تمت المزامنة");
    const title = syncState.lastSyncAt
      ? `${t("Last sync", "آخر مزامنة")}: ${fmtRelative(new Date(syncState.lastSyncAt).toISOString())}${syncState.conflicts ? ` · ${fmtInt(syncState.conflicts)} ${t("conflicts kept local", "تعارضات احتُفظ بنسختك")}` : ""}`
      : t("Not synced yet", "لم تتم المزامنة بعد");
    return `<button type="button" class="fc-sync-chip ${online ? "is-online" : "is-offline"}" data-action="fc-sync-now" title="${esc(title)}">${icon}<span>${esc(label)}</span></button>`;
  }
  function emptyState(icon, message, actionHtml) {
    return `<div class="fc-empty-state"><div class="fc-empty-icon" aria-hidden="true">${esc(icon)}</div><p>${esc(message)}</p>${actionHtml || ""}</div>`;
  }

  // ------------------------------------------------------------------ dashboard

  function dashboardHtml() {
    const stats = core.buildStats({ reviews, cards, now: new Date(), settings, days: 30 });
    const xp = getXpDisplay(stats);
    void loadFlashcardXpIfNeeded();
    const today = stats.reviewsToday;
    const goal = Math.max(1, stats.goal || settings.daily_goal || 20);
    const progress = Math.min(100, Math.round((today / goal) * 100));
    const remaining = Math.max(0, goal - today);
    const dueCount = stats.dueCount;
    const newCount = stats.newAvailableCount;
    const masteredCount = stats.matureCards ? stats.matureCards.length : 0;
    const learningCount = (stats.learningCards || []).length;
    const reviewDue = dueCount;
    const recentDecks = (decks || []).slice().sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || ""))).slice(0, 4);
    const statCards = [
      { label: t("Total Decks", "إجمالي المجموعات"), value: fmtInt((decks || []).length), icon: "🗂️" },
      { label: t("Total Cards", "إجمالي البطاقات"), value: fmtInt((cards || []).length), icon: "🃏" },
      { label: t("New Cards", "بطاقات جديدة"), value: fmtInt(newCount), icon: "✨" },
      { label: t("Learning", "قيد التعلم"), value: fmtInt(learningCount), icon: "📖" },
      { label: t("Review Due", "مستحقة للمراجعة"), value: fmtInt(reviewDue), icon: "⏳" },
      { label: t("Mastered", "متقنة"), value: fmtInt(masteredCount), icon: "🏆" },
      { label: t("Daily Reviews", "مراجعات اليوم"), value: fmtInt(today), icon: "✅" },
      { label: t("Current Streak", "السلسلة الحالية"), value: fmtInt(xp.currentStreak), icon: "🔥" },
    ];
    const statsHtml = statCards.map((item) => statCard(item.icon, item.label, item.value)).join("");
    const deckCards = recentDecks.map((deck) => {
      const d = deckStats(deck.id);
      return `<article class="fc-deck-card fc-deck-card-mini" data-deck-id="${esc(deck.id)}">
        <span class="fc-deck-swatch" style="background:${esc(deck.color || "var(--accent)")}">${esc(deck.icon || "🧠")}</span>
        <div class="fc-deck-card-main">
          <strong dir="auto">${esc(deck.name)}</strong>
          <small>${fmtInt(d.total)} ${t("cards", "بطاقة")} · ${fmtInt(d.due)} ${t("due", "مستحقة")}</small>
          <div class="fc-progress fc-progress-sm"><div class="fc-progress-fill" style="width:${d.total ? Math.round(((d.total - d.fresh) / d.total) * 100) : 0}%"></div></div>
        </div>
        <div class="fc-mini-actions">
          <button type="button" class="button button-secondary button-small" data-action="fc-open-deck" data-deck-id="${esc(deck.id)}">${esc(t("Open", "فتح"))}</button>
          <button type="button" class="button button-quiet button-small" data-action="fc-edit-deck" data-deck-id="${esc(deck.id)}" title="${esc(t("Edit deck", "تعديل المجموعة"))}" aria-label="${esc(t("Edit deck", "تعديل المجموعة"))}">✏️</button>
          <button type="button" class="button button-quiet button-small fc-danger-quiet" data-action="fc-delete-deck" data-deck-id="${esc(deck.id)}" title="${esc(t("Delete deck", "حذف المجموعة"))}" aria-label="${esc(t("Delete deck", "حذف المجموعة"))}">🗑️</button>
        </div>
      </article>`;
    }).join("");
    const hourText = (() => {
      const hour = new Date().getHours();
      const key = hour < 5 ? "night" : hour < 12 ? "morning" : hour < 18 ? "day" : "evening";
      return isAr()
        ? { night: "استرح جيدًا وادرس غدًا.", morning: "البطاقات جاهزة عندما تكون مستعدًا.", day: "التركيز يتفوق على التكرار.", evening: "راجع يومك بنية هادئة." }[key]
        : { night: "Rest well and study tomorrow.", morning: "Your flashcards are ready when you are.", day: "Focus beats repetition.", evening: "Review the day with calm intent." }[key];
    })();
    return `<section class="fc-view ${motionClass()}" data-fc-view="dashboard">
      <header class="fc-hero">
        <div class="fc-hero-top">
          <div>
            <p class="fc-kicker">${esc(t("Spaced repetition", "التكرار المتباعد"))}</p>
            <h1>${esc(t("Flashcards", "البطاقات التعليمية"))}</h1>
            <p class="fc-hero-greeting">${esc(greetingText())}</p>
            <p class="fc-sub">${esc(t("Real spaced repetition — saved on this device, synced when you are online.", "تكرار متباعد حقيقي — محفوظ على هذا الجهاز، ومزامن عند توفر الإنترنت."))}</p>
            <p class="fc-hero-hour">${esc(hourText)}</p>
          </div>
          ${heroRightHtml()}
        </div>
        <div class="fc-hero-actions">
          <button type="button" class="button button-primary button-medium" data-action="fc-start-due">${esc(t("Start review", "ابدأ المراجعة"))}</button>
          <button type="button" class="button button-secondary button-medium" data-action="fc-add-card">${esc(t("Add card", "إضافة بطاقة"))}</button>
          <button type="button" class="button button-secondary button-medium" data-action="fc-new-deck">${esc(t("New deck", "مجموعة جديدة"))}</button>
          <button type="button" class="button button-quiet button-medium" data-action="fc-go-browse">${esc(t("Search", "بحث"))}</button>
          <button type="button" class="button button-quiet button-medium" data-action="fc-go-browse">${esc(t("Filters", "الفلاتر"))}</button>
          <button type="button" class="button button-quiet button-medium" data-action="fc-go-stats">${esc(t("Statistics", "الإحصائيات"))}</button>
        </div>
      </header>

      <div class="fc-grid fc-grid-stats">${statsHtml}</div>

      <div class="fc-today-row">
        <div class="sz-card fc-today">
          <div class="fc-today-head">
            <h2>${esc(t("Today's study load", "عبء دراستك اليوم"))}</h2>
            <span class="fc-today-count">${esc(fmtInt(today))}<small> / ${esc(fmtInt(goal))}</small></span>
          </div>
          <div class="fc-progress" role="progressbar" aria-valuenow="${esc(String(progress))}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(t("Daily goal progress", "التقدم في الهدف اليومي"))}"><div class="fc-progress-fill" style="width:${esc(String(progress))}%"></div></div>
          <p class="fc-today-meta">${esc(t("Completed", "أنجزت"))}: <strong>${esc(fmtInt(today))}</strong> · ${esc(t("Remaining", "المتبقي"))}: <strong>${esc(fmtInt(remaining))}</strong> · ${esc(t("Progress", "التقدم"))}: <strong>${esc(fmtInt(progress))}%</strong></p>
        </div>
        <div class="sz-card fc-xp-card">
          <div class="fc-xp-head">
            <span class="fc-xp-icon" aria-hidden="true">⭐</span>
            <div>
              <strong class="fc-xp-value">${esc(xpState.loading ? "…" : fmtInt(xp.totalXp))}</strong>
              <small>${esc(t("Flashcards XP", "نقاط البطاقات"))}</small>
            </div>
          </div>
          <div class="fc-xp-grid">
            <div><small>${esc(t("Level", "المستوى"))}</small><strong>${esc(fmtInt(xp.level))}</strong></div>
            <div><small>${esc(t("Today XP", "نقاط اليوم"))}</small><strong>+${esc(fmtInt(xp.dailyXp))}</strong></div>
            <div><small>${esc(t("Best streak", "أفضل سلسلة"))}</small><strong>${esc(fmtInt(xp.bestStreak))} ${esc(t("days", "أيام"))}</strong></div>
            <div><small>${esc(t("Achievements", "الإنجازات"))}</small><strong>${esc(fmtInt(unlockedAchievements(stats, xp).length))}/${esc(fmtInt(ACHIEVEMENTS.length))}</strong></div>
          </div>
        </div>
      </div>

      <section class="sz-card">
        <div class="fc-card-head"><h2>${esc(t("Recent decks", "أحدث المجموعات"))}</h2><button type="button" class="button button-quiet button-small" data-action="fc-open-decks">${esc(t("All decks", "كل المجموعات"))}</button></div>
        ${deckCards ? `<div class="fc-deck-list">${deckCards}</div>` : emptyState("🗂️", t("No decks yet. Create your first deck to start studying.", "لا توجد مجموعات بعد. أنشئ مجموعتك الأولى للبدء."), `<button type="button" class="button button-primary" data-action="fc-new-deck">${esc(t("Create deck", "إنشاء مجموعة"))}</button>`)}
      </section>
    </section>`;
  }

  function unlockedAchievements(stats, xp) {
    const out = [];
    ACHIEVEMENTS.forEach((a) => {
      try { if (a.test(stats, xp)) out.push(a); } catch (_) { /* ignore */ }
    });
    return out;
  }

  const ACHIEVEMENTS = [
    { id: "first", icon: "🌱", en: "First card", ar: "أول بطاقة", test: (s) => Number(s.reviewsTotal) >= 1 },
    { id: "ten", icon: "📗", en: "10 reviews", ar: "10 مراجعات", test: (s) => Number(s.reviewsTotal) >= 10 },
    { id: "fifty", icon: "📚", en: "50 reviews", ar: "50 مراجعة", test: (s) => Number(s.reviewsTotal) >= 50 },
    { id: "hundred", icon: "🎓", en: "100 reviews", ar: "100 مراجعة", test: (s) => Number(s.reviewsTotal) >= 100 },
    { id: "streak7", icon: "🔥", en: "7-day streak", ar: "سلسلة ٧ أيام", test: (s) => Number(s.streak) >= 7 },
    { id: "streak30", icon: "🏔️", en: "30-day streak", ar: "سلسلة ٣٠ يومًا", test: (s) => Number(s.streak) >= 30 },
    { id: "xp500", icon: "⭐", en: "500 XP", ar: "٥٠٠ نقطة XP", test: (_, xp) => Number(xp.totalXp) >= 500 },
    { id: "xp1500", icon: "💫", en: "1500 XP", ar: "١٥٠٠ نقطة XP", test: (_, xp) => Number(xp.totalXp) >= 1500 },
  ];
  // ------------------------------------------------------------------ decks

  function decksHtml() {
    const query = String(deckQuery || "").trim();
    let list = (decks || []).filter((deck) => deck && !deck.deleted_at);
    if (deckFilter !== "all") {
      list = list.filter((deck) => {
        const d = deckStats(deck.id);
        if (deckFilter === "due") return d.due > 0;
        if (deckFilter === "mastered") return d.mastered > 0;
        if (deckFilter === "new") return d.fresh > 0;
        if (deckFilter === "empty") return d.total === 0;
        return true;
      });
    }
    if (query) list = list.filter((deck) => matchesQuery([deck.name, deck.description, deck.id], query));
    list = sortDecks(list, deckSort);
    const cardsHtml = list.map((deck) => {
      const d = deckStats(deck.id);
      const pct = d.total ? Math.round(((d.total - d.fresh) / d.total) * 100) : 0;
      return `<article class="sz-card fc-deck-card" data-deck-id="${esc(deck.id)}">
        <span class="fc-deck-swatch" style="background:${esc(deck.color || "var(--accent)")}">${esc(deck.icon || "🧠")}</span>
        <div class="fc-deck-card-main">
          <div class="fc-deck-title">
            <strong dir="auto">${esc(deck.name)}</strong>
            ${deck.description ? `<small dir="auto" class="fc-deck-desc">${esc(deck.description)}</small>` : ""}
          </div>
          <small dir="auto">${fmtInt(d.total)} ${t("cards", "بطاقة")} · ${fmtInt(d.fresh)} ${t("new", "جديدة")} · ${fmtInt(d.due)} ${t("due", "مستحقة")}</small>
          <div class="fc-deck-meta"><span>${t("Created", "أُنشئت")}: ${esc(fmtDate(deck.created_at))}</span>${d.lastReview ? `<span>${t("Last review", "آخر مراجعة")}: ${esc(fmtRelative(d.lastReview))}</span>` : ""}</div>
          <div class="fc-progress fc-progress-sm"><div class="fc-progress-fill" style="width:${esc(String(pct))}%"></div></div>
        </div>
        <div class="fc-row-actions fc-deck-actions">
          <button type="button" class="button button-primary button-small" data-action="fc-start-deck" data-deck-id="${esc(deck.id)}">${esc(t("Study", "ادرس"))}</button>
          <button type="button" class="button button-secondary button-small" data-action="fc-open-deck" data-deck-id="${esc(deck.id)}">${esc(t("Open", "فتح"))}</button>
          <button type="button" class="button button-quiet button-small" data-action="fc-edit-deck" data-deck-id="${esc(deck.id)}">${esc(t("Edit", "تعديل"))}</button>
          <button type="button" class="button button-quiet button-small fc-danger-quiet" data-action="fc-delete-deck" data-deck-id="${esc(deck.id)}">${esc(t("Delete", "حذف"))}</button>
        </div>
      </article>`;
    }).join("");
    const filters = [
      ["all", t("All", "الكل")],
      ["due", t("Has due", "بها مستحقات")],
      ["new", t("Has new", "بها جديدة")],
      ["mastered", t("Mastered", "متقنة")],
      ["empty", t("Empty", "فارغة")],
    ];
    const filterHtml = filters.map(([key, label]) =>
      `<button type="button" class="fc-chip ${deckFilter === key ? "is-active" : ""}" data-action="fc-deck-filter" data-filter="${esc(key)}">${esc(label)}</button>`).join("");
    return `<section class="fc-view ${motionClass()}" data-fc-view="decks">
      <header class="fc-hero">
        <div class="fc-hero-top">
          <div>
            <p class="fc-kicker">${esc(t("Deck management", "إدارة المجموعات"))}</p>
            <h1>${esc(t("Your decks", "مجموعاتك"))}</h1>
            <p class="fc-sub">${esc(t("Organize your cards into colored groups, then study what is due.", "نظّم بطاقاتك في مجموعات ملونة، ثم ادرس ما يستحق المراجعة."))}</p>
          </div>
          ${heroRightHtml()}
        </div>
        <div class="fc-hero-actions">
          <input id="fc-deck-search" class="fc-input fc-search-input" placeholder="${esc(t("Search decks…", "ابحث في المجموعات…"))}" value="${esc(deckQuery)}" aria-label="${esc(t("Search decks", "البحث في المجموعات"))}" />
          <select id="fc-deck-sort" class="fc-input fc-select" aria-label="${esc(t("Sort decks", "ترتيب المجموعات"))}">
            <option value="name" ${deckSort === "name" ? "selected" : ""}>${esc(t("Sort: Name", "الترتيب: الاسم"))}</option>
            <option value="created" ${deckSort === "created" ? "selected" : ""}>${esc(t("Sort: Created", "الترتيب: تاريخ الإنشاء"))}</option>
            <option value="cards" ${deckSort === "cards" ? "selected" : ""}>${esc(t("Sort: Cards", "الترتيب: عدد البطاقات"))}</option>
            <option value="due" ${deckSort === "due" ? "selected" : ""}>${esc(t("Sort: Due", "الترتيب: الاستحقاق"))}</option>
          </select>
          <button type="button" class="button button-primary" data-action="fc-new-deck">${esc(t("New deck", "مجموعة جديدة"))}</button>
        </div>
        <div class="fc-chip-row">${filterHtml}</div>
      </header>
      ${cardsHtml ? `<div class="fc-deck-grid">${cardsHtml}</div>` : (deckFilter !== "all" || query ? `<p class="fc-empty">${esc(t("No decks match your search.", "لا توجد مجموعات تطابق بحثك."))}</p>` : emptyState("🗂️", t("No decks yet. Create your first deck to start studying.", "لا توجد مجموعات بعد. أنشئ مجموعتك الأولى للبدء."), `<button type="button" class="button button-primary" data-action="fc-new-deck">${esc(t("Create deck", "إنشاء مجموعة"))}</button>`))}
    </section>`;
  }

  // ------------------------------------------------------------------ browse

  function browseHtml() {
    const selectedDeck = browseDeckId || fcUi.deckId || "";
    const deck = selectedDeck ? deckById(selectedDeck) : null;
    const query = String(browseQuery || "").trim();
    let list = (cards || []).filter((card) => card && !card.deleted_at);
    if (selectedDeck) list = list.filter((card) => card.deck_id === selectedDeck);
    if (query) list = list.filter((card) => matchesQuery([card.front, card.back, (card.tags || []).join(" "), card.example, card.notes], query));
    list = list.filter((card) => matchesFilter(card, browseFilter));
    list = sortCards(list, browseSort);
    const pageSize = 12;
    const page = Math.max(0, Math.min(browsePage, Math.max(0, Math.ceil(list.length / pageSize) - 1)));
    const pageCards = list.slice(page * pageSize, (page + 1) * pageSize);
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    const filterDefs = [
      ["all", t("All", "الكل")],
      ["new", t("New", "جديدة")],
      ["learning", t("Learning", "قيد التعلم")],
      ["due", t("Due", "مستحقة")],
      ["mastered", t("Mastered", "متقنة")],
      ["difficult", t("Difficult", "صعبة")],
    ];
    const filterHtml = filterDefs.map(([key, label]) =>
      `<button type="button" class="fc-chip ${browseFilter === key ? "is-active" : ""}" data-action="fc-browse-filter" data-filter="${esc(key)}">${esc(label)}</button>`).join("");
    const deckOptions = `<option value="">${esc(t("All decks", "كل المجموعات"))}</option>` +
      (decks || []).filter((d) => d && !d.deleted_at).map((d) =>
        `<option value="${esc(d.id)}" ${d.id === selectedDeck ? "selected" : ""}>${esc(d.name)}</option>`).join("");
    const cardActions = (card) => `<div class="fc-row-actions">
        <button type="button" class="button button-primary button-small" data-action="fc-study-card" data-card-id="${esc(card.id)}">${esc(t("Study", "ادرس"))}</button>
        <button type="button" class="button button-secondary button-small" data-action="fc-edit-card" data-card-id="${esc(card.id)}">${esc(t("Edit", "تعديل"))}</button>
        <button type="button" class="button button-quiet button-small" data-action="fc-preview-card" data-card-id="${esc(card.id)}" title="${esc(t("Preview", "معاينة"))}">👁️</button>
        <button type="button" class="button button-quiet button-small" data-action="fc-move-card" data-card-id="${esc(card.id)}" title="${esc(t("Move to deck", "نقل إلى مجموعة"))}">➡️</button>
        <button type="button" class="button button-quiet button-small" data-action="fc-duplicate-card" data-card-id="${esc(card.id)}" title="${esc(t("Duplicate", "تكرار"))}">⧉</button>
        <button type="button" class="button button-quiet button-small fc-danger-quiet" data-action="fc-delete-card" data-card-id="${esc(card.id)}" title="${esc(t("Delete", "حذف"))}">🗑️</button>
      </div>`;
    const cardsHtml = pageCards.map((card) => browseView === "grid"
      ? (() => {
          const frontLen = String(card.front || "").length;
          const backLen = String(card.back || "").length;
          const longest = Math.max(frontLen, backLen);
          const lenClass = longest > 200 ? " is-xl-text" : longest > 80 ? " is-lg-text" : "";
          return `<article class="fc-tile${lenClass}${flippedTiles.has(card.id) ? " is-flipped" : ""}" data-card-id="${esc(card.id)}" tabindex="0" role="button" aria-pressed="${flippedTiles.has(card.id) ? "true" : "false"}" aria-label="${esc(t("Flip card — press Enter", "قلب البطاقة — اضغط Enter"))}">
          <span class="fc-sr-only">${esc(card.front)} — ${esc(card.back)}</span>
          <div class="fc-tile-inner">
            <div class="fc-tile-face fc-tile-front">
              <div class="fc-tile-top">
                <span class="fc-tile-num">${esc(t("Card", "بطاقة"))}</span>
                <span class="fc-flip-glyph" aria-hidden="true">↻</span>
              </div>
              <div class="fc-tile-body" dir="auto">${esc(card.front)}</div>
              <div class="fc-tile-hint">${esc(t("Tap to reveal", "اضغط للإظهار"))}</div>
              <div class="fc-tile-meta">${stateBadge(card)}<small class="fc-due-label">${esc(dueLabel(card))}</small></div>
            </div>
            <div class="fc-tile-face fc-tile-back" dir="auto">
              <div class="fc-tile-top"><span class="fc-tile-num">${esc(t("Answer", "الإجابة"))}</span></div>
              <div class="fc-tile-body" dir="auto">${esc(card.back)}</div>
              ${card.example ? `<div class="fc-tile-example" dir="auto">${esc(card.example)}</div>` : ""}
              <span class="fc-tile-flip-back">${esc(t("Flip back", "عودة للسؤال"))} <span aria-hidden="true">↺</span></span>
            </div>
          </div>
          <div class="fc-tile-actions">
            <button type="button" class="button button-quiet" data-action="fc-study-card" data-card-id="${esc(card.id)}" title="${esc(t("Study this card", "ادرس هذه البطاقة"))}" aria-label="${esc(t("Study this card", "ادرس هذه البطاقة"))}">▶</button>
            <button type="button" class="button button-quiet" data-action="fc-preview-card" data-card-id="${esc(card.id)}" title="${esc(t("Preview", "معاينة"))}" aria-label="${esc(t("Preview", "معاينة"))}">👁️</button>
            <button type="button" class="button button-quiet" data-action="fc-edit-card" data-card-id="${esc(card.id)}" title="${esc(t("Edit", "تعديل"))}" aria-label="${esc(t("Edit", "تعديل"))}">✏️</button>
            <button type="button" class="button button-quiet" data-action="fc-move-card" data-card-id="${esc(card.id)}" title="${esc(t("Move to deck", "نقل إلى مجموعة"))}" aria-label="${esc(t("Move to deck", "نقل إلى مجموعة"))}">➡️</button>
            <button type="button" class="button button-quiet" data-action="fc-duplicate-card" data-card-id="${esc(card.id)}" title="${esc(t("Duplicate", "تكرار"))}" aria-label="${esc(t("Duplicate", "تكرار"))}">⧉</button>
            <button type="button" class="button button-quiet fc-danger-quiet" data-action="fc-delete-card" data-card-id="${esc(card.id)}" title="${esc(t("Delete", "حذف"))}" aria-label="${esc(t("Delete", "حذف"))}">🗑️</button>
          </div>
        </article>`;
        })()
      : `<article class="sz-card fc-card-row" data-card-id="${esc(card.id)}">
          <div class="fc-card-row-main">
            <div class="fc-card-row-front"><strong dir="auto">${esc(card.front)}</strong> ${stateBadge(card)}</div>
            <div class="fc-card-row-back"><span dir="auto">${esc(String(card.back || "").slice(0, 120))}</span></div>
            <small>${esc(t("Next review", "المراجعة القادمة"))}: ${esc(dueLabel(card))} · ${esc(t("difficulty", "الصعوبة"))}: ${esc(difficultyLabelOf(card))}</small>
          </div>
          ${cardActions(card)}
        </article>`).join("");
    const pager = totalPages > 1 ? `<div class="fc-pager">
      <button type="button" class="button button-secondary button-small" data-action="fc-browse-prev" ${page <= 0 ? "disabled" : ""}>${esc(t("Previous", "السابق"))}</button>
      <span>${esc(fmtInt(page + 1))} / ${esc(fmtInt(totalPages))}</span>
      <button type="button" class="button button-secondary button-small" data-action="fc-browse-next" ${page >= totalPages - 1 ? "disabled" : ""}>${esc(t("Next", "التالي"))}</button>
    </div>` : "";
    return `<section class="fc-view ${motionClass()}" data-fc-view="browse">
      <header class="fc-hero">
        <div class="fc-hero-top">
          <div>
            <p class="fc-kicker">${esc(t("Card browser", "استعراض البطاقات"))}</p>
            <h1>${deck ? esc(deck.name) : esc(t("Browse cards", "استعراض البطاقات"))}</h1>
            ${deck ? `<p class="fc-sub" dir="auto">${esc(deck.description || "")} ${deck ? `· ${fmtInt(cardCount(deck.id))} ${t("cards", "بطاقة")}` : ""}</p>` : `<p class="fc-sub">${esc(t("Search across every front, back and tag.", "ابحث في نص السؤال والإجابة والوسوم."))}</p>`}
          </div>
          ${heroRightHtml()}
        </div>
        <div class="fc-hero-actions">
          <select id="fc-browse-deck" class="fc-input fc-select" aria-label="${esc(t("Deck", "المجموعة"))}">${deckOptions}</select>
          <input id="fc-browse-search" class="fc-input fc-search-input" placeholder="${esc(t("Search cards…", "ابحث في البطاقات…"))}" value="${esc(browseQuery)}" aria-label="${esc(t("Search cards", "البحث في البطاقات"))}" />
          <div class="fc-view-toggle" role="group" aria-label="${esc(t("View mode", "طريقة العرض"))}">
            <button type="button" class="fc-toggle-btn ${browseView === "grid" ? "is-active" : ""}" data-action="fc-browse-view" data-view="grid" title="${esc(t("Grid view", "عرض شبكي"))}">▦</button>
            <button type="button" class="fc-toggle-btn ${browseView === "list" ? "is-active" : ""}" data-action="fc-browse-view" data-view="list" title="${esc(t("List view", "عرض قائمة"))}">☰</button>
          </div>
          <select id="fc-browse-sort" class="fc-input fc-select" aria-label="${esc(t("Sort cards", "ترتيب البطاقات"))}">
            <option value="due" ${browseSort === "due" ? "selected" : ""}>${esc(t("Sort: Due", "الترتيب: الاستحقاق"))}</option>
            <option value="name" ${browseSort === "name" ? "selected" : ""}>${esc(t("Sort: Name", "الترتيب: الاسم"))}</option>
            <option value="created" ${browseSort === "created" ? "selected" : ""}>${esc(t("Sort: Created", "الترتيب: تاريخ الإنشاء"))}</option>
            <option value="difficulty" ${browseSort === "difficulty" ? "selected" : ""}>${esc(t("Sort: Difficulty", "الترتيب: الصعوبة"))}</option>
          </select>
          <button type="button" class="button button-primary" data-action="fc-add-card">${esc(t("Add card", "إضافة بطاقة"))}</button>
          <button type="button" class="button button-quiet" data-action="fc-import-open">${esc(t("Import / Export", "استيراد / تصدير"))}</button>
          ${deck ? `<button type="button" class="button button-secondary" data-action="fc-start-deck" data-deck-id="${esc(deck.id)}">${esc(t("Study deck", "ادرس المجموعة"))}</button>` : ""}
          ${deck ? `<button type="button" class="button button-quiet" data-action="fc-edit-deck" data-deck-id="${esc(deck.id)}">${esc(t("Edit deck", "تعديل المجموعة"))}</button>` : ""}
          ${deck ? `<button type="button" class="button button-quiet fc-danger-quiet" data-action="fc-delete-deck" data-deck-id="${esc(deck.id)}">${esc(t("Delete deck", "حذف المجموعة"))}</button>` : ""}
        </div>
        <div class="fc-chip-row">${filterHtml}</div>
      </header>
      ${cardsHtml ? `<div class="${browseView === "grid" ? "fc-card-grid" : "fc-card-list"}">${cardsHtml}</div>${pager}` : emptyState("🃏", query || browseFilter !== "all" ? t("No cards match your filters.", "لا توجد بطاقات تطابق الفلاتر.") : t("No cards in this deck yet.", "لا توجد بطاقات في هذه المجموعة بعد."), `<button type="button" class="button button-primary" data-action="fc-add-card">${esc(t("Add card", "إضافة بطاقة"))}</button>`)}
    </section>`;
  }
  // ------------------------------------------------------------------ review

  function reviewCardContent(card, side) {
    if (!card) return `<div class="fc-card-content fc-empty">${esc(t("No card loaded", "لا توجد بطاقة"))}</div>`;
    const content = side === "front" ? card.front : card.back;
    const parts = core.tokenizeCloze(String(content || ""));
    const rendered = parts.map((part) => part.type === "cloze"
      ? `<span class="fc-cloze" data-fc-cloze="${esc(part.value)}" data-fc-hint="${esc(part.hint || "")}">${esc(part.value)}</span>`
      : esc(part.value)).join("");
    // Small supporting line under the question: tags / card type when the user
    // actually added them. Never invented and never the answer itself.
    const tags = Array.isArray(card.tags) ? card.tags.filter(Boolean).slice(0, 3) : [];
    const typeLabel = card.type && card.type !== "basic" ? String(card.type) : "";
    const metaBits = [tags.join(" · "), typeLabel].filter(Boolean);
    const meta = side === "front" && metaBits.length
      ? `<div class="fc-card-meta" dir="auto">${esc(metaBits.join(" · "))}</div>`
      : "";
    const extra = side === "back" && card.example ? `<div class="fc-card-example" dir="auto">${esc(card.example)}</div>` : "";
    const audio = side === "front" && ttsSupported ? `<div class="fc-card-audio" dir="auto">
        <button type="button" class="fc-audio-button" data-action="fc-audio" data-card-id="${esc(card.id || "")}" data-audio-kind="word" aria-label="${esc(t("Play pronunciation", "تشغيل النطق"))}" title="${esc(t("Play pronunciation", "تشغيل النطق"))}"><span aria-hidden="true">🔊</span> ${esc(t("Listen", "استمع"))}</button>
        <button type="button" class="fc-audio-button" data-action="fc-audio" data-card-id="${esc(card.id || "")}" data-audio-kind="slow" aria-label="${esc(t("Play slowly", "تشغيل بطيء"))}" title="${esc(t("Play slowly", "تشغيل بطيء"))}"><span aria-hidden="true">🐢</span> ${esc(t("Slow", "بطيء"))}</button>
      </div>` : "";
    return `<div class="fc-card-content" dir="auto">${rendered}${meta}${audio}${extra}</div>`;
  }

  function stopFlashcardSpeech() {
    if (!ttsSupported || !window.speechSynthesis) return;
    try { window.speechSynthesis.cancel(); } catch (_) { /* ignore */ }
  }

  function speakFlashcardText(text, rate) {
    if (!ttsSupported || !window.speechSynthesis) return false;
    const spoken = String(text || "").trim();
    if (!spoken) return false;
    try {
      // Always stop the previous utterance so only one voice plays at a time.
      stopFlashcardSpeech();
      const utterance = new SpeechSynthesisUtterance(spoken);
      utterance.rate = Math.max(0.4, Math.min(1.5, Number(rate) || 1));
      utterance.lang = isAr() ? "ar-EG" : "en-US";
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (_) { return false; }
  }

  function fcAudioAction(button) {
    const cardId = String((button && button.getAttribute("data-card-id")) || "");
    const kind = String((button && button.getAttribute("data-audio-kind")) || "word");
    const card = (cards || []).find((item) => item && item.id === cardId) || (sessionState && sessionState.currentCard) || null;
    const text = String((card && card.front) || "").trim();
    if (!text) { showToast(t("Nothing to pronounce yet.", "لا يوجد نص للنطق بعد.")); return null; }
    const rate = kind === "slow" ? Math.min(0.85, speechRate * 0.6) : speechRate;
    const ok = speakFlashcardText(text, rate);
    if (!ok) showToast(t("Speech synthesis is not available on this device.", "توفير النطق غير متاح على هذا الجهاز."));
    return ok;
  }

  function reviewPeekHtml(state) {
    const deck = state && state.deckId ? deckById(state.deckId) : null;
    const queue = state ? state.queue : [];
    const total = queue.length;
    const peekIdx = Math.min(Math.max(0, Number(state.peekIndex) || 0), total - 1);
    const peekCard = queue[peekIdx] || null;
    const currentIndex = state ? state.index : 0;
    return `<section class="fc-view fc-review ${motionClass()}" data-fc-view="review">
      <div class="fc-review-top">
        <div class="fc-review-title"><span class="fc-review-deck" dir="auto">${deck ? esc(deck.name) : esc(t("All decks", "كل المجموعات"))}</span></div>
        <div class="fc-review-progress"><div class="fc-progress"><div class="fc-progress-fill" style="width:${esc(String(total ? Math.round((peekIdx / total) * 100) : 0))}%"></div></div><span class="fc-review-count">${esc(fmtInt(peekIdx + 1))} / ${esc(fmtInt(total))}</span></div>
        <button type="button" class="icon-button" data-action="fc-review-end" title="${esc(t("End session", "إنهاء الجلسة"))}" aria-label="${esc(t("End session", "إنهاء الجلسة"))}">✕</button>
      </div>
      <div class="fc-card-stage">
        <article class="fc-peek-card" dir="auto">
          <span class="fc-peek-chip">${esc(t("Peek", "معاينة"))}</span>
          <div class="fc-peek-question" dir="auto">${esc(peekCard ? peekCard.front : "")}</div>
          <div class="fc-peek-answer" dir="auto">${esc(peekCard ? peekCard.back : "")}</div>
        </article>
      </div>
      <div class="fc-peek-actions">
        <button type="button" class="button button-secondary" data-action="fc-peek-prev" ${peekIdx <= 0 ? "disabled" : ""}>${esc(t("Previous", "السابق"))}</button>
        <button type="button" class="button button-primary" data-action="fc-peek-back">${esc(t("Back to current card", "العودة إلى البطاقة الحالية"))}</button>
        <button type="button" class="button button-secondary" data-action="fc-peek-next" ${peekIdx >= total - 1 ? "disabled" : ""}>${esc(t("Next", "التالي"))}</button>
      </div>
    </section>`;
  }

  function reviewHtml() {
    const state = sessionState;
    if (state && state.done) return reviewSummaryHtml();
    if (state && state.peekIndex != null) return reviewPeekHtml(state);
    const current = state && state.currentCard ? state.currentCard : null;
    const revealed = Boolean(state && state.revealed);
    const deck = state && state.deckId ? deckById(state.deckId) : null;
    const estimates = current ? ["again", "hard", "good", "easy"].map((rating) => core.estimateButtonIntervals(current, rating, Date.now(), settings)) : [];
    const total = state ? state.total : 0;
    const index = state ? state.index : 0;
    const queueTotal = Array.isArray(state && state.queue) ? state.queue.length : Math.max(0, Number(state && state.total) || 0);
    const navBase = state && state.peekIndex != null ? Number(state.peekIndex) : (state ? state.index : 0);
    const atFirst = navBase <= 0;
    const atLast = navBase >= Math.max(0, queueTotal - 1);
    const cardActions = "";
    const progress = total ? Math.min(100, Math.round(((revealed ? index + 1 : index) / total) * 100)) : 0;
    const remaining = Math.max(0, total - index - (revealed ? 1 : 0));
    const frontHtml = reviewCardContent(current, "front");
    const backHtml = reviewCardContent(current, "back");
    const ratingButtons = revealed ? estimates.map((estimate) => {
      const label = RATING_LABEL[estimate.rating][isAr() ? 1 : 0];
      const minutes = Math.max(1, Math.round(estimate.rating === "again" ? (estimate.dueAt - Date.now()) / 60000 : 0));
      const intervalText = estimate.rating === "again"
        ? `${fmtInt(minutes)} ${t("min", "د")}`
        : `${fmtInt(Math.max(1, estimate.intervalDays))} ${t("day", "يوم")}`;
      return `<button type="button" class="fc-rate-button fc-rate-${esc(estimate.rating)}" data-action="fc-rate" data-rating="${esc(estimate.rating)}">
        <strong>${esc(label)}</strong>
        <small>${esc(intervalText)}</small>
      </button>`;
    }).join("") : "";
    const navDirection = state && state.navDirection;
    const stageClass = `fc-card-stage${navDirection ? ` fc-card-stage-nav-${navDirection}` : ""}`;
    const cardAnimClass = `fc-card-3d${revealed ? "" : " fc-card-3d-anim"}${navDirection ? ` fc-card-3d-nav-${navDirection}` : ""}`;
    const prevGlyph = isAr() ? "›" : "‹";
    const nextGlyph = isAr() ? "‹" : "›";
    const consumed = revealed ? index + 1 : index;
    const segments = Array.from({ length: Math.max(0, total || 0) }, (_, position) => `<span class="fc-progress-segment${position < consumed ? " is-done" : ""}${position === index ? " is-current" : ""}" data-fc-segment="${position}"></span>`).join("");
    const knowButtonHtml = revealed ? `<button type="button" class="fc-evaluate-button fc-evaluate-know" data-action="fc-evaluate" data-evaluation="good">
        <span class="fc-evaluate-mark" aria-hidden="true">↑</span>
        <strong>${esc(t("I know", "أعرف"))}</strong>
        <small>${esc(t("Got it", "فهمته"))}</small>
      </button>` : "";
    const dontKnowButtonHtml = revealed ? `<button type="button" class="fc-evaluate-button fc-evaluate-dont-know" data-action="fc-evaluate" data-evaluation="again">
        <span class="fc-evaluate-mark" aria-hidden="true">↓</span>
        <strong>${esc(t("I don't know", "لا أعرف"))}</strong>
        <small>${esc(t("Review again", "راجعها"))}</small>
      </button>` : "";
    return `<section class="fc-view fc-review ${motionClass()}" data-fc-view="review">
      <div class="fc-review-top">
        <button type="button" class="fc-card-arrow fc-card-arrow-top" data-action="fc-nav-back" ${atFirst ? "disabled" : ""} aria-label="${esc(t("Previous card", "البطاقة السابقة"))}" title="${esc(t("Previous card", "البطاقة السابقة"))}">‹</button>
        <div class="fc-review-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${esc(String(Math.max(0, total || 0)))}" aria-valuenow="${esc(String(Math.min(consumed, Math.max(0, total || 0))))}">
          <div class="fc-progress"><div class="fc-progress-segments">${segments}</div></div>
          <span class="fc-review-count">${esc(fmtInt(Math.min(index + 1, total)))} / ${esc(fmtInt(total))}</span>
        </div>
        <div class="fc-review-top-actions">
          <button type="button" class="icon-button" data-action="fc-open-settings" aria-label="${esc(t("Flashcards settings", "إعدادات البطاقات"))}" title="${esc(t("Flashcards settings", "إعدادات البطاقات"))}">⚙</button>
          <button type="button" class="icon-button" data-action="fc-review-end" title="${esc(t("End session", "إنهاء الجلسة"))}" aria-label="${esc(t("End session", "إنهاء الجلسة"))}">✕</button>
        </div>
      </div>
      <div class="${stageClass}" id="fc-card-stage">
        <button type="button" class="fc-card-arrow fc-card-arrow-prev" data-action="fc-nav-prev" ${atFirst ? "disabled" : ""} aria-label="${esc(t("Previous card", "البطاقة السابقة"))}" title="${esc(t("Previous card", "البطاقة السابقة"))}">${esc(prevGlyph)}</button>
        <div class="${cardAnimClass}">
          <div class="fc-card ${revealed ? "is-revealed" : ""}" data-fc-card role="button" tabindex="0" aria-label="${esc(t("Toggle answer", "إظهار/إخفاء الإجابة"))}">
            <div class="fc-card-face fc-card-face-front">${frontHtml}<span class="fc-tap-hint">${esc(t("Tap to reveal", "انقر للإجابة"))}</span></div>
            <div class="fc-card-face fc-card-face-back">${backHtml}</div>
          </div>
        </div>
        ${cardActions}
        <button type="button" class="fc-card-arrow fc-card-arrow-next" data-action="fc-nav-next" ${atLast ? "disabled" : ""} aria-label="${esc(t("Next card", "البطاقة التالية"))}" title="${esc(t("Next card", "البطاقة التالية"))}">${esc(nextGlyph)}</button>
      </div>
      <div class="fc-review-actions">
        ${revealed
          ? `<div class="fc-evaluation">${knowButtonHtml}${dontKnowButtonHtml}</div>`
          : `<button type="button" class="button button-primary button-large fc-reveal-cta" data-action="fc-reveal">${esc(t("Show answer", "إظهار الإجابة"))}</button>`}
        <div class="fc-review-meta">
          <span>${esc(t("Remaining", "المتبقي"))}: ${esc(fmtInt(remaining))}</span>
          <button type="button" class="button button-secondary button-small" data-action="fc-review-suspend">${esc(t("Suspend card", "تعليق البطاقة"))}</button>
          <button type="button" class="button button-quiet button-small" data-action="fc-review-end">${esc(t("Finish session", "إنهاء الجلسة"))}</button>
        </div>
      </div>
    </section>`;
  }

  function reviewSummaryHtml() {
    const state = sessionState || {};
    const answered = (state.answers || []).length;
    const correct = (state.answers || []).filter((a) => a.rating === "good" || a.rating === "easy").length;
    const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
    const elapsed = Math.max(0, Date.now() - (state.startedAt || Date.now()));
    const mins = Math.max(1, Math.round(elapsed / 60000));
    const xp = state.xpEarned || 0;
    const insights = [
      `${fmtInt(answered)} ${t("cards reviewed", "بطاقات تمت مراجعتها")}`,
      `${fmtInt(accuracy)}% ${t("accuracy", "دقة")}`,
      `+${fmtInt(xp)} XP`,
      `${fmtInt(mins)} ${t("min", "د")}`,
    ];
    return `<section class="fc-view fc-review-summary ${motionClass()}" data-fc-view="review">
      <div class="sz-card fc-summary-card">
        <div class="fc-summary-icon" aria-hidden="true">🎉</div>
        <h1>${esc(t("Session complete!", "اكتملت الجلسة!"))}</h1>
        <p class="fc-sub">${esc(t("Every review counts. Your memory curve thanks you.", "كل مراجعة تهمّ. منحنى ذاكرتك يشكرك."))}</p>
        <div class="fc-summary-stats">${insights.map((item) => `<span class="fc-summary-pill">${esc(item)}</span>`).join("")}</div>
        <div class="fc-hero-actions fc-summary-actions">
          <button type="button" class="button button-primary" data-action="fc-summary-done">${esc(t("Back to decks", "عودة إلى المجموعات"))}</button>
          <button type="button" class="button button-secondary" data-action="fc-start-due">${esc(t("Review more", "مراجعة المزيد"))}</button>
        </div>
      </div>
    </section>`;
  }

  // ------------------------------------------------------------------ stats

  function statsHtml() {
    const stats = core.buildStats({ reviews, cards, now: new Date(), settings, days: 30 });
    const xp = getXpDisplay(stats);
    void loadFlashcardXpIfNeeded();
    const unlocked = unlockedAchievements(stats, xp);
    const unlockedIds = new Set(unlocked.map((a) => a.id));
    const achievementsHtml = ACHIEVEMENTS.map((a) => `<div class="fc-achievement ${unlockedIds.has(a.id) ? "is-unlocked" : "is-locked"}" title="${esc(isAr() ? a.ar : a.en)}">
      <span class="fc-achievement-icon" aria-hidden="true">${esc(a.icon)}</span>
      <small>${esc(isAr() ? a.ar : a.en)}</small>
    </div>`).join("");
    const retentionTrend = stats.retentionTrend || [];
    const distribution = stats.distribution || { again: 0, hard: 0, good: 0, easy: 0 };
    const maxDist = Math.max(1, stats.totalReviews || 1);
    const forecastTotal = (stats.forecast && stats.forecast.total) || 0;
    return `<section class="fc-view ${motionClass()}" data-fc-view="stats">
      <header class="fc-hero">
        <div class="fc-hero-top">
          <div>
            <p class="fc-kicker">${esc(t("Statistics", "الإحصائيات"))}</p>
            <h1>${esc(t("Learning analytics", "تحليلات التعلم"))}</h1>
            <p class="fc-sub">${esc(t("Every number here comes from your real review history.", "كل رقم هنا مبني على سجلات مراجعتك الفعلية."))}</p>
          </div>
          ${heroRightHtml()}
        </div>
        <div class="fc-hero-actions">
          <button type="button" class="button button-primary" data-action="fc-start-due">${esc(t("Start review", "ابدأ المراجعة"))}</button>
        </div>
      </header>

      <div class="fc-grid fc-grid-stats">
        ${statCard("⭐", t("Flashcards XP", "نقاط البطاقات"), xpState.loading ? "…" : fmtInt(xp.totalXp))}
        ${statCard("🏅", t("Level", "المستوى"), fmtInt(xp.level))}
        ${statCard("🔥", t("Current streak", "السلسلة الحالية"), `${fmtInt(xp.currentStreak)} ${t("days", "أيام")}`)}
        ${statCard("🏔️", t("Best streak", "أفضل سلسلة"), `${fmtInt(xp.bestStreak)} ${t("days", "أيام")}`)}
        ${statCard("☀️", t("Today XP", "نقاط اليوم"), `+${fmtInt(xp.dailyXp)}`)}
        ${statCard("✅", t("Reviews today", "مراجعات اليوم"), fmtInt(stats.reviewsToday))}
      </div>

      <section class="sz-card">
        <div class="fc-card-head"><h2>${esc(t("Achievements", "الإنجازات"))}</h2><small>${fmtInt(unlocked.length)}/${fmtInt(ACHIEVEMENTS.length)}</small></div>
        <div class="fc-achievements">${achievementsHtml}</div>
      </section>

      <div class="fc-grid fc-grid-2">
        <div class="sz-card">
          <div class="fc-card-head"><h2>${esc(t("Retention trend (7 days)", "اتجاه الاحتفاظ (٧ أيام)"))}</h2></div>
          <div class="fc-chart">${retentionTrend.map((point) => `<div class="fc-chart-row"><span>${esc(point.key)}</span><div class="fc-chart-bar"><div class="fc-chart-fill" style="width:${esc(String(Math.round((point.retention || 0) * 100)))}%"></div></div><small>${esc(String(Math.round((point.retention || 0) * 100)))}%</small></div>`).join("")}</div>
        </div>
        <div class="sz-card">
          <div class="fc-card-head"><h2>${esc(t("Rating distribution", "توزيع التقييمات"))}</h2></div>
          <div class="fc-chart">
            ${["again", "hard", "good", "easy"].map((rating) => {
              const value = Number(distribution[rating]) || 0;
              const label = RATING_LABEL[rating][isAr() ? 1 : 0];
              return `<div class="fc-chart-row"><span>${esc(label)}</span><div class="fc-chart-bar"><div class="fc-chart-fill" style="width:${esc(String(Math.round((value / maxDist) * 100)))}%"></div></div><small>${esc(fmtInt(value))}</small></div>`;
            }).join("")}
          </div>
        </div>
        <div class="sz-card">
          <div class="fc-card-head"><h2>${esc(t("Upcoming forecast", "التوقعات القادمة"))}</h2></div>
          <p>${esc(fmtInt(forecastTotal))} ${esc(t("cards due in the next 30 days.", "بطاقة مستحقة خلال ٣٠ يومًا."))}</p>
        </div>
        <div class="sz-card">
          <div class="fc-card-head"><h2>${esc(t("Difficult cards", "أصعب البطاقات"))}</h2></div>
          <ul class="fc-list">${stats.difficultCards.map((entry) => `<li dir="auto">${esc(entry.card.front)} — ${esc(fmtInt(entry.card.lapses))} ${esc(t("lapses", "تعثرات"))}</li>`).join("") || `<li>${esc(t("No difficult cards yet.", "لا توجد بطاقات صعبة بعد."))}</li>`}</ul>
        </div>
      </div>
    </section>`;
  }

  // ------------------------------------------------------------------ settings

  function settingsFormHtml() {
    const sv = (id, fallback) => (settingsFormCache[id] !== undefined ? settingsFormCache[id] : fallback);
    const reminder = (settings && settings.reminder) || { enabled: false, time: "19:00", days: [1, 2, 3, 4, 5, 6, 0] };
    const cachedMotion = settingsFormCache["fc-setting-motion"];
    const intensity = cachedMotion || (motionClass() === "is-motion-off" ? "off" : motionClass() === "is-motion-full" ? "full" : "subtle");
    const reminderEnabled = settingsFormCache["fc-setting-reminder"] !== undefined ? Boolean(settingsFormCache["fc-setting-reminder"]) : Boolean(reminder.enabled);
    const reminderTime = settingsFormCache["fc-setting-reminder-time"] !== undefined ? String(settingsFormCache["fc-setting-reminder-time"]) : (reminder.time || "19:00");
    return `<div class="fc-grid fc-grid-2">
        <div class="sz-card fc-stack">
          <h2>${esc(t("Daily limits", "الحدود اليومية"))}</h2>
          <label class="fc-label" for="fc-setting-new">${esc(t("New cards per day", "بطاقات جديدة في اليوم"))}</label>
          <input id="fc-setting-new" class="fc-input" type="number" min="0" max="999" value="${esc(String(sv("fc-setting-new", settings.new_per_day || 0)))}" />
          <label class="fc-label" for="fc-setting-reviews">${esc(t("Reviews per day", "مراجعات في اليوم"))}</label>
          <input id="fc-setting-reviews" class="fc-input" type="number" min="0" max="9999" value="${esc(String(sv("fc-setting-reviews", settings.reviews_per_day || 0)))}" />
          <label class="fc-label" for="fc-setting-daily-goal">${esc(t("Daily goal", "الهدف اليومي"))}</label>
          <input id="fc-setting-daily-goal" class="fc-input" type="number" min="1" max="999" value="${esc(String(sv("fc-setting-daily-goal", settings.daily_goal || 20)))}" />
          <label class="fc-label" for="fc-setting-learning">${esc(t("Learning steps (minutes)", "خطوات التعلم (بالدقائق)"))}</label>
          <input id="fc-setting-learning" class="fc-input" value="${esc(sv("fc-setting-learning", (settings.learning_steps || [1, 10]).join(",")))}" dir="ltr" />
          <label class="fc-label" for="fc-setting-relearning">${esc(t("Relearning steps (minutes)", "خطوات إعادة التعلم (بالدقائق)"))}</label>
          <input id="fc-setting-relearning" class="fc-input" value="${esc(sv("fc-setting-relearning", (settings.relearning_steps || [10]).join(",")))}" dir="ltr" />
          <label class="fc-label" for="fc-setting-graduating">${esc(t("Graduating interval (days)", "فترة التخرج (أيام)"))}</label>
          <input id="fc-setting-graduating" class="fc-input" type="number" min="1" max="90" value="${esc(String(sv("fc-setting-graduating", settings.graduating_interval || 1)))}" />
          <label class="fc-label" for="fc-setting-easy-interval">${esc(t("Easy interval (days)", "فترة السهل (أيام)"))}</label>
          <input id="fc-setting-easy-interval" class="fc-input" type="number" min="1" max="90" value="${esc(String(sv("fc-setting-easy-interval", settings.easy_interval || 4)))}" />
          <label class="fc-label" for="fc-setting-retention">${esc(t("Desired retention", "الاحتفاظ المطلوب"))}</label>
          <input id="fc-setting-retention" class="fc-input" type="number" min="0.1" max="0.99" step="0.05" value="${esc(String(sv("fc-setting-retention", settings.desired_retention || 0.9)))}" />
        </div>
        <div class="sz-card fc-stack">
          <h2>${esc(t("Motion & reminders", "الحركة والتذكيرات"))}</h2>
          <label class="fc-label" for="fc-setting-motion">${esc(t("Animation intensity", "شدة التحريك"))}</label>
          <select id="fc-setting-motion" class="fc-input">
            <option value="off" ${intensity === "off" ? "selected" : ""}>${esc(t("Off", "إيقاف"))}</option>
            <option value="subtle" ${intensity === "subtle" ? "selected" : ""}>${esc(t("Subtle", "خفيف"))}</option>
            <option value="full" ${intensity === "full" ? "selected" : ""}>${esc(t("Full", "كامل"))}</option>
          </select>
          <label class="fc-label" for="fc-setting-speech-rate">${esc(t("Pronunciation speed", "سرعة النطق"))}</label>
          <select id="fc-setting-speech-rate" class="fc-input" ${ttsSupported ? "" : "disabled"}>
            <option value="0.75" ${speechRate === 0.75 ? "selected" : ""}>${esc(t("Slow", "بطيء"))} · 0.75×</option>
            <option value="1" ${speechRate === 1 ? "selected" : ""}>${esc(t("Normal", "عادي"))} · 1×</option>
            <option value="1.25" ${speechRate === 1.25 ? "selected" : ""}>${esc(t("Fast", "سريع"))} · 1.25×</option>
          </select>
          ${ttsSupported ? "" : `<p class="fc-hint">${esc(t("Speech is not available on this device.", "النطق غير متاح على هذا الجهاز."))}</p>`}
          <label class="fc-check"><input id="fc-setting-reminder" type="checkbox" ${reminderEnabled ? "checked" : ""} /> <span>${esc(t("Enable study reminder", "تفعيل تذكير الدراسة"))}</span></label>
          <label class="fc-label" for="fc-setting-reminder-time">${esc(t("Reminder time", "وقت التذكير"))}</label>
          <input id="fc-setting-reminder-time" class="fc-input" value="${esc(reminderTime)}" dir="ltr" />
        </div>
      </div>`;
  }

  function settingsHtml() {
    return `<section class="fc-view ${motionClass()}" data-fc-view="settings">
      <header class="fc-hero">
        <div class="fc-hero-top">
          <div>
            <p class="fc-kicker">${esc(t("Preferences", "التفضيلات"))}</p>
            <h1>${esc(t("Flashcards settings", "إعدادات البطاقات"))}</h1>
          </div>
          ${heroRightHtml()}
        </div>
      </header>
      ${settingsFormHtml()}
      <div class="fc-hero-actions"><button type="button" class="button button-primary" data-action="fc-save-settings">${esc(t("Save settings", "حفظ الإعدادات"))}</button></div>
    </section>`;
  }
  // ------------------------------------------------------------------ modals

  function modalShell(title, bodyHtml, footerHtml, wide) {
    const label = String(title || "").replace(/"/g, "&quot;");
    return `<div class="fc-modal-backdrop" data-fc-backdrop>
      <div class="fc-modal ${wide ? "fc-modal-wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(label)}">
        <div class="fc-modal-header"><h2>${esc(title)}</h2><button type="button" class="icon-button fc-modal-close" data-action="fc-modal-close" aria-label="${esc(t("Close", "إغلاق"))}">✕</button></div>
        <div class="fc-modal-body">${bodyHtml}</div>
        <div class="fc-modal-footer">${footerHtml}</div>
      </div>
    </div>`;
  }

  function deckFormHtml(deck) {
    const isEdit = Boolean(deck && deck.id);
    const nameValue = deckFormCache.name !== undefined ? deckFormCache.name : (deck && deck.name) || "";
    const descValue = deckFormCache.desc !== undefined ? deckFormCache.desc : (deck && deck.description) || "";
    const selectedColor = (deck && deck.color) || DECK_COLORS[0];
    const selectedIcon = (deck && deck.icon) || DECK_ICONS[0];
    const swatches = DECK_COLORS.map((color) =>
      `<button type="button" class="fc-swatch ${color === selectedColor ? "is-active" : ""}" style="background:${esc(color)}" data-action="fc-pick-color" data-color="${esc(color)}" aria-label="${esc(color)}"></button>`).join("");
    const icons = DECK_ICONS.map((icon) =>
      `<button type="button" class="fc-icon-pick ${icon === selectedIcon ? "is-active" : ""}" data-action="fc-pick-icon" data-icon="${esc(icon)}">${esc(icon)}</button>`).join("");
    const body = `
      <label class="fc-label" for="fc-deck-name">${esc(t("Deck name *", "اسم المجموعة *"))}</label>
      <input id="fc-deck-name" class="fc-input" value="${esc(nameValue)}" placeholder="${esc(t("e.g. Biology — Cells", "مثال: الأحياء — الخلية"))}" maxlength="120" autocomplete="off" />
      <label class="fc-label" for="fc-deck-desc">${esc(t("Description", "الوصف"))}</label>
      <textarea id="fc-deck-desc" class="fc-input" rows="2" maxlength="400" placeholder="${esc(t("Optional — what is this deck about?", "اختياري — ما موضوع هذه المجموعة؟"))}">${esc(descValue)}</textarea>
      <span class="fc-label">${esc(t("Color", "اللون"))}</span>
      <div class="fc-swatch-row" id="fc-deck-colors" data-selected-color="${esc(selectedColor)}">${swatches}</div>
      <span class="fc-label">${esc(t("Icon", "الأيقونة"))}</span>
      <div class="fc-icon-row" id="fc-deck-icons" data-selected-icon="${esc(selectedIcon)}">${icons}</div>`;
    const footer = `
      <button type="button" class="button button-secondary" data-action="fc-modal-close">${esc(t("Cancel", "إلغاء"))}</button>
      <button type="button" class="button button-primary" data-action="fc-save-deck" data-deck-id="${esc((deck && deck.id) || "")}">${esc(isEdit ? t("Save changes", "حفظ التغييرات") : t("Create deck", "إنشاء المجموعة"))}</button>`;
    return modalShell(isEdit ? t("Edit deck", "تعديل المجموعة") : t("New deck", "مجموعة جديدة"), body, footer);
  }

  function deleteDeckHtml(deck) {
    const d = deckStats(deck.id);
    const impact = [
      `${fmtInt(d.total)} ${t("cards will be deleted", "بطاقات ستُحذف")}`,
      `${fmtInt(d.fresh)} ${t("new", "جديدة")}`,
      `${fmtInt(d.due)} ${t("due", "مستحقة")}`,
    ];
    const body = `
      <p class="fc-danger-text">${esc(t("Delete this deck? This will also delete its cards. This cannot be undone.", "حذف هذه المجموعة؟ سيتم حذف بطاقاتها أيضًا. لا يمكن التراجع."))}</p>
      <div class="sz-card fc-danger-summary">
        <strong dir="auto">${esc(deck.name)}</strong>
        <ul class="fc-list">${impact.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
      </div>
      <p class="fc-today-meta">${esc(t("Deleting keeps a copy in the sync outbox until the server confirms, but your active cards will be removed from this device.", "الحذف تتم مزامنته مع الخادم، لكن البطاقات ستختفي من هذا الجهاز."))}</p>`;
    const footer = `
      <button type="button" class="button button-secondary" data-action="fc-modal-close">${esc(t("Keep deck", "إبقاء المجموعة"))}</button>
      <button type="button" class="button button-danger" data-action="fc-delete-deck-confirm" data-deck-id="${esc(deck.id)}">${esc(t("Delete deck & cards", "حذف المجموعة والبطاقات"))}</button>`;
    return modalShell(t("Delete deck?", "حذف المجموعة؟"), body, footer);
  }

  function cardFormHtml(cardId) {
    const card = cardId ? (cards || []).find((item) => item && item.id === cardId) : null;
    const draft = editorDraft && (!editorDraft.cardId || editorDraft.cardId === (cardId || "")) ? editorDraft : null;
    const deckId = (draft && draft.deck_id) || (card && card.deck_id) || fcUi.deckId || (decks && decks[0] && decks[0].id) || "";
    const value = (key, fallback) => (draft && draft[key] != null ? draft[key] : (card && card[key] != null ? card[key] : fallback));
    const front = value("front", "");
    const back = value("back", "");
    const example = value("example", "");
    const explanation = value("explanation", "");
    const image = value("image", "");
    const notes = value("notes", "");
    const source = value("source", "manual");
    const difficulty = value("difficulty", "medium");
    const type = value("type", "basic");
    const tags = Array.isArray(value("tags", [])) ? value("tags", []).join(", ") : String(value("tags", "") || "");
    const deckOptions = (decks || []).filter((d) => d && !d.deleted_at).map((d) =>
      `<option value="${esc(d.id)}" ${d.id === deckId ? "selected" : ""}>${esc(d.name)}</option>`).join("");
    const difficultyOptions = ["easy", "medium", "hard"].map((d) =>
      `<option value="${d}" ${difficulty === d ? "selected" : ""}>${esc(DIFFICULTY_LABEL[d][isAr() ? 1 : 0])}</option>`).join("");
    const body = `
      <div class="fc-editor-grid">
        <div class="fc-editor-fields">
          <div class="fc-editor-row">
            <div><label class="fc-label" for="fc-editor-deck">${esc(t("Deck", "المجموعة"))}</label>
              <select id="fc-editor-deck" class="fc-input">${deckOptions || `<option value="">${esc(t("No decks yet", "لا توجد مجموعات بعد"))}</option>`}</select></div>
            <div><label class="fc-label" for="fc-editor-difficulty">${esc(t("Difficulty", "الصعوبة"))}</label>
              <select id="fc-editor-difficulty" class="fc-input">${difficultyOptions}</select></div>
          </div>
          <label class="fc-label" for="fc-editor-front">${esc(t("Front / question *", "الوجه / السؤال *"))}</label>
          <textarea id="fc-editor-front" class="fc-input" rows="3" maxlength="4000" placeholder="${esc(t("The question, term or word…", "السؤال أو المصطلح أو الكلمة…"))}">${esc(front)}</textarea>
          <label class="fc-label" for="fc-editor-back">${esc(t("Back / answer *", "الظهر / الإجابة *"))}</label>
          <textarea id="fc-editor-back" class="fc-input" rows="3" maxlength="4000" placeholder="${esc(t("The answer, translation or explanation…", "الإجابة أو الترجمة أو الشرح…"))}">${esc(back)}</textarea>
          <div class="fc-editor-row">
            <div><label class="fc-label" for="fc-editor-example">${esc(t("Example", "مثال"))}</label>
              <textarea id="fc-editor-example" class="fc-input" rows="2" maxlength="1000" placeholder="${esc(t("Optional example sentence…", "جملة مثال اختيارية…"))}">${esc(example)}</textarea></div>
            <div><label class="fc-label" for="fc-editor-image">${esc(t("Image URL", "رابط صورة"))}</label>
              <input id="fc-editor-image" class="fc-input" value="${esc(image)}" placeholder="https://…" dir="ltr" inputmode="url" /></div>
          </div>
          <label class="fc-label" for="fc-editor-explanation">${esc(t("Explanation", "التفسير"))}</label>
          <textarea id="fc-editor-explanation" class="fc-input" rows="2" maxlength="2000" placeholder="${esc(t("Extra context for the answer…", "سياق إضافي للإجابة…"))}">${esc(explanation)}</textarea>
          <div class="fc-editor-row">
            <div><label class="fc-label" for="fc-editor-tags">${esc(t("Tags (comma separated)", "الوسوم (مفصولة بفواصل)"))}</label>
              <input id="fc-editor-tags" class="fc-input" value="${esc(tags)}" placeholder="biology, exam1" dir="auto" /></div>
            <div><label class="fc-label" for="fc-editor-source">${esc(t("Source", "المصدر"))}</label>
              <input id="fc-editor-source" class="fc-input" value="${esc(source)}" placeholder="${esc(t("manual / import / lecture…", "يدوي / استيراد / محاضرة…"))}" dir="auto" /></div>
          </div>
          <label class="fc-label" for="fc-editor-notes">${esc(t("Notes", "ملاحظات"))}</label>
          <textarea id="fc-editor-notes" class="fc-input" rows="2" maxlength="2000" placeholder="${esc(t("Private notes for you…", "ملاحظات خاصة بك…"))}">${esc(notes)}</textarea>
        </div>
        <aside class="fc-editor-preview" aria-hidden="true">
          <span class="fc-label">${esc(t("Live preview", "معاينة حية"))}</span>
          <div class="fc-preview-card">
            <div class="fc-preview-face fc-preview-front"><span dir="auto">${esc(front) || esc(t("Front (question)", "الوجه (السؤال)"))}</span></div>
            <div class="fc-preview-face fc-preview-back"><span dir="auto">${esc(back) || esc(t("Back (answer)", "الظهر (الإجابة)"))}</span></div>
          </div>
        </aside>
      </div>`;
    const footer = `
      <button type="button" class="button button-secondary" data-action="fc-modal-close">${esc(t("Cancel", "إلغاء"))}</button>
      <button type="button" class="button button-primary" data-action="fc-save-card" data-card-id="${esc(cardId || "")}">${esc(cardId ? t("Save changes", "حفظ التغييرات") : t("Add card", "إضافة البطاقة"))}</button>`;
    return modalShell(cardId ? t("Edit card", "تعديل البطاقة") : t("Add card", "إضافة بطاقة"), body, footer, true);
  }

  function cardDeleteHtml(card) {
    const body = `
      <p class="fc-danger-text">${esc(t("Delete this card? It will be removed from reviews.", "حذف هذه البطاقة؟ ستُزال من المراجعات."))}</p>
      <div class="sz-card fc-danger-summary"><strong dir="auto">${esc(card.front)}</strong></div>`;
    const footer = `
      <button type="button" class="button button-secondary" data-action="fc-modal-close">${esc(t("Cancel", "إلغاء"))}</button>
      <button type="button" class="button button-danger" data-action="fc-delete-card-confirm" data-card-id="${esc(card.id)}">${esc(t("Delete", "حذف"))}</button>`;
    return modalShell(t("Delete card?", "حذف البطاقة؟"), body, footer);
  }

  function cardMoveHtml(card) {
    const options = (decks || []).filter((d) => d && !d.deleted_at && d.id !== card.deck_id).map((d) =>
      `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join("");
    const body = `
      <p class="fc-sub">${esc(t("Move this card to another deck. Its review history stays attached.", "انقل هذه البطاقة إلى مجموعة أخرى. يبقى سجل مراجعتها مرتبطًا بها."))}</p>
      <div class="sz-card fc-danger-summary"><strong dir="auto">${esc(card.front)}</strong></div>
      <label class="fc-label" for="fc-move-deck">${esc(t("Target deck", "المجموعة المستهدفة"))}</label>
      <select id="fc-move-deck" class="fc-input">${options || `<option value="">${esc(t("No other decks", "لا توجد مجموعات أخرى"))}</option>`}</select>`;
    const footer = `
      <button type="button" class="button button-secondary" data-action="fc-modal-close">${esc(t("Cancel", "إلغاء"))}</button>
      <button type="button" class="button button-primary" data-action="fc-move-card-confirm" data-card-id="${esc(card.id)}">${esc(t("Move", "نقل"))}</button>`;
    return modalShell(t("Move card", "نقل البطاقة"), body, footer);
  }

  function cardPreviewHtml(card) {
    const body = `
      <div class="fc-preview-card fc-preview-static">
        <div class="fc-preview-face fc-preview-front"><span dir="auto">${esc(card.front)}</span></div>
        <div class="fc-preview-face fc-preview-back"><span dir="auto">${esc(card.back)}</span></div>
      </div>
      <div class="fc-preview-meta">
        <span><strong>${esc(t("Deck", "المجموعة"))}:</strong> ${deckName(card.deck_id)}</span>
        <span><strong>${esc(t("State", "الحالة"))}:</strong> ${stateBadge(card)}</span>
        <span><strong>${esc(t("Next review", "المراجعة القادمة"))}:</strong> ${esc(dueLabel(card))}</span>
        <span><strong>${esc(t("Difficulty", "الصعوبة"))}:</strong> ${esc(difficultyLabelOf(card))}</span>
        <span><strong>${esc(t("Difficulty", "الصعوبة"))}:</strong> ${esc(fmtInt(card.interval_days || 0))} ${esc(t("days", "أيام"))}</span>
        ${card.example ? `<span dir="auto"><strong>${esc(t("Example", "مثال"))}:</strong> ${esc(card.example)}</span>` : ""}
        ${card.image ? `<img class="fc-preview-image" src="${esc(card.image)}" alt="${esc(t("Card image", "صورة البطاقة"))}" loading="lazy" />` : ""}
      </div>`;
    const footer = `
      <button type="button" class="button button-secondary" data-action="fc-modal-close">${esc(t("Close", "إغلاق"))}</button>
      <button type="button" class="button button-quiet" data-action="fc-edit-card" data-card-id="${esc(card.id)}">${esc(t("Edit", "تعديل"))}</button>
      <button type="button" class="button button-primary" data-action="fc-study-card" data-card-id="${esc(card.id)}">${esc(t("Study this card", "ادرس هذه البطاقة"))}</button>`;
    return modalShell(t("Card preview", "معاينة البطاقة"), body, footer);
  }

  function importDeckOptionsHtml() {
    const realDecks = (decks || []).filter((d) => d && !d.deleted_at);
    const selected = importTargetDeck || (realDecks[0] ? realDecks[0].id : "__new__");
    return realDecks.map((d) =>
        `<option value="${esc(d.id)}" ${selected === d.id ? "selected" : ""}>${esc(d.name)}</option>`).join("") +
      `<option value="__new__" ${selected === "__new__" ? "selected" : ""}>＋ ${esc(t("New deck…", "مجموعة جديدة…"))}</option>`;
  }

  function importModalHtml() {
    const preview = importPreview;
    const deckOptions = importDeckOptionsHtml();
    const previewRows = preview && preview.valid ? preview.valid.slice(0, 8) : [];
    const previewHtml = preview ? `
      <div class="fc-import-preview">
        <div class="fc-import-counts">
          <span class="fc-import-pill">${fmtInt(preview.valid.length)} ${esc(t("valid", "صالحة"))}</span>
          ${preview.invalid ? `<span class="fc-import-pill fc-import-warn">${fmtInt(preview.invalid)} ${esc(t("invalid (missing front/back)", "غير صالحة (بدون سؤال/إجابة)"))}</span>` : ""}
          <span class="fc-import-pill fc-import-dup">${fmtInt(preview.duplicates)} ${esc(t("duplicates", "مكررة"))}</span>
        </div>
        ${previewRows.length ? `<div class="fc-import-table-wrap"><table class="fc-import-table"><thead><tr><th>${esc(t("Front", "الوجه"))}</th><th>${esc(t("Back", "الظهر"))}</th><th>${esc(t("Tags", "الوسوم"))}</th></tr></thead><tbody>${previewRows.map((row) => `<tr><td dir="auto">${esc(row.front)}</td><td dir="auto">${esc(String(row.back).slice(0, 80))}</td><td>${esc(row.tags || "")}</td></tr>`).join("")}</tbody></table></div>` : ""}
      </div>` : "";
    const body = `
      <div class="fc-import-grid">
        <div>
          <label class="fc-label" for="fc-import-file">${esc(t("Upload file (CSV or JSON)", "ارفع ملف (CSV أو JSON)"))}</label>
          <input id="fc-import-file" class="fc-input" type="file" accept=".csv,.json,application/json,text/csv" />
          <label class="fc-label" for="fc-import-text">${esc(t("Or paste CSV / JSON", "أو الصق CSV / JSON"))}</label>
          <textarea id="fc-import-text" class="fc-input" rows="6" dir="auto" placeholder="front,back,notes,example,tags,difficulty,source&#10;...&#10;أو / or: [{\"front\":\"...\",\"back\":\"...\"}]">${esc(importTextCache)}</textarea>
          <div class="fc-hero-actions"><button type="button" class="button button-secondary button-small" data-action="fc-import-validate">${esc(t("Validate & preview", "تحقق وعاين"))}</button></div>
        </div>
        <div>
          <label class="fc-label" for="fc-import-deck">${esc(t("Import into", "الاستيراد إلى"))}</label>
          <select id="fc-import-deck" class="fc-input">${deckOptions}</select>
          <div id="fc-import-new-deck-wrap" ${importTargetDeck === "__new__" ? "" : "hidden"}>
            <label class="fc-label" for="fc-import-new-deck">${esc(t("New deck name", "اسم المجموعة الجديدة"))}</label>
            <input id="fc-import-new-deck" class="fc-input" value="${esc(importNewDeckName)}" placeholder="${esc(t("e.g. Biology — Exam 2", "مثال: الأحياء — الاختبار ٢"))}" maxlength="120" />
          </div>
          <label class="fc-check"><input id="fc-import-skip" type="checkbox" ${importSkipDuplicates ? "checked" : ""} /> <span>${esc(t("Skip duplicates (same front + back)", "تخطي المكررات (نفس السؤال والإجابة)"))}</span></label>
          ${previewHtml}
        </div>
      </div>`;
    const footer = `
      <div class="fc-export-row">
        <button type="button" class="button button-quiet button-small" data-action="fc-export-csv">⬇ CSV</button>
        <button type="button" class="button button-quiet button-small" data-action="fc-export-json">⬇ JSON</button>
      </div>
      <button type="button" class="button button-secondary" data-action="fc-modal-close">${esc(t("Cancel", "إلغاء"))}</button>
      <button type="button" class="button button-primary" data-action="fc-import-run" ${preview && preview.valid.length ? "" : "disabled"}>${esc(t("Import cards", "استيراد البطاقات"))}</button>`;
    return modalShell(t("Import & export", "استيراد وتصدير"), body, footer, true);
  }

  function modalsHtml() {
    if (!modal) return "";
    switch (modal.kind) {
      case "deck-form": return deckFormHtml(modal.deck || null);
      case "deck-delete": { const deck = modal.deckId ? deckById(modal.deckId) : null; return deck ? deleteDeckHtml(deck) : ""; }
      case "card-form": return cardFormHtml(modal.cardId || null);
      case "card-delete": { const card = modal.cardId ? (cards || []).find((c) => c && c.id === modal.cardId) : null; return card ? cardDeleteHtml(card) : ""; }
      case "card-move": { const card = modal.cardId ? (cards || []).find((c) => c && c.id === modal.cardId) : null; return card ? cardMoveHtml(card) : ""; }
      case "card-preview": { const card = modal.cardId ? (cards || []).find((c) => c && c.id === modal.cardId) : null; return card ? cardPreviewHtml(card) : ""; }
      case "import": return importModalHtml();
      case "settings": return modalShell(t("Flashcards settings", "إعدادات البطاقات"), settingsFormHtml(), `<button type="button" class="button button-secondary" data-action="fc-modal-close">${esc(t("Close", "إغلاق"))}</button><button type="button" class="button button-primary" data-action="fc-save-settings">${esc(t("Save settings", "حفظ الإعدادات"))}</button>`, true);
      default: return "";
    }
  }
  function renderKeepingFocus(id) {
    const before = document.getElementById(id);
    const caret = before ? before.selectionStart : null;
    render();
    const after = document.getElementById(id);
    if (after && typeof after.focus === "function") {
      after.focus();
      try { const pos = caret == null ? after.value.length : caret; after.setSelectionRange(pos, pos); } catch (_) { /* ignore */ }
    }
    return null;
  }

  // ------------------------------------------------------------------ render & dispatch

  function render() {
    // Never clobber #page-content when the user is on another page. Any
    // stale flashcard state transition (async deck load, sync refresh, XP
    // update) must only write while the flashcards page is actually mounted.
    try {
      const pageNow = window.StudyZoneApp?.page;
      if (pageNow && pageNow !== "flashcards") return "";
    } catch (_) { /* fall through — fail open to the flashcards page */ }
    let html = "";
    if (decks === null) {
      html = `<section class="fc-view ${motionClass()}" data-fc-view="loading"><div class="fc-loading"><div class="fc-spinner" aria-hidden="true"></div><p>${esc(t("Loading flashcards…", "جارٍ تحميل البطاقات…"))}</p></div></section>`;
      // Kick off a one-time load then re-render.
      void loadAll().then(() => { if (mounted) render(); });
      const contentNow = hostCall("contentElement");
      if (contentNow) contentNow.innerHTML = html + modalsHtml();
      return html;
    }
    if (view === VIEW.DECKS) html = decksHtml();
    else if (view === VIEW.BROWSE) html = browseHtml();
    else if (view === VIEW.REVIEW) html = reviewHtml();
    else if (view === VIEW.STATS) html = statsHtml();
    else if (view === VIEW.SETTINGS) html = settingsHtml();
    else if (view === VIEW.IMPORT) html = importModalHtml(); // modal as fallback page
    else html = dashboardHtml();
    html += modalsHtml();
    const content = hostCall("contentElement");
    if (content) content.innerHTML = html;
    const afterRender = hostCall("afterRender");
    if (typeof afterRender === "function") afterRender(html);
    try { void refreshSyncState(); } catch (_) { /* keep UI snappy */ }
    return html;
  }

  function navigateTo(next) {
    view = next;
    lastRenderedView = next;
    return render();
  }

  function renderPage() {
    // IMPORTANT: never reset the current view here. The app shell may re-render
    // at any time (toasts, timers, sync); resetting would bounce the user out
    // of a review session and destroy any open modal/editor.
    view = view || VIEW.DASHBOARD;
    lastRenderedView = view;
    return render();
  }

  // ------------------------------------------------------------------ mount

  async function mount() {
    const content = hostCall("contentElement");
    if (!content || mounted) return;
    mounted = true;
    if (decks === null) { try { await loadAll(); } catch (_) { /* keep shell */ } render(); }
    content.addEventListener("click", (event) => {
      if (Date.now() < swipeGuardUntil) { event.preventDefault(); return; }
      const target = event.target instanceof Element ? event.target : null;
      const backdrop = target ? target.closest("[data-fc-backdrop]") : null;
      if (backdrop && target === backdrop) { closeModal(); return render(); }
      // Square flip tiles: a tap on the card face flips it independently; the
      // action buttons (edit/delete/…) are deliberately outside the flip area.
      const tile = target ? (target.closest(".fc-tile") || target.closest("[data-fc-card]")) : null;
      if (tile && !target.closest(".fc-tile-actions") && !target.closest("a") && !target.closest("button")) {
        const onStudyCard = Boolean(tile.closest("[data-fc-card]"));
        const applied = onStudyCard
          ? applyStudyFlip(tile)
          : flipKeyTarget(tile, false);
        // Rapid double taps within the flip debounce window are ignored, so the
        // 3D transition is never restarted mid-flight.
        if (onStudyCard && !applied) { event.preventDefault(); return; }
        event.preventDefault();
        return;
      }
      const button = target ? target.closest("[data-action]") : null;
      if (!button) return;
      event.preventDefault();
      void handleAction(String(button.getAttribute("data-action") || ""), button);
    });
    // Touch / pointer swipe left → next card, right → previous card (review stage).
    content.addEventListener("pointerdown", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const stage = target ? target.closest("#fc-card-stage") : null;
      if (!stage) return;
      const tag = (event.target && event.target.tagName) ? String(event.target.tagName).toLowerCase() : "";
      if (tag === "input" || tag === "textarea" || (event.target && event.target.isContentEditable)) return;
      swipeStart = { x: Number(event.clientX) || 0, y: Number(event.clientY) || 0, pointerId: event.pointerId };
    });
    content.addEventListener("pointerup", (event) => {
      const start = swipeStart;
      if (!start || start.pointerId !== event.pointerId) return;
      swipeStart = null;
      const dx = (Number(event.clientX) || 0) - (Number(start.x) || 0);
      const dy = (Number(event.clientY) || 0) - (Number(start.y) || 0);
      if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy)) return;
      swipeGuardUntil = Date.now() + 450;
      void handleAction(fcNavSwipeDelta(dx) > 0 ? "fc-nav-next" : "fc-nav-prev", null);
    });
    content.addEventListener("pointercancel", (event) => {
      if (swipeStart && swipeStart.pointerId === event.pointerId) swipeStart = null;
    });
    content.addEventListener("input", (event) => {
      const target = event.target;
      const id = target && target.id ? String(target.id) : "";
      if (id === "fc-deck-search") { deckQuery = target.value; browsePage = 0; return renderKeepingFocus("fc-deck-search"); }
      if (id === "fc-browse-search") { browseQuery = target.value; browsePage = 0; return renderKeepingFocus("fc-browse-search"); }
      if (id === "fc-deck-name") { deckFormCache.name = target.value; return; }
      if (id === "fc-deck-desc") { deckFormCache.desc = target.value; return; }
      if (id.startsWith("fc-setting-")) { settingsFormCache[id] = target.type === "checkbox" ? target.checked : target.value; return; }
      if (id === "fc-import-text") { importTextCache = target.value; return; }
      if (id === "fc-import-new-deck") { importNewDeckName = target.value; return; }
      if (id.startsWith("fc-editor-")) { updateEditorDraft(); return; }
      if (id.startsWith("fc-import-")) return;
    });
    content.addEventListener("change", (event) => {
      const target = event.target;
      const id = target && target.id ? String(target.id) : "";
      if (id === "fc-browse-deck") { browseDeckId = String(target.value || ""); browsePage = 0; browseFilter = "all"; return render(); }
      if (id === "fc-browse-sort") { browseSort = String(target.value || "due"); browsePage = 0; return render(); }
      if (id === "fc-deck-sort") { deckSort = String(target.value || "name"); return render(); }
      if (id === "fc-import-deck") {
        importTargetDeck = String(target.value || "all");
        const wrap = document.getElementById("fc-import-new-deck-wrap");
        if (wrap) wrap.hidden = importTargetDeck !== "__new__";
        return;
      }
      if (id === "fc-import-skip") { importSkipDuplicates = Boolean(target.checked); return; }
      if (id === "fc-setting-speech-rate") {
        const value = Number(target.value);
        if ([0.75, 1, 1.25].includes(value)) {
          speechRate = value;
          try { localStorage.setItem("studyflow.flashcards-speech-rate", String(value)); } catch (_) { /* ignore */ }
          stopFlashcardSpeech();
        }
        return;
      }
      if (id === "fc-setting-motion") { try { localStorage.setItem("studyflow.flashcards-motion", String(target.value || "subtle")); } catch (_) { /* ignore */ } return render(); }
      if (id.startsWith("fc-setting-")) return;
    });
    content.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modal) { event.preventDefault(); event.stopPropagation(); closeModal(); return render(); }
      const tile = event.target && event.target.closest ? (event.target.closest(".fc-tile") || event.target.closest("[data-fc-card]")) : null;
      const onStudyCard = tile ? Boolean(tile.closest("[data-fc-card]")) : false;
      // Flip keys (Enter / Space) are handled here so the window-level hotkey
      // handler never double-toggles. stopPropagation keeps the two handlers
      // from fighting over the same key press.
      if (tile && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        const applied = onStudyCard ? applyStudyFlip(tile) : flipKeyTarget(tile, false);
        event.stopPropagation();
        if (onStudyCard && !applied) return;
      }
    });
    // Register the hotkey handler exactly once; it handles the CURRENT keydown.
    // (The old code registered attachHotkeyHandler itself as a listener, which
    // only created a NEW handler for the NEXT event and never handled the
    // current one — keyboard shortcuts/Escape were broken until a later press.)
    attachHotkeyHandler();
    // Online/offline awareness for sync status.
    if (!window.__fcSyncListenersInstalled) {
      window.__fcSyncListenersInstalled = true;
      window.addEventListener("online", () => { syncState = { ...syncState, online: true }; void refreshSyncState(); scheduleSync(); });
      window.addEventListener("offline", () => { syncState = { ...syncState, online: false }; });
      syncInterval = window.setInterval(() => { void refreshSyncState(); }, 30000);
    }
  }

  function attachHotkeyHandler() {
    const handler = (event) => {
      if (modal) {
        if (event.key === "Escape") { closeModal(); event.preventDefault(); render(); }
        return;
      }
      if (view !== VIEW.REVIEW || document.visibilityState !== "visible") return;
      const tag = (event.target && event.target.tagName) ? String(event.target.tagName).toLowerCase() : "";
      if (tag === "input" || tag === "textarea" || (event.target && event.target.isContentEditable)) return;
      const tile = event.target && event.target.closest ? (event.target.closest(".fc-tile") || event.target.closest("[data-fc-card]")) : null;
      const onStudyCard = tile ? Boolean(tile.closest("[data-fc-card]")) : false;
      const navDelta = fcNavKeyDelta(event.key);
      if (navDelta) { event.preventDefault(); void navigateCard(navDelta); return; }
      if (tile && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        const applied = onStudyCard ? applyStudyFlip(tile) : flipKeyTarget(tile, false);
        event.stopPropagation();
        if (onStudyCard && !applied) return;
      }
      if (event.key === "1") void rate("again");
      else if (event.key === "2") void rate("hard");
      else if (event.key === "3") void rate("good");
      else if (event.key === "4") void rate("easy");
      else if (event.key === "s" || event.key === "S") void suspendCurrent();
      else if (event.key === "Escape") void endSession(false);
    };
    window.addEventListener("keydown", handler);
    hotkeyDisposers.push(() => window.removeEventListener("keydown", handler));
  }

  function detachHotkeys() {
    hotkeyDisposers.forEach((dispose) => { try { dispose(); } catch (_) { /* noop */ } });
    hotkeyDisposers = [];
  }

  // ------------------------------------------------------------------ modals controller

  function openModal(kind, payload) {
    modal = Object.assign({ kind }, payload || {});
    if (kind === "card-form") editorDraft = null;
    if (kind === "deck-form") { deckFormCache.name = undefined; deckFormCache.desc = undefined; }
    if (kind === "import" && !importTargetDeck) importTargetDeck = defaultImportDeckId();
    render();
    const first = document.querySelector(".fc-modal input, .fc-modal textarea, .fc-modal select");
    if (first && typeof first.focus === "function") window.setTimeout(() => { try { first.focus(); } catch (_) { /* ignore */ } }, 0);
  }

  function closeModal() {
    modal = null;
    editorDraft = null;
    importPreview = null;
    deckFormCache.name = undefined;
    deckFormCache.desc = undefined;
    importTextCache = "";
  }

  function updateEditorDraft() {
    const read = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
    const cardId = modal && modal.kind === "card-form" ? modal.cardId || null : null;
    editorDraft = {
      cardId,
      deck_id: read("fc-editor-deck"),
      type: "basic",
      difficulty: read("fc-editor-difficulty") || "medium",
      front: read("fc-editor-front"),
      back: read("fc-editor-back"),
      example: read("fc-editor-example"),
      explanation: read("fc-editor-explanation"),
      image: read("fc-editor-image"),
      tags: read("fc-editor-tags").split(",").map((s) => s.trim()).filter(Boolean),
      notes: read("fc-editor-notes"),
      source: read("fc-editor-source") || "manual",
    };
  }

  function readEditorForm() {
    const read = (id) => { const el = document.getElementById(id); return el ? String(el.value || "") : ""; };
    return {
      deck_id: read("fc-editor-deck"),
      difficulty: read("fc-editor-difficulty") || "medium",
      front: read("fc-editor-front"),
      back: read("fc-editor-back"),
      example: read("fc-editor-example"),
      explanation: read("fc-editor-explanation"),
      image: read("fc-editor-image"),
      tags: read("fc-editor-tags").split(",").map((s) => s.trim()).filter(Boolean),
      notes: read("fc-editor-notes"),
      source: read("fc-editor-source") || "manual",
      type: "basic",
    };
  }
  // ------------------------------------------------------------------ actions

  async function handleAction(action, button) {
    const deckIdOf = () => (button && button.getAttribute("data-deck-id")) || "";
    switch (action) {
      case "fc-start-due": fcUi.deckId = null; browseDeckId = ""; return startSession("due");
      case "fc-open-decks": return navigateTo(VIEW.DECKS);
      case "fc-open-deck": { fcUi.deckId = deckIdOf() || fcUi.deckId; browseDeckId = fcUi.deckId; browsePage = 0; browseFilter = "all"; return navigateTo(VIEW.BROWSE); }
      case "fc-go-browse": return navigateTo(VIEW.BROWSE);
      case "fc-go-stats": return navigateTo(VIEW.STATS);
      case "fc-go-dashboard": { sessionState = null; view = VIEW.DASHBOARD; lastRenderedView = view; return render(); }
      case "fc-add-card": return openModal("card-form", { cardId: null });
      case "fc-new-deck": return openModal("deck-form", { deck: null });
      case "fc-edit-deck": { const deck = deckById(deckIdOf()); return deck ? openModal("deck-form", { deck }) : null; }
      case "fc-delete-deck": return openModal("deck-delete", { deckId: deckIdOf() });
      case "fc-start-deck": { fcUi.deckId = deckIdOf() || fcUi.deckId; return startSession("due"); }
      case "fc-study-card": return startCardSession((button && button.getAttribute("data-card-id")) || null);
      case "fc-deck-filter": deckFilter = String((button && button.getAttribute("data-filter")) || "all"); return render();
      case "fc-browse-filter": browseFilter = String((button && button.getAttribute("data-filter")) || "all"); browsePage = 0; return render();
      case "fc-browse-view": browseView = String((button && button.getAttribute("data-view")) || "grid"); try { localStorage.setItem("studyflow.flashcards-view", browseView); } catch (_) { /* ignore */ } return render();
      case "fc-browse-prev": if (browsePage > 0) { browsePage -= 1; return render(); } return null;
      case "fc-browse-next": { browsePage += 1; return render(); }
      case "fc-edit-card": return openModal("card-form", { cardId: (button && button.getAttribute("data-card-id")) || null });
      case "fc-delete-card": return openModal("card-delete", { cardId: (button && button.getAttribute("data-card-id")) || null });
      case "fc-move-card": return openModal("card-move", { cardId: (button && button.getAttribute("data-card-id")) || null });
      case "fc-preview-card": return openModal("card-preview", { cardId: (button && button.getAttribute("data-card-id")) || null });
      case "fc-duplicate-card": return duplicateCard((button && button.getAttribute("data-card-id")) || null);
      case "fc-save-card": return saveCardFromForm();
      case "fc-save-deck": return saveDeckFromForm((button && button.getAttribute("data-deck-id")) || null);
      case "fc-delete-deck-confirm": return deleteDeckConfirmed(deckIdOf());
      case "fc-delete-card-confirm": return deleteCardConfirmed((button && button.getAttribute("data-card-id")) || null);
      case "fc-move-card-confirm": return moveCardConfirmed((button && button.getAttribute("data-card-id")) || null);
      case "fc-pick-color": {
        const color = String((button && button.getAttribute("data-color")) || DECK_COLORS[0]);
        const row = button.closest(".fc-swatch-row");
        if (row) { row.dataset.selectedColor = color; row.querySelectorAll(".fc-swatch").forEach((el) => el.classList.toggle("is-active", el === button)); }
        return null;
      }
      case "fc-pick-icon": {
        const icon = String((button && button.getAttribute("data-icon")) || DECK_ICONS[0]);
        const row = button.closest(".fc-icon-row");
        if (row) { row.dataset.selectedIcon = icon; row.querySelectorAll(".fc-icon-pick").forEach((el) => el.classList.toggle("is-active", el === button)); }
        return null;
      }
      case "fc-sync-now": return runSync(false);
      case "fc-modal-close": closeModal(); return render();
      case "fc-import-open": return openModal("import", {});
      case "fc-import-validate": return validateImport();
      case "fc-import-run": return runImport();
      case "fc-export-csv": exportCards("csv"); return null;
      case "fc-export-json": exportCards("json"); return null;
      case "fc-save-settings": return saveSettingsFromForm();
      case "fc-reveal": return reveal();
      case "fc-rate": {
        const rating = String((button && button.getAttribute("data-rating")) || "good");
        return rate(rating);
      }
      case "fc-review-suspend": return suspendCurrent();
      case "fc-review-end": return endSession(false);
      case "fc-nav-prev": return navigateCard(-1);
      case "fc-nav-next": return navigateCard(1);
      case "fc-nav-back": {
        if (!sessionState) return navigateTo(VIEW.DASHBOARD);
        if ((sessionState.index || 0) <= 0) { return endSession(false); }
        return navigateCard(-1);
      }
      case "fc-open-settings": return openModal("settings", {});
      case "fc-audio": return fcAudioAction(button);
      case "fc-evaluate": return evaluateCard(String((button && button.getAttribute("data-evaluation")) || "again"));
      case "fc-peek-prev": return navigateCard(-1);
      case "fc-peek-next": return navigateCard(1);
      case "fc-peek-back": if (sessionState) sessionState.peekIndex = null; return render();
      case "fc-summary-done": { sessionState = null; view = VIEW.DASHBOARD; lastRenderedView = view; return render(); }
      case "fc-cancel-edit": closeModal(); return render();
      default: return null;
    }
  }

  async function saveDeckFromForm(deckId) {
    const nameEl = document.getElementById("fc-deck-name");
    const descEl = document.getElementById("fc-deck-desc");
    const name = String(nameEl ? nameEl.value : "").trim();
    const description = String(descEl ? descEl.value : "").trim();
    const colorRow = document.getElementById("fc-deck-colors");
    const iconRow = document.getElementById("fc-deck-icons");
    const color = (colorRow && colorRow.dataset.selectedColor) || DECK_COLORS[0];
    const icon = (iconRow && iconRow.dataset.selectedIcon) || DECK_ICONS[0];
    if (!name) { showToast(t("Enter a deck name.", "أدخل اسم المجموعة.")); return null; }
    const db = await getDb();
    if (!db || !db.decks) { showToast(t("Local storage unavailable.", "التخزين المحلي غير متاح.")); return null; }
    try {
      const existing = deckId ? deckById(deckId) : null;
      const deck = existing
        ? { ...existing, name, description, color, icon, updated_at: nowIso() }
        : { id: core.uid("deck"), name, description, color, icon, parent_id: null, created_at: nowIso(), updated_at: nowIso(), deleted_at: null };
      await db.decks.put(userId, deck);
      enqueueSync("flashcard_decks", "upsert", deck);
      closeModal();
      await refreshData();
      showToast(deckId ? t("Deck updated.", "تم تحديث المجموعة.") : t("Deck created.", "تم إنشاء المجموعة."));
      return render();
    } catch (err) {
      console.error("Flashcards: failed to save deck", err);
      showToast(t("Could not save deck. Your input was kept.", "تعذر حفظ المجموعة. تم الاحتفاظ بإدخالك."));
      return null; // keep modal open with the draft intact
    }
  }

  async function deleteDeckConfirmed(deckId) {
    const deck = deckById(deckId);
    if (!deck) { closeModal(); return render(); }
    const db = await getDb();
    if (!db) { showToast(t("Local storage unavailable.", "التخزين المحلي غير متاح.")); return null; }
    const iso = nowIso();
    const deckCards = (cards || []).filter((card) => card && card.deck_id === deckId && !card.deleted_at);
    try {
      for (const card of deckCards) {
        const deleted = { ...card, deleted_at: iso, updated_at: iso };
        try { await db.raw.put("cards", { ...deleted, user_id: userId }); } catch (_) { await db.cards.put(userId, deleted); }
        enqueueSync("flashcard_cards", "upsert", deleted);
      }
      const deletedDeck = { ...deck, deleted_at: iso, updated_at: iso };
      await db.decks.put(userId, deletedDeck);
      enqueueSync("flashcard_decks", "upsert", deletedDeck);
      if (fcUi.deckId === deckId) { fcUi.deckId = null; browseDeckId = ""; }
      closeModal();
      await refreshData();
      showToast(t("Deck deleted.", "تم حذف المجموعة."));
      return render();
    } catch (err) {
      console.error("Flashcards: failed to delete deck", err);
      showToast(t("Could not delete deck.", "تعذر حذف المجموعة."));
      closeModal();
      return render();
    }
  }

  async function duplicateCard(cardId) {
    const source = (cards || []).find((card) => card && card.id === cardId);
    if (!source) return null;
    const db = await getDb();
    if (!db) return null;
    const iso = nowIso();
    const copy = {
      ...core.newCard(source.front, source.back, { deck_id: source.deck_id, type: source.type || "basic", source: source.source || "manual" }),
      difficulty: source.difficulty || "medium",
      example: source.example || "",
      explanation: source.explanation || "",
      image: source.image || "",
      tags: Array.isArray(source.tags) ? source.tags.slice() : [],
      notes: source.notes || "",
      created_at: iso,
      updated_at: iso,
    };
    try {
      await db.cards.put(userId, copy);
      enqueueSync("flashcard_cards", "upsert", copy);
      await refreshData();
      showToast(t("Card duplicated.", "تم تكرار البطاقة."));
      return render();
    } catch (err) {
      console.error("Flashcards: duplicate failed", err);
      showToast(t("Could not duplicate card.", "تعذر تكرار البطاقة."));
      return null;
    }
  }

  async function moveCardConfirmed(cardId) {
    const select = document.getElementById("fc-move-deck");
    const target = select ? String(select.value || "") : "";
    if (!target) { showToast(t("Choose a deck.", "اختر مجموعة.")); return null; }
    const source = (cards || []).find((card) => card && card.id === cardId);
    if (!source) { closeModal(); return render(); }
    const db = await getDb();
    if (!db) return null;
    const updated = { ...source, deck_id: target, updated_at: nowIso() };
    try {
      await db.cards.put(userId, updated);
      enqueueSync("flashcard_cards", "upsert", updated);
      closeModal();
      await refreshData();
      showToast(t("Card moved.", "تم نقل البطاقة."));
      return render();
    } catch (err) {
      console.error("Flashcards: move failed", err);
      showToast(t("Could not move card.", "تعذر نقل البطاقة."));
      return null;
    }
  }

  async function deleteCardConfirmed(cardId) {
    const source = (cards || []).find((card) => card && card.id === cardId);
    if (!source) { closeModal(); return render(); }
    const db = await getDb();
    if (!db) return null;
    const iso = nowIso();
    const deleted = { ...source, deleted_at: iso, updated_at: iso };
    try {
      await db.cards.put(userId, deleted);
      enqueueSync("flashcard_cards", "upsert", deleted);
      closeModal();
      await refreshData();
      showToast(t("Card deleted.", "تم حذف البطاقة."));
      return render();
    } catch (err) {
      console.error("Flashcards: delete failed", err);
      showToast(t("Could not delete card.", "تعذر حذف البطاقة."));
      return null;
    }
  }

  async function saveCardFromForm() {
    const form = readEditorForm();
    const cardId = modal && modal.kind === "card-form" ? modal.cardId || null : null;
    const db = await getDb();
    if (!db) { showToast(t("Local storage unavailable.", "التخزين المحلي غير متاح.")); return null; }
    let deckId = form.deck_id || fcUi.deckId || (decks && decks[0] && decks[0].id) || "";
    if (!deckId) { showToast(t("Create a deck first.", "أنشئ مجموعة أولًا.")); return null; }
    const front = String(form.front || "").trim();
    const back = String(form.back || "").trim();
    if (!front || !back) {
      showToast(t("Front and back are required.", "السؤال والإجابة مطلوبان."));
      editorDraft = Object.assign({}, form, { cardId });
      return null; // keep the modal and the draft intact
    }
    const iso = nowIso();
    const payload = {
      deck_id: deckId,
      type: form.type || "basic",
      template: form.type || "basic",
      difficulty: form.difficulty || "medium",
      front,
      back,
      example: String(form.example || ""),
      explanation: String(form.explanation || ""),
      image: String(form.image || ""),
      source: String(form.source || "manual"),
      tags: Array.isArray(form.tags) ? form.tags : [],
      notes: String(form.notes || ""),
      updated_at: iso,
    };
    try {
      let cardToSave;
      const existing = cardId ? (cards || []).find((item) => item && item.id === cardId) : null;
      if (existing) {
        cardToSave = { ...existing, ...payload, id: existing.id };
      } else {
        cardToSave = Object.assign(core.newCard(front, back, { deck_id: deckId, type: form.type || "basic", source: payload.source }), payload);
      }
      if (!cardToSave.id) cardToSave.id = core.uid("card");
      await db.cards.put(userId, cardToSave);
      enqueueSync("flashcard_cards", "upsert", cardToSave);
      editorDraft = null;
      modal = null;
      await refreshData();
      showToast(cardId ? t("Card updated.", "تم تحديث البطاقة.") : t("Card added.", "تمت إضافة البطاقة."));
      return render();
    } catch (err) {
      console.error("Flashcards: failed to save card", err);
      editorDraft = Object.assign({}, form, { cardId }); // keep unsaved input
      showToast(t("Could not save card. Your input was kept.", "تعذر حفظ البطاقة. تم الاحتفاظ بإدخالك."));
      return null;
    }
  }
  // ------------------------------------------------------------------ session

  /**
   * Study exactly one card chosen from the word list. This is a normal review
   * session (same SRS write, review log and XP rules) with a single-item queue,
   * so "open this card" never bypasses the existing spaced-repetition system.
   */
  function startCardSession(cardId) {
    const card = (cards || []).find((item) => item && item.id === cardId && !item.deleted_at);
    if (!card) { showToast(t("Card not found.", "لم يتم العثور على البطاقة.")); return null; }
    modal = null;
    editorDraft = null;
    sessionState = {
      mode: "single",
      deckId: card.deck_id || null,
      queue: [card],
      index: 0,
      currentCard: card,
      revealed: false,
      answers: [],
      peekIndex: null,
      startedAt: Date.now(),
      paused: false,
      total: 1,
      xpEarned: 0,
      done: false,
      navDirection: null,
    };
    view = VIEW.REVIEW;
    lastRenderedView = view;
    return render();
  }

  async function startSession(mode) {
    const at = Date.now();
    const deckId = fcUi.deckId || browseDeckId || null;
    const dueNow = core.dueCards(cards, new Date(), { includeNew: true, deckId: deckId || undefined });
    const introduced = core.introducedToday(reviews, new Date());
    const fresh = dueNow.filter((card) => card.state === "new" && !introduced.has(card.id)).slice(0, Math.max(0, settings.new_per_day));
    const rest = dueNow.filter((card) => card.state !== "new").slice(0, Math.max(1, settings.reviews_per_day));
    let pool = mode === "new" ? fresh : mode === "all" ? dueNow.slice(0, 500) : rest.concat(fresh);
    pool = pool.slice().sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
    if (!pool.length) {
      showToast(t("No cards are due right now. Great job!", "لا توجد بطاقات مستحقة الآن. أحسنت!"));
      return null;
    }
    sessionState = {
      mode,
      deckId,
      queue: pool,
      index: 0,
      currentCard: pool[0] || null,
      revealed: false,
      answers: [],
      peekIndex: null,
      startedAt: at,
      paused: false,
      total: pool.length,
      xpEarned: 0,
      done: false,
      navDirection: null,
    };
    view = VIEW.REVIEW;
    lastRenderedView = view;
    return render();
  }

  function peekMove(delta) {
    const state = sessionState;
    if (!state || !Array.isArray(state.queue) || !state.queue.length) return null;
    const base = state.peekIndex != null ? Number(state.peekIndex) : state.index;
    const max = state.queue.length - 1;
    state.peekIndex = Math.max(0, Math.min(max, (Number.isFinite(base) ? base : state.index) + delta));
    return render();
  }

  async function reveal() {
    if (!sessionState || !sessionState.currentCard) return null;
    sessionState.revealed = true;
    return render();
  }

  async function rate(rating) {
    // One review write at a time. Rapid double taps (or a tap plus a keyboard
    // shortcut / Know button) can otherwise schedule the same card twice and
    // award duplicate XP.
    if (ratingInFlight) return null;
    ratingInFlight = true;
    try {
      return await rateInternal(rating);
    } finally {
      ratingInFlight = false;
    }
  }

  async function rateInternal(rating) {
    const state = sessionState;
    if (!state || !state.currentCard || state.done) return null;
    if (state.revealed !== true) state.revealed = true;
    const card = state.currentCard;
    const result = core.schedule({ card, rating, at: Date.now(), settings });
    const reviewId = core.uid("rev");
    const iso = nowIso();
    const reviewRow = {
      id: reviewId,
      user_id: userId,
      card_id: card.id,
      deck_id: card.deck_id,
      rating,
      reviewed_at: iso,
      local_day: dayKey(new Date()),
      was_new: card.state === "new",
      state: result.card.state,
      next_due_at: result.card.due_at,
      next_interval_days: result.card.interval_days,
      next_ease: result.card.ease,
      next_lapses: result.card.lapses,
      next_learning_step: result.card.learning_step,
    };
    const db = await getDb();
    try {
      await db.reviews.put(userId, [reviewRow]);
      enqueueSync("flashcard_review_logs", "upsert", reviewRow);
      enqueueSync("flashcard_cards", "upsert", result.card);
    } catch (err) {
      console.error("Flashcards: failed to persist review", err);
      showToast(t("Could not save the review. Please try again.", "تعذر حفظ المراجعة. حاول مرة أخرى."));
      return null; // stay on the same card so nothing is lost
    }
    // Local XP ledger (server ledger stays authoritative when online).
    let xpAward = 0;
    try { xpAward = await awardLocalXp(reviewId, rating); } catch (_) { xpAward = 0; }
    reviews = (reviews || []).concat([reviewRow]);
    const updatedCards = (cards || []).map((item) => (item && item.id === result.card.id ? result.card : item));
    if (!updatedCards.some((item) => item && item.id === result.card.id)) updatedCards.push(result.card);
    cards = updatedCards;
    state.xpEarned = (state.xpEarned || 0) + xpAward;
    state.answers.push({ cardId: card.id, rating, intervalDays: result.card.interval_days, dueAt: result.card.due_at, xp: xpAward });
    state.peekIndex = null;
    state.index += 1;
    stopFlashcardSpeech();
    if (state.index < state.queue.length) {
      state.currentCard = state.queue[state.index] || null;
      state.revealed = false;
      state.navDirection = "next";
      const html = render();
      state.navDirection = null;
      return html;
    }
    state.currentCard = null;
    state.done = true;
    return render();
  }

  async function endSession(skipSummary) {
    stopFlashcardSpeech();
    const state = sessionState;
    if (state && !state.done && state.answers && state.answers.length && !skipSummary) {
      // Explicit finish with progress → show summary instead of jumping to dashboard.
      state.done = true;
      return render();
    }
    sessionState = null;
    view = VIEW.DASHBOARD;
    lastRenderedView = view;
    try { await refreshData(); } catch (_) { /* keep navigation working */ }
    return render();
  }

  async function suspendCurrent() {
    const state = sessionState;
    if (!state || !state.currentCard) return null;
    stopFlashcardSpeech();
    const card = state.currentCard;
    const db = await getDb();
    if (!db) return null;
    const suspended = { ...card, suspended: true, updated_at: nowIso() };
    try {
      await db.cards.put(userId, suspended);
      enqueueSync("flashcard_cards", "upsert", suspended);
      cards = (cards || []).map((item) => (item && item.id === card.id ? suspended : item));
      state.answers.push({ cardId: card.id, rating: "suspend", intervalDays: 0, dueAt: suspended.due_at, xp: 0 });
      state.peekIndex = null;
      state.index += 1;
      if (state.index < state.queue.length) {
        state.currentCard = state.queue[state.index] || null;
        state.revealed = false;
        state.navDirection = "next";
        const html = render();
        state.navDirection = null;
      } else {
        state.currentCard = null;
        state.done = true;
      }
      showToast(t("Card suspended.", "تم تعليق البطاقة."));
      return render();
    } catch (err) {
      console.error("Flashcards: suspend failed", err);
      showToast(t("Could not suspend the card.", "تعذر تعليق البطاقة."));
      return null;
    }
  }

  async function evaluateCard(evaluation) {
    if (evaluationInFlight) return null;
    const rating = evaluation === "good" ? "good" : "again";
    evaluationInFlight = true;
    try {
      return await rate(rating);
    } finally {
      evaluationInFlight = false;
    }
  }

  // ------------------------------------------------------------------ import / export

  function cardKey(front, back) {
    return `${norm(front)}|||${norm(back)}`;
  }

  function currentImportText() {
    const area = document.getElementById("fc-import-text");
    const fileNote = document.getElementById("fc-import-file");
    return { text: area ? area.value : "", file: fileNote ? fileNote.files && fileNote.files[0] : null };
  }

  function parseImportText(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return { rows: [], error: "EMPTY_FILE" };
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const json = JSON.parse(trimmed);
        const arr = Array.isArray(json) ? json : (json && Array.isArray(json.cards) ? json.cards : []);
        const rows = arr.map((item) => ({
          front: String((item && item.front) || "").trim(),
          back: String((item && item.back) || "").trim(),
          notes: String((item && item.notes) || ""),
          example: String((item && item.example) || ""),
          explanation: String((item && item.explanation) || ""),
          tags: Array.isArray(item && item.tags) ? item.tags.join(",") : String((item && item.tags) || ""),
          difficulty: String((item && item.difficulty) || "medium"),
          source: String((item && item.source) || "import"),
        }));
        return { rows, error: null };
      } catch (_) {
        return { rows: [], error: "JSON" };
      }
    }
    const parsed = core.parseDelimited(trimmed, ",");
    if (parsed.errors && parsed.errors.length) return { rows: [], error: "CSV" };
    return { rows: parsed.rows || [], error: null };
  }

  function defaultImportDeckId() {
    const first = (decks || []).find((d) => d && !d.deleted_at);
    return first ? first.id : "__new__";
  }
  function duplicateScopeDeckId() {
    const target = importTargetDeck || defaultImportDeckId();
    return target === "__new__" ? "" : target; // new deck: detect duplicates across everything
  }

  function validateImportRows(rows) {
    const deckId = duplicateScopeDeckId();
    const existing = new Set((cards || [])
      .filter((card) => card && !card.deleted_at && (!deckId || card.deck_id === deckId))
      .map((card) => cardKey(card.front, card.back)));
    const valid = [];
    let invalid = 0;
    let duplicates = 0;
    (rows || []).forEach((rowRaw) => {
      const row = {
        front: String(rowRaw.front || "").trim(),
        back: String(rowRaw.back || "").trim(),
        notes: String(rowRaw.notes || ""),
        example: String(rowRaw.example || ""),
        explanation: String(rowRaw.explanation || ""),
        tags: String(rowRaw.tags || ""),
        difficulty: String(rowRaw.difficulty || "medium").toLowerCase(),
        source: String(rowRaw.source || "import"),
      };
      if (!row.front || !row.back) { invalid += 1; return; }
      if (!["easy", "medium", "hard"].includes(row.difficulty)) row.difficulty = "medium";
      valid.push(row);
      if (existing.has(cardKey(row.front, row.back))) duplicates += 1;
    });
    return { valid, invalid, duplicates };
  }

  async function validateImport() {
    const { text, file } = currentImportText();
    let sourceText = String(text || "");
    if (file && typeof file.text === "function") {
      try { sourceText = await file.text(); } catch (_) { showToast(t("Could not read the file.", "تعذر قراءة الملف.")); return; }
    }
    // Preserve the form contents across the re-render.
    const deckSelect = document.getElementById("fc-import-deck");
    const newDeckInput = document.getElementById("fc-import-new-deck");
    const skipInput = document.getElementById("fc-import-skip");
    importTargetDeck = deckSelect ? String(deckSelect.value || defaultImportDeckId()) : importTargetDeck;
    importNewDeckName = newDeckInput ? newDeckInput.value : importNewDeckName;
    importSkipDuplicates = skipInput ? Boolean(skipInput.checked) : importSkipDuplicates;
    importTextCache = sourceText;
    const parsed = parseImportText(sourceText);
    if (parsed.error) {
      importPreview = null;
      showToast(parsed.error === "EMPTY_FILE" ? t("Choose a file or paste content first.", "اختر ملفًا أو الصق محتوى أولًا.") : t("Could not parse the file. Check the format.", "تعذر قراءة الملف. تحقق من الصيغة."));
      return;
    }
    const result = validateImportRows(parsed.rows);
    importPreview = result;
    // Re-render so the preview appears, then restore the textarea contents.
    modal = modal || { kind: "import" };
    render();
    const area = document.getElementById("fc-import-text");
    if (area && sourceText) area.value = sourceText;
    if (!result.valid.length) showToast(t("No valid rows found.", "لا توجد صفوف صالحة."));
  }

  function parseTags(raw) {
    return String(raw || "").split(/[;,]/).map((tag) => tag.trim()).filter(Boolean);
  }

  async function runImport() {
    if (!importPreview || !importPreview.valid.length) { showToast(t("Validate the file first.", "تحقق من الملف أولًا.")); return; }
    const db = await getDb();
    if (!db) { showToast(t("Local storage unavailable.", "التخزين المحلي غير متاح.")); return; }
    let deckId = importTargetDeck || defaultImportDeckId();
    if (deckId === "__new__") {
      const input = document.getElementById("fc-import-new-deck");
      const name = String((input && input.value) || importNewDeckName || "").trim();
      if (!name) { showToast(t("Enter a deck name.", "أدخل اسم المجموعة.")); return; }
      const deck = { id: core.uid("deck"), name, description: "", color: DECK_COLORS[0], icon: "🧠", parent_id: null, created_at: nowIso(), updated_at: nowIso(), deleted_at: null };
      try { await db.decks.put(userId, deck); enqueueSync("flashcard_decks", "upsert", deck); } catch (err) {
        console.error("Flashcards: import deck creation failed", err);
        showToast(t("Could not create the new deck.", "تعذر إنشاء المجموعة الجديدة."));
        return;
      }
      deckId = deck.id;
    }
    if (!deckId || deckId === "__new__") {
      showToast(t("Choose or create a deck for the import.", "اختر أو أنشئ مجموعة للاستيراد."));
      return;
    }
    const skip = importSkipDuplicates;
    const existing = new Set((cards || []).filter((card) => card && card.deck_id === deckId).map((card) => cardKey(card.front, card.back)));
    let added = 0;
    let skipped = 0;
    for (const row of importPreview.valid) {
      const key = cardKey(row.front, row.back);
      if (skip && existing.has(key)) { skipped += 1; continue; }
      const card = core.newCard(row.front, row.back, { deck_id: deckId, type: "basic", source: row.source || "import" });
      card.difficulty = row.difficulty || "medium";
      card.example = row.example || "";
      card.explanation = row.explanation || "";
      card.notes = row.notes || "";
      card.tags = parseTags(row.tags);
      card.updated_at = nowIso();
      try {
        await db.cards.put(userId, card);
        enqueueSync("flashcard_cards", "upsert", card);
        existing.add(key);
        added += 1;
      } catch (err) {
        console.error("Flashcards: failed to import card", err);
        skipped += 1;
      }
    }
    closeModal();
    await refreshData();
    showToast(`${fmtInt(added)} ${t("cards imported", "بطاقات استوردت")}${skipped ? ` · ${fmtInt(skipped)} ${t("skipped", "متخطاة")}` : ""}`);
    return render();
  }

  function downloadText(filename, text, mime) {
    try {
      const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      return true;
    } catch (err) {
      console.error("Flashcards: download failed", err);
      showToast(t("Could not download the file.", "تعذر تنزيل الملف."));
      return false;
    }
  }

  function exportCards(format) {
    const deckId = importTargetDeck && importTargetDeck !== "all" && importTargetDeck !== "__new__" ? importTargetDeck : "";
    const list = (cards || []).filter((card) => card && !card.deleted_at && (!deckId || card.deck_id === deckId));
    if (!list.length) { showToast(t("Nothing to export.", "لا يوجد ما يُصدَّر.")); return; }
    if (format === "json") {
      const payload = { version: 1, exportedAt: nowIso(), decks: (decks || []).filter((d) => d && !d.deleted_at), cards: list };
      downloadText("studyzone-flashcards.json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
      return;
    }
    const rows = list.map((card) => ({
      front: card.front,
      back: card.back,
      notes: card.notes || "",
      example: card.example || "",
      tags: (card.tags || []).join(","),
      difficulty: card.difficulty || "medium",
      source: card.source || "manual",
      deck: card.deck_id,
    }));
    const csv = "\uFEFF" + core.toDelimited(rows, ",");
    downloadText("studyzone-flashcards.csv", csv, "text/csv;charset=utf-8");
  }

  async function saveSettingsFromForm() {
    const readNumber = (id, fallback) => {
      const el = document.getElementById(id);
      const value = Number(el && el.value);
      return Number.isFinite(value) && el && el.value !== "" ? value : fallback;
    };
    const readSteps = (id, fallback) => {
      const el = document.getElementById(id);
      const values = String((el && el.value) || "").split(",").map((value) => Math.round(Number(value))).filter((value) => Number.isFinite(value) && value > 0);
      return values.length ? values : fallback;
    };
    const next = Object.assign({}, settings, {
      new_per_day: readNumber("fc-setting-new", settings.new_per_day),
      reviews_per_day: readNumber("fc-setting-reviews", settings.reviews_per_day),
      daily_goal: readNumber("fc-setting-daily-goal", settings.daily_goal),
      learning_steps: readSteps("fc-setting-learning", settings.learning_steps),
      relearning_steps: readSteps("fc-setting-relearning", settings.relearning_steps),
      graduating_interval: readNumber("fc-setting-graduating", settings.graduating_interval),
      easy_interval: readNumber("fc-setting-easy-interval", settings.easy_interval),
      desired_retention: readNumber("fc-setting-retention", settings.desired_retention),
      reminder: {
        enabled: Boolean((document.getElementById("fc-setting-reminder") || {}).checked),
        time: String((document.getElementById("fc-setting-reminder-time") || {}).value || "19:00"),
        days: [1, 2, 3, 4, 5, 6, 0],
      },
    });
    settings = core.normalizeSettings(next);
    const db = await getDb();
    try {
      await db.settings.put(userId, settings);
      // user_id is the primary key of flashcard_user_settings — do not send an id field.
      enqueueSync("flashcard_user_settings", "upsert", { user_id: userId, payload: { ...settings } });
    } catch (err) {
      console.error("Flashcards: failed to save settings", err);
      showToast(t("Could not save settings.", "تعذر حفظ الإعدادات."));
      return null;
    }
    Object.keys(settingsFormCache).forEach((key) => { delete settingsFormCache[key]; });
    showToast(t("Settings saved.", "تم حفظ الإعدادات."));
    return render();
  }
  // ------------------------------------------------------------------ public API

  function dashboardMiniHtml() {
    const stats = core.buildStats({ reviews, cards, now: new Date(), settings, days: 30 });
    const xp = getXpDisplay(stats);
    return `<div class="fc-mini-dash" role="group" aria-label="${esc(t("Flashcards summary", "ملخص البطاقات"))}">
      <span class="fc-mini-pill">⭐ ${esc(fmtInt(xp.totalXp))} XP</span>
      <span class="fc-mini-pill">🔥 ${esc(fmtInt(xp.currentStreak))} ${esc(t("day streak", "يوم متتالي"))}</span>
      <span class="fc-mini-pill">⏳ ${esc(fmtInt(stats.dueCount))} ${esc(t("due", "مستحقة"))}</span>
    </div>`;
  }

  const api = {
    init: (bridge) => { host = bridge; window.StudyZoneFlashcards = window.StudyZoneFlashcards || {}; window.StudyZoneFlashcards.Api = api; return api; },
    setHost: (next) => { host = next; return api; },
    getHost: () => host,
    getView: () => view,
    getDecks: () => decks || [],
    getCards: () => cards || [],
    getReviews: () => reviews || [],
    getSettings: () => settings,
    getSessionState: () => sessionState,
    getSyncState: () => syncState,
    syncSession: async (sessionValue) => {
      const nextUserId = sessionValue && sessionValue.user ? sessionValue.user.id : null;
      const changed = String(nextUserId || "") !== String(userId || "");
      userId = nextUserId;
      const sync = syncApi();
      if (sync && typeof sync.setSession === "function") {
        try { sync.setSession(nextUserId, hostCall("getSupabase")); } catch (_) { /* best effort */ }
      }
      if (changed) {
        // New account (or signed out): drop local view state, keep nothing leaked.
        xpState = { loading: false, loaded: false, totalXp: 0 };
        xpFetchKey = "";
        decks = null;
        cards = [];
        reviews = [];
        fcUi.deckId = null;
        fcUi.cardId = null;
        browseDeckId = "";
        browsePage = 0;
        browseQuery = "";
        deckQuery = "";
        modal = null;
        sessionState = null;
        await loadAll();
      }
      if (nextUserId) void runSync(true);
      return api;
    },
    shutdown: () => {
      mounted = false;
      detachHotkeys();
      sessionState = null;
      modal = null;
      return api;
    },
    renderPage,
    mount,
    dashboardCard: () => dashboardMiniHtml(),
    openDashboard: () => navigateTo(VIEW.DASHBOARD),
    openDecks: () => navigateTo(VIEW.DECKS),
    openBrowse: () => navigateTo(VIEW.BROWSE),
    openEditor: (cardId) => openModal("card-form", { cardId: cardId || null }),
    openReview: (mode) => startSession(mode || "due"),
    openStats: () => navigateTo(VIEW.STATS),
    openImport: () => openModal("import", {}),
    openSettings: () => navigateTo(VIEW.SETTINGS),
    refreshData,
    startSession,
    rate,
    reveal,
    endSession,
    suspendCurrent,
    setView: (next) => navigateTo(next || VIEW.DASHBOARD),
    render,
  };

  window.StudyZoneFlashcards = api;
  globalThis.StudyZoneFlashcards = api;
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { start: () => ({}) };
}
