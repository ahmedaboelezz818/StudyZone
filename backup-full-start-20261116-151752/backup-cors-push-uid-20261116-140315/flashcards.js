/*
 * Study Zone flashcards UI module.
 *
 * Owns the "Flashcards" section: dashboard, decks, browser, editor, review,
 * statistics, import/export and settings. Reuses the app design tokens, the host
 * bridge from app.js and the pure core module for scheduling and statistics.
 *
 * Design goal (redesign pass): a modern premium look that matches the Study Zone
 * shell (soft borders, layered shadows, generous spacing, readable type), a
 * large centered 3D-flip review card, touch friendly rating buttons with expected
 * intervals, animated progress, charts and motion levels (off/subtle/full) that
 * respect the OS reduced-motion preference.
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

  let host = null;
  let view = VIEW.DASHBOARD;
  let decks = [];
  let cards = [];
  let reviews = [];
  let settings = Object.assign({}, core.DEFAULT_SETTINGS);
  let session = null;
  let userId = null;
  let dbApi = null;
  let sessionState = null;
  let hotkeyDisposers = [];
  let mounted = false;
  let lastRenderedView = VIEW.DASHBOARD;
  let deckQuery = "";
  let browseQuery = "";
  let browseDeckId = "";
  let browsePage = 0;
  let moduleStateChildOpen = {};

  // ------------------------------------------------------------------ host

  function hostCall(name, ...args) {
    if (!host) return undefined;
    const value = host[name];
    return typeof value === "function" ? value.apply(host, args || []) : value;
  }
  function t(en, ar) {
    const lang = hostCall("getLanguage");
    return lang === "ar" ? ar : en;
  }
  function esc(value) {
    const fn = hostCall("escapeHtml");
    return typeof fn === "function" ? fn(value) : String(value == null ? "" : value);
  }
  function fmtInt(value) {
    const num = Math.round(Number(value) || 0);
    return String(num);
  }

  function nowIso() {
    return new Date().toISOString();
  }
  function dayKey(date) {
    return core.dayKey(date instanceof Date ? date : new Date(date));
  }
  function startOfLocalDay(date) {
    return core.startOfLocalDay(date instanceof Date ? date : new Date(date));
  }

  function resolveMotionIntensity() {
    const stored = hostCall("getLocal", "studyflow.flashcards-motion");
    if (stored && ["off", "subtle", "full"].includes(stored)) return stored;
    const preference = hostCall("getMotionPreference");
    if (preference && ["off", "subtle", "full"].includes(preference)) return preference;
    const motion = hostCall("getMotionLevel");
    if (motion && ["off", "subtle", "full"].includes(motion)) return motion;
    return "subtle";
  }
  function motionAllowed(effectId) {
    const shouldAnimate = hostCall("shouldAnimate");
    if (typeof shouldAnimate !== "function") return false;
    return Boolean(shouldAnimate(effectId));
  }
  function motionClass() {
    const level = resolveMotionIntensity();
    if (level === "off" || !motionAllowed("flashcards")) return "is-motion-off";
    if (level === "full") return "is-motion-full";
    return "is-motion-subtle";
  }

  async function getDb() {
    if (!dbApi) dbApi = window.StudyZoneFlashcardsDb;
    return dbApi;
  }

  async function loadAll() {
    const db = await getDb();
    const deckRows = db && db.decks ? await db.decks.list(userId) : [];
    const cardRows = db && db.cards ? await db.cards.list(userId, {}) : [];
    const reviewRows = db && db.reviews ? await db.reviews.list(userId) : [];
    const settingsRow = db && db.settings ? await db.settings.get(userId) : null;
    decks = (deckRows || []).filter((deck) => deck && !deck.deleted_at);
    cards = (cardRows || []).filter((card) => card && !card.deleted_at);
    reviews = reviewRows || [];
    const stored = settingsRow ? (settingsRow.payload || settingsRow) : null;
    settings = Object.assign({}, core.normalizeSettings(stored), { reminder: stored && stored.reminder });
    return { decks, cards, reviews, settings };
  }

  async function refreshData() {
    await loadAll();
    return null;
  }

  function readEditorForm() {
    const get = (id) => (document.getElementById(id) || {}).value || "";
    const type = get("fc-editor-type") || "basic";
    const tags = get("fc-editor-tags").split(",").map((s) => s.trim()).filter(Boolean);
    const hints = get("fc-editor-hints").split("\n").map((s) => s.trim()).filter(Boolean);
    const choicesRaw = get("fc-editor-choices");
    const choices = choicesRaw ? choicesRaw.split("\n").map((s) => s.trim()).filter(Boolean) : [];
    return {
      deck_id: get("fc-editor-deck"),
      type,
      front: get("fc-editor-front"),
      back: get("fc-editor-back"),
      explanation: get("fc-editor-explanation"),
      hints,
      tags,
      notes: get("fc-editor-notes"),
      cloze: get("fc-editor-cloze"),
      choices,
      correct_choice: Math.max(1, Number(get("fc-editor-correct-choice")) || 1),
    };
  }

  async function createDeckFlow() {
    const name = (typeof prompt === "function" ? prompt(t("Deck name", "اسم الجهد")) : "") || "";
    const trimmed = String(name || "").trim();
    if (!trimmed) return false;
    if (!userId) {
      if (hostCall("showToast")) hostCall("showToast", t("Please sign in to create a deck.", "يرجى تسجيل الدخول لإنشاء جهد."));
      return false;
    }
    const db = await getDb();
    if (!db || !db.decks) return false;
    const makeId = (core && typeof core.uid === "function")
      ? core.uid
      : (p) => `${p || "id"}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    const deck = { id: makeId("deck"), name: trimmed, description: "", color: "#6ee7b7", icon: "", parent_id: null, user_id: userId, created_at: nowIso(), updated_at: nowIso(), deleted_at: null };
    await db.decks.put(userId, deck);
    session = session || {};
    session.deckId = deck.id;
    browseDeckId = deck.id;
    await refreshData();
    return true;
  }

  async function renameDeckFlow(deckId) {
    const deck = (decks || []).find((item) => item && item.id === deckId);
    if (!deck) return false;
    const name = (typeof prompt === "function" ? prompt(t("Deck name", "اسم الجهد"), deck.name || "") : "") || "";
    const trimmed = String(name || "").trim();
    if (!trimmed) return false;
    const db = await getDb();
    if (!db || !db.decks) return false;
    await db.decks.put(userId, { ...deck, name: trimmed, updated_at: nowIso() });
    await refreshData();
    return true;
  }

  // ------------------------------------------------------------------ helpers

  function deckName(id) {
    const deck = (decks || []).find((item) => item && item.id === id);
    return deck ? esc(deck.name) : esc(String(id || ""));
  }
  function subjectName(id) {
    const subjects = hostCall("getSubjects") || [];
    const subject = (subjects || []).find((item) => item && item.id === id);
    return subject ? esc(subject.name || subject.id) : esc(String(id || ""));
  }
  function noteCount(deckId) {
    return (cards || []).filter((card) => card && card.deck_id === deckId && !card.deleted_at).length;
  }
  function cardCount(deckId) {
    return (cards || []).filter((card) => card && card.deck_id === deckId && !card.deleted_at).length;
  }

  function greeting() {
    const hour = new Date().getHours();
    const key = hour < 12 ? "morning" : hour < 18 ? "day" : "evening";
    const en = { morning: "Good morning", day: "Good day", evening: "Good evening" }[key];
    const ar = { morning: "صباح الخير", day: "يوم سعيد", evening: "مساء الخير" }[key];
    return { en, ar };
  }

  function greetingText() {
    const g = greeting();
    const lang = hostCall("getLanguage");
    return lang === "ar" ? g.ar : g.en;
  }

  // ------------------------------------------------------------------ dashboard

  // Synchronous-only dashboard render: never interpolate a Promise into HTML.
  let flashcardXpState = { loading: false, loaded: false, totalXp: 0, level: 1, error: "" };
  let flashcardXpFetchKey = "";

  function safeNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function computeLocalBestStreak(reviewRows) {
    const days = new Set();
    (reviewRows || []).forEach((r) => {
      const key = r && (r.local_day || (r.reviewed_at ? dayKey(r.reviewed_at) : ""));
      if (key) days.add(String(key));
    });
    if (!days.size) return 0;
    const sorted = Array.from(days).sort();
    let best = 1;
    let run = 1;
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = new Date(`${sorted[i - 1]}T00:00:00`);
      const curr = new Date(`${sorted[i]}T00:00:00`);
      const diff = Math.round((curr - prev) / MS_PER_DAY);
      if (diff === 1) { run += 1; } else { run = 1; }
      if (run > best) best = run;
    }
    return best;
  }

  function computeLocalLevelFromXp(totalXp) {
    const xp = Math.max(0, Math.floor(safeNumber(totalXp, 0)));
    // Simple, local-only fallback: 100 XP per level, minimum level 1.
    return Math.max(1, Math.floor(xp / 100) + 1);
  }

  function getFlashcardXpDisplay(stats) {
    const totalXp = flashcardXpState.loaded ? safeNumber(flashcardXpState.totalXp, 0) : 0;
    const level = flashcardXpState.loaded ? safeNumber(flashcardXpState.level, computeLocalLevelFromXp(totalXp)) : computeLocalLevelFromXp(totalXp);
    const currentStreak = safeNumber(stats && stats.streak, 0);
    const bestStreak = computeLocalBestStreak(reviews);
    const cardsReviewed = (reviews || []).length;
    const dailyReviews = safeNumber(stats && stats.reviewsToday, 0);
    const goal = Math.max(1, safeNumber(settings && settings.daily_goal, 20));
    const reviewProgress = Math.min(100, Math.round((dailyReviews / goal) * 100));
    return { totalXp, level, currentStreak, bestStreak, cardsReviewed, dailyReviews, reviewProgress, goal, loading: flashcardXpState.loading };
  }

  async function loadFlashcardXpIfNeeded() {
    if (flashcardXpState.loading || flashcardXpState.loaded) return;
    if (!userId) {
      flashcardXpState = { loading: false, loaded: true, totalXp: 0, level: 1, error: "" };
      return;
    }
    const sb = hostCall("getSupabase");
    if (!sb || typeof sb.from !== "function") {
      flashcardXpState = { loading: false, loaded: true, totalXp: 0, level: 1, error: "" };
      return;
    }
    const key = String(userId || "");
    if (key && flashcardXpFetchKey === key && flashcardXpState.loaded) return;
    flashcardXpFetchKey = key;
    flashcardXpState.loading = true;
    try {
      // Read Flashcards XP separately from public.user_xp (tasks/daily XP).
      // Source of truth for current schema: sum of public.flashcard_xp_awards.
      // (Avoid querying optional tables that may not exist and cause 400s.)
      let totalXp = 0;
      let level = 1;

      try {
        const res = await sb.from("flashcard_xp_awards").select("amount").eq("user_id", userId);
        if (!res.error && Array.isArray(res.data)) {
          totalXp = res.data.reduce((sum, row) => sum + safeNumber(row && row.amount, 0), 0);
          level = computeLocalLevelFromXp(totalXp);
        }
      } catch (_) { /* offline / table unavailable -> keep safe defaults */ }

      flashcardXpState = { loading: false, loaded: true, totalXp, level: Math.max(1, Math.floor(level)), error: "" };
    } catch (_) {
      flashcardXpState = { loading: false, loaded: true, totalXp: 0, level: 1, error: "" };
    }
    // Re-render once when async data arrives; guard against stale view.
    try {
      if (view === VIEW.DASHBOARD || view === VIEW.STATS) render();
    } catch (_) { /* no-op */ }
  }

  function dashboardHtml() {
    const stats = core.buildStats({ reviews, cards, now: new Date(), settings, days: 30 });
    const xp = getFlashcardXpDisplay(stats);
    // Fire-and-forget async load; never render the Promise itself.
    void loadFlashcardXpIfNeeded();
    const recentDecks = (decks || []).slice().sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || ""))).slice(0, 5);
    const todayReviews = stats.reviewsToday;
    const progress = Math.min(100, Math.round((todayReviews / Math.max(1, settings.daily_goal || 1)) * 100));
    const quickStart = `<button type="button" class="button button-primary button-medium" data-action="fc-start-due">${esc(t("Quick start review", "مراجعة سريعة"))}</button>` +
      `<button type="button" class="button button-secondary button-medium" data-action="fc-open-decks">${esc(t("Create new deck", "بناء جهد جديد"))}</button>`;
    const deckCards = recentDecks.map((deck) => {
      const dueCount = (cards || []).filter((card) => card && card.deck_id === deck.id && !card.deleted_at && new Date(card.due_at).getTime() <= Date.now()).length;
      const total = cardCount(deck.id);
      const reviewed = Math.max(0, total - (cards || []).filter((card) => card && card.deck_id === deck.id && card.state === "new" && !card.deleted_at).length);
      const pct = total ? Math.round(((total - (cards || []).filter((card) => card && card.deck_id === deck.id && card.state === "new" && !card.deleted_at).length) / total) * 100) : 0;
      return `<article class="fc-deck-card" data-deck-id="${esc(deck.id)}">
        <span class="fc-deck-swatch" style="background:${esc(deck.color || "#6ee7b7")}"></span>
        <div class="fc-deck-card-main">
          <strong dir="auto">${esc(deck.name)}</strong>
          <small dir="auto">${esc(t("cards", "بطاقات"))}: ${fmtInt(total)} · ${esc(t("due", "متأخر"))}: ${fmtInt(dueCount)} · ${esc(t("reviewed", "تمت مراجعتها"))}: ${fmtInt(reviewed)}</small>
          <div class="fc-progress fc-progress-sm"><div class="fc-progress-fill" style="width:${fmtInt(pct)}%"></div></div>
        </div>
        <button type="button" class="button button-secondary button-small" data-action="fc-open-deck" data-deck-id="${esc(deck.id)}">${esc(t("Open", "فتح"))}</button>
      </article>`;
    }).join("");
    const recent = deckCards || `<div class="fc-empty-state"><div class="fc-empty-icon" aria-hidden="true">🗂</div><p>${esc(t("No decks yet. Create your first deck to start studying.", "لا توجد جواهر بعد. ابدأ ببناء جهدك الأول."))}</p></div>`;
    const statCards = [
      { label: t("Total Flashcards XP", "إجمالي XP للبطاقات"), value: xp.loading ? "…" : fmtInt(xp.totalXp), icon: "⭐" },
      { label: t("Current Level", "المستوى الحالي"), value: fmtInt(xp.level), icon: "🏅" },
      { label: t("Current Streak", "السلسلة الحالية"), value: fmtInt(xp.currentStreak), icon: "🔥" },
      { label: t("Best Streak", "أفضل سلسلة"), value: fmtInt(xp.bestStreak), icon: "📈" },
      { label: t("Cards Reviewed", "البطاقات المراجعة"), value: fmtInt(xp.cardsReviewed), icon: "🧠" },
      { label: t("Daily Reviews", "مراجعات اليوم"), value: fmtInt(xp.dailyReviews), icon: "✅" },
      { label: t("Review Progress", "تقدم المراجعة"), value: `${fmtInt(xp.reviewProgress)}%`, icon: "📊" },
      { label: t("Due now", "متأخر الآن"), value: stats.dueCount, icon: "⏳" },
      { label: t("New available", "جديد متاح"), value: stats.newAvailableCount, icon: "✨" },
      { label: t("Total cards", "إجمالي البطاقات"), value: (cards || []).filter((c) => !c.deleted_at).length, icon: "🗂" },
    ];
    const statsHtml = statCards.map((item) => `<div class="sz-card fc-stat-card">
      <div class="fc-stat-icon" aria-hidden="true">${esc(item.icon)}</div>
      <div class="fc-stat-value">${esc(String(item.value))}</div>
      <small>${esc(item.label)}</small>
    </div>`).join("");
    const hour = new Date().getHours();
    const hourKey = hour < 5 ? "night" : hour < 12 ? "morning" : hour < 18 ? "day" : "evening";
    const hourText = t(
      { night: "Rest well and study tomorrow.", morning: "Your flashcards are ready when you are.", day: "Focus beats repetition.", evening: "Review the day with calm intent." }[hourKey],
      { night: "استرح جيدًا وادرس غدًا.", morning: "البطاقات جاهزة عندما تكون مستعدًا.", day: "التركيز يتفوق على التكرار.", evening: "راجع يومك بنية هادئة." }[hourKey],
    );
    return `<section class="fc-view ${motionClass()}" data-fc-view="dashboard">
      <header class="fc-hero">
        <p class="fc-kicker">${esc(t("Spaced repetition", "التكرار المتباعد"))}</p>
        <h1>${esc(t("Flashcards", "بطاقات"))}</h1>
        <p class="fc-hero-greeting">${esc(greetingText())}</p>
        <p class="fc-sub">${esc(t("Real spaced repetition, saved offline, synced when you return.", "تكرار متباعد حقيقي، محفوظ offline، ومزامن عند عودة الاتصال."))}</p>
        <p class="fc-hero-hour">${esc(hourText)}</p>
        <div class="fc-hero-actions">${quickStart}</div>
      </header>
      <div class="fc-grid">${statsHtml}</div>
      <div class="sz-card fc-today">
        <div class="fc-today-head">
          <h2>${esc(t("Today's study load", "عبء دراستك اليوم"))}</h2>
          <span class="fc-today-count">${esc(fmtInt(todayReviews))}<small> / ${esc(fmtInt(settings.daily_goal || 0))}</small></span>
        </div>
        <div class="fc-progress" role="progressbar" aria-valuenow="${esc(fmtInt(progress))}" aria-valuemin="0" aria-valuemax="100"><div class="fc-progress-fill" style="width:${esc(String(progress))}%"></div></div>
        <p class="fc-today-meta">${esc(t("Reviews today", "مراجعات اليوم"))}: <strong>${esc(fmtInt(todayReviews))}</strong> · ${esc(t("Daily goal", "الهدف اليومي"))}: <strong>${esc(fmtInt(settings.daily_goal || 0))}</strong></p>
        <div class="fc-hero-actions">${quickStart}</div>
      </div>
      <div class="sz-card">
        <div class="fc-card-head"><h2>${esc(t("Recent decks", "أحدث الجواهر"))}</h2><button type="button" class="button button-quiet button-small" data-action="fc-open-decks">${esc(t("All decks", "كل الجواهر"))}</button></div>
        ${recent}
      </div>
    </section>`;
  }

  // ------------------------------------------------------------------ decks

  function decksHtml() {
    const query = String(deckQuery || "").trim().toLowerCase();
    const list = (decks || []).filter((deck) => deck && !deck.deleted_at && (!query || String(deck.name || "").toLowerCase().includes(query)));
    const groups = [];
    list.forEach((deck) => groups.push({ deck, children: list.filter((item) => item.parent_id === deck.id) }));
    const deckCardsHtml = groups.map(({ deck, children }) => {
      const dueCount = (cards || []).filter((card) => card && card.deck_id === deck.id && !card.deleted_at && new Date(card.due_at).getTime() <= Date.now()).length;
      const total = cardCount(deck.id);
      const newCount = (cards || []).filter((card) => card && card.deck_id === deck.id && !card.deleted_at && card.state === "new").length;
      const pct = total ? Math.round(((total - newCount) / total) * 100) : 0;
      const openChildren = !moduleStateChildOpen[deck.id];
      const childrenHtml = openChildren ? children.slice().sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)).map((child) => {
        const childDue = (cards || []).filter((card) => card && card.deck_id === child.id && !card.deleted_at && new Date(card.due_at).getTime() <= Date.now()).length;
        const childTotal = cardCount(child.id);
        const childPct = childTotal ? Math.round(((childTotal - (cards || []).filter((card) => card && card.deck_id === child.id && !card.deleted_at && card.state === "new").length) / childTotal) * 100) : 0;
        return `<button type="button" class="fc-subdeck" data-action="fc-toggle-subdeck" data-deck-id="${esc(deck.id)}">
          <span class="fc-subdeck-name">${esc(child.name)}</span>
          <span class="fc-subdeck-meta">${fmtInt(childDue)} ${esc(t("due", "متأخر"))}</span>
          <span class="fc-progress fc-progress-xs"><span class="fc-progress-fill" style="width:${fmtInt(childPct)}%"></span></span>
        </button>`;
      }).join("") : "";
      const actionButtons = `<button type="button" class="button button-primary button-small" data-action="fc-start-deck" data-deck-id="${esc(deck.id)}">${esc(t("Study", "دراسة"))}</button>
        <button type="button" class="button button-secondary button-small" data-action="fc-open-deck" data-deck-id="${esc(deck.id)}">${esc(t("Browse", "تصفح"))}</button>
        <button type="button" class="button button-quiet button-small" data-action="fc-rename-deck" data-deck-id="${esc(deck.id)}">${esc(t("Edit", "تعديل"))}</button>
        <button type="button" class="button button-quiet button-small" data-action="fc-delete-deck" data-deck-id="${esc(deck.id)}">${esc(t("Delete", "حذف"))}</button>`;
      return `<article class="sz-card fc-deck-card" data-deck-id="${esc(deck.id)}">
        <span class="fc-deck-swatch" style="background:${esc(deck.color || "#6ee7b7")}"></span>
        <div class="fc-deck-card-main">
          <div class="fc-deck-title"><strong dir="auto">${esc(deck.name)}</strong>${deck.parent_id ? `<small>${esc(t("under", "تحت"))} ${esc(deckName(deck.parent_id))}</small>` : ""}</div>
          <small dir="auto">${esc(t("cards", "بطاقات"))}: ${fmtInt(total)} · ${esc(t("new", "جديد"))}: ${fmtInt(newCount)} · ${esc(t("due", "متأخر"))}: ${fmtInt(dueCount)}</small>
          <div class="fc-progress fc-progress-sm"><div class="fc-progress-fill" style="width:${fmtInt(pct)}%"></div></div>
        </div>
        <div class="fc-row-actions">${actionButtons}</div>
        ${childrenHtml ? `<div class="fc-subdecks">${childrenHtml}</div>` : ""}
      </article>`;
    }).join("");
    const hasDecks = (decks || []).length > 0;
    const empty = !hasDecks
      ? `<div class="fc-empty-state"><div class="fc-empty-icon" aria-hidden="true">🗂️</div><p>${esc(t("No decks yet. Create your first deck to start studying.", "لا توجد جواهر بعد. ابدأ ببناء جهدك الأول."))}</p><button type="button" class="button button-primary button-medium" data-action="fc-new-deck">${esc(t("Create deck", "بناء جهد"))}</button></div>`
      : (!deckCardsHtml ? `<p class="fc-empty">${esc(t("No decks match your search.", "لا توجد جواهر تطابق بحثك."))}</p>` : "");
    return `<section class="fc-view ${motionClass()}" data-fc-view="decks">
      <header class="fc-hero">
        <p class="fc-kicker">${esc(t("Deck management", "إدارة الجواهر"))}</p>
        <h1>${esc(t("Your decks", "جواهرك"))}</h1>
        <div class="fc-hero-actions"><input id="fc-deck-search" class="fc-input" placeholder="${esc(t("Search decks", "ابحث في الجواهر"))}" value="${esc(deckQuery)}" /><button type="button" class="button button-primary" data-action="fc-new-deck">${esc(t("New deck", "جهد جديد"))}</button></div>
      </header>
      <div class="fc-deck-grid">${deckCardsHtml || empty}</div>
    </section>`;
  }

  // ------------------------------------------------------------------ browse

  function browseHtml() {
    const list = (cards || []).filter((card) => card && !card.deleted_at);
    const query = String(browseQuery || "").trim().toLowerCase();
    const filtered = query ? list.filter((card) => String(card.front || "").toLowerCase().includes(query) || String(card.back || "").toLowerCase().includes(query)) : list;
    const deckCards = (decks || []).filter((deck) => deck && !deck.deleted_at);
    const selected = browseDeckId || (session && session.deckId) || deckCards[0]?.id || "";
    const scoped = selected ? filtered.filter((card) => card.deck_id === selected) : filtered;
    const pageSize = 12;
    const page = Math.max(0, browsePage);
    const pageCards = scoped.slice(page * pageSize, (page + 1) * pageSize);
    const rowsHtml = pageCards.map((card) => `<article class="sz-card fc-card-row" data-card-id="${esc(card.id)}">
      <div class="fc-card-row-main">
        <div class="fc-card-row-front"><strong dir="auto">${esc(card.front)}</strong></div>
        <div class="fc-card-row-back"><span dir="auto">${esc(card.back)}</span></div>
        <small>${esc(t("state", "الحالة"))}: ${esc(card.state)} · ${esc(t("interval", "الفترة"))}: ${esc(fmtInt(card.interval_days))}d</small>
      </div>
      <div class="fc-row-actions">
        <button type="button" class="button button-secondary button-small" data-action="fc-edit-card" data-card-id="${esc(card.id)}">${esc(t("Edit", "تعديل"))}</button>
        <button type="button" class="button button-quiet button-small" data-action="fc-delete-card" data-card-id="${esc(card.id)}">${esc(t("Delete", "حذف"))}</button>
      </div>
    </article>`).join("");
    const pager = `<div class="fc-pager">
      <button type="button" class="button button-secondary button-small" data-action="fc-browse-prev" ${page <= 0 ? "disabled" : ""}>${esc(t("Prev", "سابق"))}</button>
      <span>${esc(fmtInt(page + 1))} / ${esc(fmtInt(Math.max(1, Math.ceil(scoped.length / pageSize))))}</span>
      <button type="button" class="button button-secondary button-small" data-action="fc-browse-next" ${page >= Math.max(0, Math.ceil(scoped.length / pageSize) - 1) ? "disabled" : ""}>${esc(t("Next", "التالي"))}</button>
    </div>`;
    const deckSelect = `<select id="fc-browse-deck" class="fc-input" data-fc-deck-select>
      ${deckCards.map((deck) => `<option value="${esc(deck.id)}" ${deck.id === selected ? "selected" : ""}>${esc(deck.name)}</option>`).join("")}
    </select>`;
    return `<section class="fc-view ${motionClass()}" data-fc-view="browse">
      <header class="fc-hero">
        <p class="fc-kicker">${esc(t("Card browser", "متصفح البطاقات"))}</p>
        <h1>${esc(t("Browse cards", "تصفح البطاقات"))}</h1>
        <div class="fc-hero-actions">${deckSelect}<input id="fc-browse-search" class="fc-input" placeholder="${esc(t("Search cards", "ابحث في البطاقات"))}" value="${esc(browseQuery)}" /></div>
      </header>
      <div class="sz-card">${rowsHtml || `<p class="fc-empty">${esc(t("No cards in this deck yet.", "لا توجد بطاقات في هذا الجهد بعد."))}</p>`}${pager}</div>
    </section>`;
  }

  // ------------------------------------------------------------------ editor

  function editorHtml() {
    const cardId = (session && session.cardId) || null;
    const card = cardId ? (cards || []).find((item) => item && item.id === cardId) : null;
    const draft = editorDraft && (!editorDraft.cardId || editorDraft.cardId === cardId) ? editorDraft : null;
    const deckId = (draft && draft.deck_id) || (card && card.deck_id) || (session && session.deckId) || (decks || [])[0]?.id || "";
    const type = (draft && draft.type) || (card && card.type) || "basic";
    const front = (draft && draft.front) != null ? draft.front : ((card && card.front) || "");
    const back = (draft && draft.back) != null ? draft.back : ((card && card.back) || "");
    const tags = (draft && draft.tags) || (card && card.tags) || [];
    const hints = (draft && draft.hints) || (card && card.hints) || [];
    const notes = (draft && draft.notes) != null ? draft.notes : ((card && card.notes) || "");
    const cloze = (draft && draft.cloze) != null ? draft.cloze : ((card && card.cloze) || "");
    const choices = (draft && draft.choices) || (card && card.choices) || [];
    const correctChoice = (draft && draft.correct_choice) || (card && card.correct_choice) || 1;
    const explanation = (draft && draft.explanation) != null ? draft.explanation : ((card && card.explanation) || "");
    const preview = `<div class="fc-preview ${motionClass()}">
        <div class="fc-preview-face fc-preview-front"><span>${esc(front)}</span></div>
        <div class="fc-preview-face fc-preview-back"><span>${esc(back)}</span></div>
      </div>`;
    const typeOptions = [
      ["basic", t("Basic", "أساسي")],
      ["basic_reversed", t("Basic (reversed)", "أساسي (معكوس)")],
      ["basic_optional_reversed", t("Basic (optional reversed)", "أساسي (معكوس اختياري)")],
      ["cloze", t("Cloze deletion", "حذف الكلمات")],
      ["multiple_choice", t("Multiple choice", "متعدد الخيارات")],
      ["image", t("Image based", "مبني على الصورة")],
      ["audio", t("Audio vocabulary", "مفردات صوتية")],
    ].map(([value, label]) => `<option value="${value}" ${value === type ? "selected" : ""}>${esc(label)}</option>`).join("");
    const tagText = Array.isArray(tags) ? tags.join(",") : String(tags || "");
    const hintsText = Array.isArray(hints) ? hints.join("\n") : String(hints || "");
    const choiceInputs = (choices || []).map((choice, index) => `<input class="fc-input" data-fc-choice="${index}" value="${esc(choice)}" />`).join("");
    const clozeField = type === "cloze" ? `<label class="fc-label">${esc(t("Cloze text", "نص الحذف"))}</label><textarea id="fc-editor-cloze" class="fc-input" rows="2">${esc(cloze)}</textarea>` : "";
    const choicesField = type === "multiple_choice" ? `<label class="fc-label">${esc(t("Choices (one per line)", "الخيارات (واحدة في كل سطر)"))}</label><textarea id="fc-editor-choices" class="fc-input" rows="4">${choiceInputs}</textarea><label class="fc-label">${esc(t("Correct choice (number, 1 based)", "الاختيار الصحيح (الرقم، من 1)"))}</label><input id="fc-editor-correct-choice" class="fc-input" type="number" min="1" value="${esc(String(correctChoice || 1))}" />` : "";
    const title = cardId ? t("Edit card", "تعديل البطاقة") : t("Create card", "إنشاء بطاقة");
    return `<section class="fc-view ${motionClass()}" data-fc-view="editor">
      <header class="fc-hero">
        <p class="fc-kicker">${esc(t("Card editor", "محرر البطاقات"))}</p>
        <h1>${esc(title)}</h1>
      </header>
      <div class="fc-grid fc-grid-2">
        <div class="sz-card">
          <label class="fc-label">${esc(t("Deck", "الجهد"))}</label>
          <select id="fc-editor-deck" class="fc-input" data-fc-editor-deck>${(decks || []).filter((d) => d && !d.deleted_at).map((deck) => `<option value="${esc(deck.id)}" ${deck.id === deckId ? "selected" : ""}>${esc(deck.name || deck.id || "")}</option>`).join("") || `<option value="">${esc(t("No decks yet", "لا توجد جواهر بعد"))}</option>`}</select>
          <label class="fc-label">${esc(t("Card type", "نوع البطاقة"))}</label>
          <select id="fc-editor-type" class="fc-input" data-fc-editor-type>${typeOptions}</select>
          <label class="fc-label">${esc(t("Front / question", "السؤال"))}</label>
          <textarea id="fc-editor-front" class="fc-input" rows="4">${esc(front)}</textarea>
          <label class="fc-label">${esc(t("Back / answer", "الإجابة"))}</label>
          <textarea id="fc-editor-back" class="fc-input" rows="4">${esc(back)}</textarea>
          <label class="fc-label">${esc(t("Explanation", "التفسير"))}</label>
          <textarea id="fc-editor-explanation" class="fc-input" rows="2">${esc(explanation)}</textarea>
          <label class="fc-label">${esc(t("Hints", "التلميحات"))}</label>
          <textarea id="fc-editor-hints" class="fc-input" rows="2">${esc(hintsText)}</textarea>
          <label class="fc-label">${esc(t("Tags (comma separated)", "الوسوم (مفصولة بفاصلة)"))}</label>
          <input id="fc-editor-tags" class="fc-input" value="${esc(tagText)}" />
          <label class="fc-label">${esc(t("Notes", "ملاحظات"))}</label>
          <textarea id="fc-editor-notes" class="fc-input" rows="2">${esc(notes)}</textarea>
          ${clozeField}
          ${choicesField}
          <div class="fc-hero-actions">
            <button type="button" class="button button-primary" data-action="fc-save-card">${esc(t("Save card", "حفظ البطاقة"))}</button>
            <button type="button" class="button button-secondary" data-action="fc-cancel-edit">${esc(t("Cancel", "إلغاء"))}</button>
          </div>
        </div>
        <div class="sz-card">${preview}</div>
      </div>
    </section>`;
  }

  // ------------------------------------------------------------------ stats

  function statsHtml() {
    const stats = core.buildStats({ reviews, cards, now: new Date(), settings, days: 30 });
    const retentionTrend = stats.retentionTrend || [];
    const forecastTotal = (stats.forecast && stats.forecast.total) || 0;
    const html = `<section class="fc-view ${motionClass()}" data-fc-view="stats">
      <header class="fc-hero">
        <p class="fc-kicker">${esc(t("Statistics", "الإحصائيات"))}</p>
        <h1>${esc(t("Learning analytics", "تحليلات التعلم"))}</h1>
      </header>
      <div class="fc-grid fc-grid-2">
        <div class="sz-card">
          <div class="fc-card-head"><h2>${esc(t("Retention trend", "اتجاه الاحتفاظ"))}</h2></div>
          <div class="fc-chart">${retentionTrend.map((point) => `<div class="fc-chart-row"><span>${esc(point.key)}</span><div class="fc-chart-bar"><div class="fc-chart-fill" style="width:${esc(String(Math.round((point.retention || 0) * 100)))}%"></div></div><small>${esc(String(Math.round((point.retention || 0) * 100)))}%</small></div>`).join("")}</div>
        </div>
        <div class="sz-card">
          <h2>${esc(t("Upcoming forecast", "التوقعات القادمة"))}</h2>
          <p>${esc(fmtInt(forecastTotal))} ${esc(t("cards due in the next", "بطاقات متأخرة في"))} 30 ${esc(t("days", "أيام"))}.</p>
        </div>
        <div class="sz-card">
          <h2>${esc(t("Difficult cards", "أصعب البطاقات"))}</h2>
          <ul class="fc-list">${stats.difficultCards.map((entry) => `<li>${esc(entry.card.front)} — ${esc(fmtInt(entry.card.lapses))} ${esc(t("lapses", "تعثرات"))}</li>`).join("") || `<li>${esc(t("No difficult cards yet.", "لا توجد بطاقات صعبة بعد."))}</li>`}</ul>
        </div>
        <div class="sz-card">
          <h2>${esc(t("Mature cards", "البطاقات المتقدمة"))}</h2>
          <p>${esc(fmtInt(stats.matureCards.length))}</p>
        </div>
        <div class="sz-card">
          <h2>${esc(t("Rating distribution", "توزيع التقييمات"))}</h2>
          <div class="fc-chart">
            <div class="fc-chart-row"><span>${esc(t("Again", "مرة أخرى"))}</span><div class="fc-chart-bar"><div class="fc-chart-fill" style="width:${esc(String(Math.round((stats.distribution?.again || 0) / Math.max(1, stats.totalReviews || 1) * 100)))}%"></div></div><small>${esc(fmtInt(stats.distribution?.again || 0))}</small></div>
            <div class="fc-chart-row"><span>${esc(t("Hard", "صعب"))}</span><div class="fc-chart-bar"><div class="fc-chart-fill" style="width:${esc(String(Math.round((stats.distribution?.hard || 0) / Math.max(1, stats.totalReviews || 1) * 100)))}%"></div></div><small>${esc(fmtInt(stats.distribution?.hard || 0))}</small></div>
            <div class="fc-chart-row"><span>${esc(t("Good", "جيد"))}</span><div class="fc-chart-bar"><div class="fc-chart-fill" style="width:${esc(String(Math.round((stats.distribution?.good || 0) / Math.max(1, stats.totalReviews || 1) * 100)))}%"></div></div><small>${esc(fmtInt(stats.distribution?.good || 0))}</small></div>
            <div class="fc-chart-row"><span>${esc(t("Easy", "سهل"))}</span><div class="fc-chart-bar"><div class="fc-chart-fill" style="width:${esc(String(Math.round((stats.distribution?.easy || 0) / Math.max(1, stats.totalReviews || 1) * 100)))}%"></div></div><small>${esc(fmtInt(stats.distribution?.easy || 0))}</small></div>
          </div>
        </div>
      </div>
    </section>`;
    return html;
  }

  // ------------------------------------------------------------------ import

  function importHtml() {
    const exportDeckId = (session && session.deckId) || (decks || [])[0]?.id || "";
    const exportRows = (cards || []).filter((card) => card && !card.deleted_at && (!exportDeckId || card.deck_id === exportDeckId));
    const csv = core.toDelimited(exportRows.map((card) => ({ front: card.front, back: card.back, deck: card.deck_id, tags: (card.tags || []).join(",") })), ",");
    const jsonPayload = { version: 1, exportedAt: nowIso(), decks, cards: exportRows };
    const exportText = JSON.stringify(jsonPayload, null, 2);
    return `<section class="fc-view ${motionClass()}" data-fc-view="import">
      <header class="fc-hero"><p class="fc-kicker">${esc(t("Backup", "نسخة احفظ"))}</p><h1>${esc(t("Import & export", "استيراد وتصدير"))}</h1></header>
      <div class="fc-grid fc-grid-2">
        <div class="sz-card fc-stack"><h2>${esc(t("Export JSON", "تصدير JSON"))}</h2><textarea id="fc-export-json" class="fc-input" rows="8">${esc(exportText)}</textarea></div>
        <div class="fc-stack"><h2>${esc(t("Export CSV", "تصدير CSV"))}</h2><textarea id="fc-export-csv" class="fc-input" rows="6">${esc(csv)}</textarea></div>
      </div>
      <div class="sz-card fc-stack">
        <h2>${esc(t("Import CSV", "استيراد CSV"))}</h2>
        <textarea id="fc-import-csv" class="fc-input" rows="6" placeholder="front,back,deck,tags"></textarea>
        <div class="fc-hero-actions"><button type="button" class="button button-primary" data-action="fc-import-csv">${esc(t("Import CSV", "استيراد CSV"))}</button></div>
      </div>
    </section>`;
  }

  // ------------------------------------------------------------------ settings

  function settingsHtml() {
    const reminder = (settings && settings.reminder) || { enabled: false, time: "19:00", days: [1, 2, 3, 4, 5, 6, 0] };
    const intensity = resolveMotionIntensity();
    const dailyGoal = settings.daily_goal;
    const html = `<section class="fc-view ${motionClass()}" data-fc-view="settings">
      <header class="fc-hero"><p class="fc-kicker">${esc(t("Preferences", "التفضيلات"))}</p><h1>${esc(t("Flashcards settings", "إعدادات البطاقات"))}</h1></header>
      <div class="fc-grid fc-grid-2">
        <div class="sz-card fc-stack">
          <h2>${esc(t("Daily limits", "الحدود اليومية"))}</h2>
          <label class="fc-label">${esc(t("New cards per day", "بطاقات جديدة في اليوم"))}</label>
          <input id="fc-setting-new" class="fc-input" type="number" min="0" max="999" value="${esc(String(settings.new_per_day || 0))}"/>
          <label class="fc-label">${esc(t("Reviews per day", "مراجعات في اليوم"))}</label>
          <input id="fc-setting-reviews" class="fc-input" type="number" min="0" max="9999" value="${esc(String(settings.reviews_per_day || 0))}"/>
          <label class="fc-label">${esc(t("Daily goal", "الهدف اليومي"))}</label>
          <input id="fc-setting-goal" class="fc-input" type="number" min="0" max="999" value="${esc(String(dailyGoal || 0))}"/>
          <label class="fc-label">${esc(t("Learning steps (minutes)", "خطوات التعلم (بالدقائق)"))}</label>
          <input id="fc-setting-learning" class="fc-input" value="${esc((settings.learning_steps || [1, 10]).join(","))}"/>
          <label class="fc-label">${esc(t("Relearning steps (minutes)", "خطوات إعادة التعلم (بالدقائق)"))}</label>
          <input id="fc-setting-relearning" class="fc-input" value="${esc((settings.relearning_steps || [10]).join(","))}"/>
          <label class="fc-label">${esc(t("Graduating interval (days)", "فترة التخرج (أيام)"))}</label>
          <input id="fc-setting-graduating" class="fc-input" type="number" min="1" max="90" value="${esc(String(settings.graduating_interval || 1))}"/>
          <label class="fc-label">${esc(t("Easy interval (days)", "فترة السهل (أيام)"))}</label>
          <input id="fc-setting-easy-interval" class="fc-input" type="number" min="1" max="90" value="${esc(String(settings.easy_interval || 4))}"/>
          <label class="fc-label">${esc(t("Desired retention", "الاحتفاظ المطلوب"))}</label>
          <input id="fc-setting-retention" class="fc-input" type="number" min="0.1" max="0.99" step="0.05" value="${esc(String(settings.desired_retention || 0.9))}"/>
          <label class="fc-label">${esc(t("Daily study goal", "الهدف اليومي للمذاكرة"))}</label>
          <input id="fc-setting-daily-goal" class="fc-input" type="number" min="1" max="999" value="${esc(String(settings.daily_goal || 20))}"/>
        </div>
        <div class="sz-card fc-stack">
          <h2>${esc(t("Motion", "الحركة"))}</h2>
          <label class="fc-label">${esc(t("Animation intensity", "شدة التحريك"))}</label>
          <select id="fc-setting-motion" class="fc-input">
            <option value="off" ${intensity === "off" ? "selected" : ""}>${esc(t("Off", "إيقاف"))}</option>
            <option value="subtle" ${intensity === "subtle" ? "selected" : ""}>${esc(t("Subtle", "خفيف"))}</option>
            <option value="full" ${intensity === "full" ? "selected" : ""}>${esc(t("Full", "كامل"))}</option>
          </select>
          <label class="fc-check"><input id="fc-setting-reminder" type="checkbox" ${settings.reminder && settings.reminder.enabled ? "checked" : ""} /> ${esc(t("Enable study reminder", "تفعيل تذكير الدراسة"))}</label>
          <label class="fc-label">${esc(t("Reminder time", "وقت التذكير"))}</label>
          <input id="fc-setting-reminder-time" class="fc-input" value="${esc((settings.reminder && settings.reminder.time) || "19:00")}" />
          <div class="fc-hero-actions"><button type="button" class="button button-primary" data-action="fc-save-settings">${esc(t("Save settings", "حفظ الإعدادات"))}</button></div>
        </div>
      </div>
    </section>`;
    return html;
  }

  // ------------------------------------------------------------------ render dispatch

  function render() {
    let html = "";
    if (view === VIEW.DECKS) html = decksHtml();
    else if (view === VIEW.BROWSE) html = browseHtml();
    else if (view === VIEW.EDITOR) html = editorHtml();
    else if (view === VIEW.REVIEW) html = reviewHtml();
    else if (view === VIEW.STATS) html = statsHtml();
    else if (view === VIEW.IMPORT) html = importHtml();
    else if (view === VIEW.SETTINGS) html = settingsHtml();
    else html = dashboardHtml();
    const content = hostCall("contentElement");
    if (content) content.innerHTML = html;
    const afterRender = hostCall("afterRender");
    if (typeof afterRender === "function") afterRender(html);
    return html;
  }

  function navigateTo(next) {
    view = next;
    lastRenderedView = next;
    return render();
  }

  function renderPage() {
    view = VIEW.DASHBOARD;
    lastRenderedView = view;
    return render();
  }

  // ------------------------------------------------------------------ mount

  async function mount() {
    const content = hostCall("contentElement");
    if (!content || mounted) return;
    mounted = true;
    content.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target ? target.closest("[data-action]") : null;
      if (!button) return;
      event.preventDefault();
      void handleAction(String(button.getAttribute("data-action") || ""), button);
    });
    content.addEventListener("input", (event) => {
      const target = event.target;
      const id = target && target.id ? String(target.id) : "";
      if (id === "fc-deck-search") { deckQuery = target.value; return render(); }
      if (id === "fc-browse-search") { browseQuery = target.value; browsePage = 0; return render(); }
      if (id.startsWith("fc-editor-") || id.startsWith("fc-setting-") || id.startsWith("fc-import-")) return;
      void handleAction(String((target && target.getAttribute && target.getAttribute("data-action")) || ""), target);
    });
    content.addEventListener("change", (event) => {
      const target = event.target;
      const id = target && target.id ? String(target.id) : "";
      if (id === "fc-browse-deck") {
        browseDeckId = String((target && target.value) || "");
        browsePage = 0;
        return render();
      }
      if (id === "fc-editor-type") {
        editorDraft = Object.assign(readEditorForm(), { cardId: session && session.cardId ? session.cardId : null });
        return render();
      }
      if (id.startsWith("fc-setting-")) return void handleAction("fc-setting-change", target);
      void handleAction(String((target && target.getAttribute && target.getAttribute("data-action")) || ""), target);
    });
    window.addEventListener("keydown", attachHotkeyHandler);
  }

  function attachHotkeyHandler() {
    const handler = (event) => {
      if (view !== VIEW.REVIEW || document.visibilityState !== "visible") return;
      if (event.key === " " || event.key === "Enter") { event.preventDefault(); void reveal(); }
      else if (event.key === "1") void rate("again");
      else if (event.key === "2") void rate("hard");
      else if (event.key === "3") void rate("good");
      else if (event.key === "4") void rate("easy");
      else if (event.key === "s" || event.key === "S") void suspendCurrent();
    };
    window.addEventListener("keydown", handler);
    hotkeyDisposers.push(() => window.removeEventListener("keydown", handler));
  }

  function detachHotkeys() {
    hotkeyDisposers.forEach((dispose) => { try { dispose(); } catch (error) { /* noop */ } });
    hotkeyDisposers = [];
  }

  // ------------------------------------------------------------------ actions

  async function handleAction(action, button) {
    switch (action) {
      case "fc-start-due": return startSession("due");
      case "fc-open-decks": return navigateTo(VIEW.DECKS);
      case "fc-start-deck": {
        const deckId = button ? button.getAttribute("data-deck-id") : null;
        if (deckId) { session = session || {}; session.deckId = deckId; return startSession("due"); }
        break;
      }
      case "fc-open-deck": {
        const deckId = button ? button.getAttribute("data-deck-id") : null;
        if (deckId) { session = session || {}; session.deckId = deckId; return navigateTo(VIEW.BROWSE); }
        break;
      }
      case "fc-new-deck": {
        const created = await createDeckFlow();
        if (created) {
          session = session || {};
          session.cardId = null;
          editorDraft = null;
          return navigateTo(VIEW.EDITOR);
        }
        return null;
      }
      case "fc-toggle-subdeck": {
        const deckId = button ? button.getAttribute("data-deck-id") : null;
        if (deckId) {
          moduleStateChildOpen[deckId] = !moduleStateChildOpen[deckId];
          return render();
        }
        break;
      }
      case "fc-rename-deck": {
        const deckId = button ? button.getAttribute("data-deck-id") : null;
        if (!deckId) break;
        await renameDeckFlow(deckId);
        return render();
      }
      case "fc-delete-deck": {
        const deckId = button ? button.getAttribute("data-deck-id") : null;
        if (!deckId) break;
        const db = await getDb();
        const deck = (decks || []).find((item) => item && item.id === deckId);
        if (deck) {
          await db.decks.put(userId, { ...deck, deleted_at: nowIso() });
          const doomed = (cards || []).filter((card) => card.deck_id === deckId).map((card) => ({ ...card, deleted_at: nowIso() }));
          await db.cards.put(userId, doomed);
        }
        await refreshData();
        return render();
      }
      case "fc-browse-prev": {
        if (browsePage > 0) { browsePage -= 1; return render(); }
        break;
      }
      case "fc-browse-next": {
        const pageSize = 12;
        const base = browseDeckId ? (cards || []).filter((card) => card && !card.deleted_at && card.deck_id === browseDeckId) : (cards || []).filter((card) => card && !card.deleted_at);
        const pageCount = Math.max(1, Math.ceil(base.length / pageSize));
        if (browsePage < pageCount - 1) { browsePage += 1; return render(); }
        break;
      }
      case "fc-save-card": return saveCardFromForm();
      case "fc-cancel-edit": editorDraft = null; if (session) session.cardId = null; return navigateTo(VIEW.BROWSE);
      case "fc-export-json": {
        const area = document.getElementById("fc-export-json");
        const textValue = (area && area.value) || "";
        try { await navigator.clipboard.writeText(textValue); if (hostCall("showToast")) hostCall("showToast", "Copied"); } catch (error) { if (hostCall("showToast")) hostCall("showToast", "Copy failed"); }
        break;
      }
      case "fc-export-csv": {
        const area = document.getElementById("fc-export-csv");
        const textValue = (area && area.value) || "";
        try { await navigator.clipboard.writeText(textValue); if (hostCall("showToast")) hostCall("showToast", "Copied"); } catch (error) { if (hostCall("showToast")) hostCall("showToast", "Copy failed"); }
        break;
      }
      case "fc-import-csv": return importCsv();
      case "fc-save-settings": return saveSettingsFromForm();
      case "fc-reveal": return reveal();
      case "fc-rate": {
        const rating = String((button && button.getAttribute ? button.getAttribute("data-rating") : "") || "good");
        return rate(rating);
      }
      case "fc-review-pause": {
        if (sessionState) sessionState.paused = !sessionState.paused;
        return render();
      }
      case "fc-review-end": return endSession();
      case "fc-edit-card": {
        const cardId = button ? button.getAttribute("data-card-id") : null;
        session = session || {};
        session.cardId = cardId || null;
        editorDraft = null;
        return navigateTo(VIEW.EDITOR);
      }
      case "fc-delete-card": {
        const cardId = button ? button.getAttribute("data-card-id") : null;
        if (!cardId) break;
        const db = await getDb();
        const card = (cards || []).find((item) => item && item.id === cardId);
        if (card) {
          await db.cards.put(userId, { ...card, deleted_at: nowIso() });
        }
        await refreshData();
        return render();
      }
      default: break;
    }
    await refreshData();
    if (lastRenderedView === view) return render();
    return null;
  }

  async function saveCardFromForm() {
    const form = readEditorForm();
    let deckId = form.deck_id || (session && session.deckId) || (decks || [])[0]?.id || "";
    const db = await getDb();
    if (!deckId) {
      const created = await createDeckFlow();
      if (!created) return null;
      deckId = (session && session.deckId) || (decks || [])[0]?.id || "";
    }
    const front = String(form.front || "").trim();
    const back = String(form.back || "").trim();
    if (!front || !back) {
      if (hostCall("showToast")) hostCall("showToast", t("Front and back are required.", "السؤال والإجابة مطلوبان."));
      return null;
    }
    const type = form.type || "basic";
    const payload = {
      deck_id: deckId,
      type,
      front,
      back,
      template: type === "basic_reversed" ? "basic_reversed" : type === "basic_optional_reversed" ? "basic_optional_reversed" : type === "cloze" ? "cloze" : type === "multiple_choice" ? "multiple_choice" : type === "image" ? "image" : "audio",
      source: "manual",
      explanation: String(form.explanation || ""),
      hints: Array.isArray(form.hints) ? form.hints : [],
      tags: Array.isArray(form.tags) ? form.tags : [],
      notes: String(form.notes || ""),
      cloze: String(form.cloze || ""),
      choices: Array.isArray(form.choices) ? form.choices : [],
      correct_choice: Math.max(1, Number(form.correct_choice) || 1),
      updated_at: nowIso(),
    };
    if (session && session.cardId) {
      const existing = (cards || []).find((item) => item && item.id === session.cardId);
      await db.cards.put(userId, { ...(existing || core.newCard(front, back)), ...payload });
    } else {
      await db.cards.put(userId, Object.assign(core.newCard(front, back, { deck_id: deckId, type, source: "manual" }), payload));
    }
    editorDraft = null;
    if (session) session.cardId = null;
    await refreshData();
    if (hostCall("showToast")) hostCall("showToast", t("Card saved", "تم حفظ البطاقة"));
    return navigateTo(VIEW.BROWSE);
  }

  async function saveSettingsFromForm() {
    const next = Object.assign({}, settings, {
      new_per_day: Number((document.getElementById("fc-setting-new") || {}).value) || settings.new_per_day || 0,
      reviews_per_day: Number((document.getElementById("fc-setting-reviews") || {}).value) || settings.reviews_per_day || 0,
      daily_goal: Number((document.getElementById("fc-setting-daily-goal") || {}).value) || settings.daily_goal || 0,
      learning_steps: String((document.getElementById("fc-setting-learning") || {}).value || "").split(",").map(Number).filter((n) => n > 0),
      relearning_steps: String((document.getElementById("fc-setting-relearning") || {}).value || "").split(",").map(Number).filter((n) => n > 0),
      graduating_interval: Number((document.getElementById("fc-setting-graduating") || {}).value) || settings.graduating_interval || 1,
      easy_interval: Number((document.getElementById("fc-setting-easy-interval") || {}).value) || settings.easy_interval || 4,
      desired_retention: Number((document.getElementById("fc-setting-retention") || {}).value) || settings.desired_retention || 0.9,
      reminder: { enabled: Boolean((document.getElementById("fc-setting-reminder") || {}).checked), time: (document.getElementById("fc-setting-reminder-time") || {}).value || "19:00", days: [1, 2, 3, 4, 5, 6, 0] },
    });
    settings = core.normalizeSettings(next);
    const db = await getDb();
    await db.settings.put(userId, settings);
    return render();
  }

  async function importCsv() {
    const area = document.getElementById("fc-import-csv");
    const text = String((area && area.value) || "");
    const parsed = core.parseDelimited(text, ",");
    if (parsed.errors && parsed.errors.length) { if (hostCall("showToast")) hostCall("showToast", "Invalid CSV"); return render(); }
    const deckId = (session && session.deckId) || (decks || [])[0]?.id || "";
    for (const row of parsed.rows || []) {
      const front = String(row.front || "");
      const back = String(row.back || "");
      if (!front && !back) continue;
      const card = core.newCard(front, back, { deck_id: deckId, type: "basic", source: "import" });
      await getDb().then((db) => db.cards.put(userId, card));
    }
    await refreshData();
    return render();
  }

  // ------------------------------------------------------------------ review

  function renderCardContent(card, side) {
    if (!card) return `<div class="fc-card-content fc-empty">${esc(t("No card loaded", "لا توجد بطاقة"))}</div>`;
    const content = side === "front" ? card.front : card.back;
    const parts = core.tokenizeCloze(String(content || ""));
    const rendered = parts.map((part) => part.type === "cloze"
      ? `<span class="fc-cloze" data-fc-cloze="${esc(part.value)}" data-fc-hint="${esc(part.hint || "")}">${esc(part.value)}</span>`
      : esc(part.value)).join("");
    return `<div class="fc-card-content">${rendered}</div>`;
  }

  function reviewHtml() {
    const state = sessionState;
    const current = state && state.currentCard ? state.currentCard : null;
    const revealed = Boolean(state && state.revealed);
    const estimates = current ? ["again", "hard", "good", "easy"].map((rating) => core.estimateButtonIntervals(current, rating, Date.now(), settings)) : [];
    const total = state ? state.total : 0;
    const index = state ? state.index : 0;
    const progress = total ? Math.min(100, Math.round(((state.revealed ? index + 1 : index) / total) * 100)) : 0;
    const remaining = Math.max(0, total - index - (revealed ? 1 : 0));
    const frontHtml = `<div dir="auto">${renderCardContent(current, "front")}</div>`;
    const backHtml = `<div dir="auto">${renderCardContent(current, "back")}</div>`;
    const answerArea = revealed ? `<div class="fc-answer-area">${backHtml}</div>` : `<button type="button" class="fc-reveal-button" data-action="fc-reveal">${esc(t("Reveal answer", "إظهار الإجابة"))}</button>`;
    const buttonsHtml = revealed ? estimates.map((estimate) => {
      const label = RATING_LABEL[estimate.rating][hostCall("getLanguage") === "ar" ? 1 : 0];
      const intervalDays = Number(estimate.intervalDays) || 0;
      const intervalLabel = estimate.rating === "again"
        ? `${Math.max(1, Math.round(Number((new Date(estimate.dueAt).getTime() - Date.now()) / 60000) || 1))}m`
        : `${Math.max(1, intervalDays)}d`;
      return `<button type="button" class="fc-rate-button fc-rate-${estimate.rating}" data-action="fc-rate" data-rating="${estimate.rating}">
        <strong>${esc(label)}</strong>
        <small>${esc(estimate.rating === "again" ? t("Relearn in", "إعادة التعلم في") + " " + intervalLabel : t("Next review", "المراجعة التالية") + " " + intervalLabel)}</small>
      </button>`;
    }).join("") : "";
    const answers = state ? (state.answers || []) : [];
    const answerList = answers.map((answer) => `<div class="fc-answer-row"><small>${esc(t("card", "البطاقة"))} ${esc(fmtInt(answer.cardId || 0))}</small><small>${esc(t("rating", "التقييم"))}: ${esc(answer.rating)}</small><small>${esc(t("interval", "الفترة"))}: ${esc(fmtInt(answer.intervalDays))}d</small></div>`).join("");
    const isCompleted = state && state.index >= state.queue.length;
    const done = Boolean(state && isCompleted);
    return `<section class="fc-view fc-review ${motionClass()}" data-fc-view="review">
      <div class="fc-review-top">
        <div class="fc-review-progress"><div class="fc-progress"><div class="fc-progress-fill" style="width:${esc(String(progress))}%"></div></div><span>${esc(String(progress))}%</span></div>
        <span class="fc-review-count">${esc(fmtInt(index + 1))} / ${esc(fmtInt(total))}</span>
      </div>
      <div class="fc-card-stage fc-anim" data-fc-anim="${esc(String(Math.min(6, index + 1)))}">
        <div class="fc-card ${revealed ? "is-revealed" : ""}" data-fc-card>
          <div class="fc-card-face fc-card-face-front">${frontHtml}</div>
          <div class="fc-card-face fc-card-face-back">${backHtml}</div>
        </div>
        ${answerArea}
        ${buttonsHtml ? `<div class="fc-rate-row">${buttonsHtml}</div>` : ""}
        ${answerList ? `<div class="fc-answer-history">${answerList}</div>` : ""}
      </div>
      <div class="fc-review-meta">
        <span>${esc(t("Remaining", "المتبقي"))}: ${esc(fmtInt(remaining))}</span>
        <button type="button" class="button button-secondary button-small" data-action="fc-review-pause">${esc(t("Pause", "إيقاف مؤقت"))}</button>
        <button type="button" class="button button-quiet button-small" data-action="fc-review-end">${esc(t("End session", "إنهاء الجلسة"))}</button>
      </div>
    </section>`;
  }

  // ------------------------------------------------------------------ session

  async function startSession(mode) {
    const at = Date.now();
    const dueNow = core.dueCards(cards, new Date(), { includeNew: true, limit: 500 });
    const introduced = core.introducedToday(reviews, new Date());
    const fresh = dueNow.filter((card) => card.state === "new" && !introduced.has(card.id)).slice(0, Math.max(0, settings.new_per_day));
    const rest = dueNow.filter((card) => card.state !== "new").slice(0, Math.max(1, settings.reviews_per_day - fresh.length));
    const pool = mode === "new" ? fresh : mode === "all" ? dueNow.slice(0, 500) : rest.concat(fresh);
    const selected = (session && session.deckId) ? pool.filter((card) => card.deck_id === session.deckId) : pool;
    const ordered = selected.slice().sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
    sessionState = {
      mode,
      queue: ordered,
      index: 0,
      currentCard: ordered[0] || null,
      revealed: false,
      answers: [],
      startedAt: Date.now(),
      paused: false,
      rating: null,
      total: ordered.length,
    };
    sessionState.startedAt = Date.now();
    view = VIEW.REVIEW;
    lastRenderedView = view;
    return render();
  }

  async function reveal() {
    if (!sessionState || !sessionState.currentCard) return null;
    sessionState.revealed = true;
    return render();
  }

  async function rate(rating) {
    const state = sessionState;
    if (!state || !state.currentCard) return null;
    if (state.revealed !== true) state.revealed = true;
    const card = state.currentCard;
    const result = core.schedule({ card, rating, at: Date.now(), settings });
    const reviewId = core.uid("rev");
    const reviewRow = {
      id: reviewId,
      user_id: userId,
      card_id: card.id,
      deck_id: card.deck_id,
      rating,
      reviewed_at: nowIso(),
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
    await db.reviews.put(userId, [reviewRow]);
    await db.outbox.add("flashcard_reviews", "upsert", reviewId, reviewRow);
    await db.cards.put(userId, result.card);
    reviews = (reviews || []).concat([reviewRow]);
    state.answers.push({ cardId: card.id, rating, intervalDays: result.card.interval_days, dueAt: result.card.due_at });
    state.index += 1;
    if (state.index < state.queue.length) {
      state.currentCard = state.queue[state.index] || null;
      state.revealed = false;
    } else {
      state.currentCard = null;
      await endSession();
    }
    return render();
  }

  async function endSession() {
    const elapsed = Math.max(0, Date.now() - (sessionState ? sessionState.startedAt : Date.now()));
    if (elapsed > 0) {
      const db = await getDb();
      await db.reviews.put(userId, (reviews || []).map((review) => ({ ...review, duration_ms: elapsed })));
    }
    sessionState = null;
    view = VIEW.DASHBOARD;
    lastRenderedView = view;
    return render();
  }

  async function suspendCurrent() { await rate("again"); }

  // ------------------------------------------------------------------ public API

  const api = {
    init: (bridge) => { host = bridge; window.StudyZoneFlashcards = window.StudyZoneFlashcards || {}; window.StudyZoneFlashcards.Api = api; return api; },
    setHost: (next) => { host = next; return api; },
    getHost: () => host,
    getView: () => view,
    getDecks: () => decks,
    getCards: () => cards,
    getReviews: () => reviews,
    getSettings: () => settings,
    getSessionState: () => sessionState,
    syncSession: async (sessionValue) => {
      session = sessionValue;
      const nextUserId = sessionValue && sessionValue.user ? sessionValue.user.id : null;
      if (String(nextUserId || "") !== String(userId || "")) {
        flashcardXpState = { loading: false, loaded: false, totalXp: 0, level: 1, error: "" };
        flashcardXpFetchKey = "";
      }
      userId = nextUserId;
      return api;
    },
    shutdown: () => {
      mounted = false;
      detachHotkeys();
      sessionState = null;
      // Keep loaded XP state; next syncSession for a different user will reset it.
      return api;
    },
    renderPage,
    mount,
    dashboardCard: () => dashboardHtml(),
    openDashboard: () => navigateTo(VIEW.DASHBOARD),
    openDecks: () => navigateTo(VIEW.DECKS),
    openBrowse: () => navigateTo(VIEW.BROWSE),
    openEditor: (cardId) => { view = VIEW.EDITOR; session = session || {}; session.cardId = cardId || null; lastRenderedView = view; return render(); },
    openReview: (mode) => startSession(mode || "due"),
    openStats: () => navigateTo(VIEW.STATS),
    openImport: () => navigateTo(VIEW.IMPORT),
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
