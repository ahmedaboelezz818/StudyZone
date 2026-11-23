/*
 * Second Brain flashcards core.
 *
 * Dependency-free, framework-free spaced-repetition logic. Runs in the browser,
 * in Node unit tests and inside the offline layers without touching the network,
 * storage or the DOM.
 *
 * Currently implemented: the documented SM-2 family of algorithms (learning
 * steps, relearning steps, graduated intervals, ease handling, desired
 * retention metadata). FSRS is intentionally not implemented; switching the
 * algorithm in settings stays supported and the scheduler is isolated so it can
 * be replaced without touching the UI.
 */
(function (global) {
  "use strict";

  const MS_PER_DAY = 86400000;
  const MS_PER_MINUTE = 60000;
  const RATINGS = { again: 1, hard: 2, good: 3, easy: 4 };
  const RATING_ORDER = ["again", "hard", "good", "easy"];
  const QUALITY_FOR = { again: 2, hard: 3, good: 4, easy: 5 };
  const DAY_MS = 86400000;
  const DEFAULT_STATE = "new";

  const DEFAULT_SETTINGS = {
    algorithm: "sm2",
    new_per_day: 20,
    reviews_per_day: 200,
    learning_steps: [1, 10],
    relearning_steps: [10],
    graduating_interval: 1,
    easy_interval: 4,
    desired_retention: 0.9,
    daily_goal: 20,
    review_orders: ["due_date"],
  };

  function clone(value) {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map((item) => clone(item));
    const out = {};
    Object.keys(value).forEach((key) => { out[key] = clone(value[key]); });
    return out;
  }

  function uid(prefix) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    // Fallback for very old WebViews: a valid RFC 4122 v4 UUID.
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

  function startOfLocalDay(date) {
    const d = date instanceof Date ? date : new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function dayKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    const month = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
  }

  function normalizeSettings(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const steps = Array.isArray(source.learning_steps) && source.learning_steps.length
      ? source.learning_steps.map((value) => Math.max(1, Math.round(Number(value) || 1)))
      : DEFAULT_SETTINGS.learning_steps;
    const relearn = Array.isArray(source.relearning_steps) && source.relearning_steps.length
      ? source.relearning_steps.map((value) => Math.max(1, Math.round(Number(value) || 1)))
      : DEFAULT_SETTINGS.relearning_steps;
    const interval = (value, fallback) => Math.max(1, Math.round(Number(value) || fallback) || fallback);
    const orders = Array.isArray(source.review_orders) && source.review_orders.length
      ? source.review_orders.filter((value) => RATING_ORDER.includes(value) || value === "due_date")
      : DEFAULT_SETTINGS.review_orders;
    return {
      algorithm: source.algorithm === "fsrs" ? "fsrs" : "sm2",
      new_per_day: Math.min(999, Math.max(0, Math.round(Number(source.new_per_day) || DEFAULT_SETTINGS.new_per_day))),
      reviews_per_day: Math.min(9999, Math.max(0, Math.round(Number(source.reviews_per_day) || DEFAULT_SETTINGS.reviews_per_day))),
      learning_steps: steps,
      relearning_steps: relearn,
      graduating_interval: interval(source.graduating_interval, DEFAULT_SETTINGS.graduating_interval),
      easy_interval: interval(source.easy_interval, DEFAULT_SETTINGS.easy_interval),
      desired_retention: Math.min(0.99, Math.max(0.1, Number(source.desired_retention) || DEFAULT_SETTINGS.desired_retention)),
      daily_goal: Math.min(999, Math.max(0, Math.round(Number(source.daily_goal) || DEFAULT_SETTINGS.daily_goal))),
      review_orders: orders,
    };
  }

  function newCard(front, back, extra) {
    const payload = extra && typeof extra === "object" ? extra : {};
    const now = Date.now();
    return {
      id: payload.id || uid("card"),
      user_id: payload.user_id || null,
      note_id: payload.note_id || null,
      deck_id: payload.deck_id || null,
      template: payload.template || "basic",
      type: payload.type || "basic",
      front: String(payload.front || ""),
      back: String(payload.back || ""),
      media_id: payload.media_id || null,
      state: payload.state || "new",
      due_at: new Date(now).toISOString(),
      interval_days: Number(payload.interval_days) || 0,
      ease: Number(payload.ease) || 2.5,
      reps: 0,
      lapses: 0,
      learning_step: 0,
      last_reviewed_at: null,
      suspended: payload.suspended === true,
      created_at: payload.created_at || new Date(now).toISOString(),
      updated_at: payload.updated_at || new Date(now).toISOString(),
      deleted_at: null,
      source: payload.source || "manual",
    };
  }

  function cardState(card) {
    if (!card) return "new";
    if (card.deleted_at) return "deleted";
    if (card.suspended) return "suspended";
    if (card.state === "review") return "review";
    if (card.state === "relearning") return "relearning";
    if (card.state === "learning") return "learning";
    return "new";
  }

  function isSchedulable(card) {
    const state = cardState(card);
    return state !== "deleted" && state !== "suspended";
  }

  function easeAfter(oldEase, quality) {
    const factor = oldEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    return Math.min(3.0, Math.max(1.3, factor));
  }

  function schedule({ card, rating, at, settings }) {
    const resolved = normalizeSettings(settings);
    const ratingKey = RATINGS[rating] ? rating : "good";
    const quality = QUALITY_FOR[ratingKey];
    const start = at instanceof Date ? at.getTime() : new Date(at).getTime();
    const next = clone(card);
    const steps = resolved.learning_steps.length ? resolved.learning_steps : [1];
    const relearnSteps = resolved.relearning_steps.length ? resolved.relearning_steps : [10];
    const stepMinutes = (index, fallback) => {
      const list = index === 0 ? steps : relearnSteps;
      const safeIndex = Math.max(0, Math.min(list.length - 1, Math.floor(index)));
      const value = Math.max(1, list[safeIndex] || fallback);
      return Math.max(1, value);
    };

    next.updated_at = new Date(start).toISOString();
    next.last_reviewed_at = new Date(start).toISOString();
    next.reps = (next.reps || 0) + 1;

    if (next.state === "review" || next.state === "relearning") {
      const ease = easeAfter(next.ease, quality);
      let intervalDays = next.interval_days || 1;
      let dueAt = start + Math.max(1, intervalDays) * MS_PER_DAY;
      let state = "review";
      let learningStep = 0;

      if (ratingKey === "again") {
        next.lapses = (next.lapses || 0) + 1;
        state = "relearning";
        learningStep = 0;
        next.ease = ease;
        dueAt = start + stepMinutes(0, relearnSteps[0]) * MS_PER_MINUTE;
        intervalDays = Math.max(1, Math.round((next.interval_days || 1) * 0.5));
      } else {
        next.ease = ease;
        if (ratingKey === "hard") intervalDays = Math.max(1, Math.round((next.interval_days || 1) * 1.2));
        else if (ratingKey === "good") intervalDays = Math.max(1, Math.round((next.interval_days || 1) * ease));
        else intervalDays = Math.max(resolved.easy_interval, Math.round((next.interval_days || 1) * ease * 1.3));
        dueAt = start + Math.max(1, intervalDays) * MS_PER_DAY;
        if (ratingKey === "easy") next.ease = Math.min(3.0, next.ease + 0.15);
      }

      next.state = state;
      next.due_at = new Date(dueAt).toISOString();
      next.interval_days = intervalDays;
      next.learning_step = learningStep;
      return {
        card: next,
        review: {
          rating: ratingKey,
          reviewed_at: new Date(start).toISOString(),
          state: state,
          interval_days: intervalDays,
          ease: next.ease,
          was_new: false,
        },
      };
    }

    // new / learning states go through the learning schedule.
    const qualityEase = easeAfter(next.ease, quality);
    if (ratingKey === "again") {
      next.state = "learning";
      next.learning_step = 0;
      next.ease = qualityEase;
      next.due_at = new Date(start + stepMinutes(0, steps[0]) * MS_PER_MINUTE).toISOString();
      return {
        card: next,
        review: { rating: ratingKey, reviewed_at: new Date(start).toISOString(), state: "learning", interval_days: 0, ease: qualityEase, was_new: next.was_new !== false },
      };
    }
    if (ratingKey === "hard") {
      const stepIndex = Math.max(0, Math.min(steps.length - 1, Math.max(0, next.learning_step || 0)));
      next.state = "learning";
      next.learning_step = stepIndex;
      next.ease = qualityEase;
      next.due_at = new Date(start + stepMinutes(stepIndex, steps[stepIndex]) * MS_PER_MINUTE).toISOString();
      return {
        card: next,
        review: { rating: ratingKey, reviewed_at: new Date(start).toISOString(), state: "learning", interval_days: 0, ease: qualityEase, was_new: false },
      };
    }
    if (ratingKey === "good" && (next.learning_step || 0) + 1 < steps.length) {
      const stepIndex = (next.learning_step || 0) + 1;
      next.state = "learning";
      next.learning_step = stepIndex;
      next.ease = qualityEase;
      next.due_at = new Date(start + stepMinutes(stepIndex, steps[stepIndex]) * MS_PER_MINUTE).toISOString();
      return {
        card: next,
        review: { rating: ratingKey, reviewed_at: new Date(start).toISOString(), state: "learning", interval_days: 0, ease: qualityEase, was_new: false },
      };
    }
    // Graduate to review (good uses the default graduating interval, easy uses
    // the configured easy interval, which is larger).
    const graduatedInterval = ratingKey === "easy" ? Math.max(resolved.easy_interval, resolved.graduating_interval * resolved.easy_interval) : resolved.graduating_interval;
    next.state = "review";
    next.learning_step = 0;
    next.ease = qualityEase;
    next.interval_days = Math.max(1, graduatedInterval);
    next.due_at = new Date(start + graduatedInterval * MS_PER_DAY).toISOString();
    return {
      card: next,
      review: { rating: ratingKey, reviewed_at: new Date(start).toISOString(), state: "review", interval_days: graduatedInterval, ease: qualityEase, was_new: next.was_new !== false },
    };
  }

  function simulate(card, rating, at, settings) {
    const result = schedule({ card: clone(card), rating, at: at || Date.now(), settings });
    const next = result.card;
    return {
      nextCard: next,
      nextDueAt: next.due_at,
      intervalDays: next.interval_days,
      ease: next.ease,
      state: next.state,
      learningStep: next.learning_step,
    };
  }

  function estimateButtonIntervals(card, rating, at, settings) {
    const when = at || Date.now();
    const result = simulate(card, rating, when, settings);
    const dueAt = new Date(result.nextDueAt).getTime();
    const minutes = Math.max(0, (dueAt - when) / MS_PER_MINUTE);
    const intervalDays = Math.max(0, Math.round(result.intervalDays));
    const label = rating === "again" ? `${Math.max(1, Math.round(minutes))}m` : `${Math.max(1, intervalDays)}d`;
    return { rating, label, dueAt, state: result.state, intervalDays };
  }

  function dueCards(cards, now, opts) {
    const at = now instanceof Date ? now.getTime() : new Date(now).getTime();
    const wanted = (cards || []).filter((card) => card && !card.deleted_at && !card.suspended);
    const live = wanted.filter((card) => cardState(card) !== "new");
    const fresh = wanted.filter((card) => cardState(card) === "new");
    let pool = live.filter((card) => new Date(card.due_at).getTime() <= at);
    if (opts && opts.includeNew) pool = pool.concat(fresh);
    if (opts && opts.excludeNew) pool = pool.filter((card) => cardState(card) !== "new");
    if (opts && opts.deckId) pool = pool.filter((card) => card.deck_id === opts.deckId);
    if (opts && Array.isArray(opts.tags) && opts.tags.length) {
      const wantedTags = new Set(opts.tags.map((tag) => String(tag)));
      pool = pool.filter((card) => (card.tags || []).some((tag) => wantedTags.has(String(tag))));
    }
    if (opts && opts.forgotten) {
      const forgottenIds = new Set(opts.forgottenIds || []);
      pool = pool.filter((card) => forgottenIds.has(card.id));
    }
    if (opts && opts.weak) {
      const weakIds = new Set(opts.weakIds || []);
      pool = pool.filter((card) => weakIds.has(card.id));
    }
    if (opts && opts.limit > 0) pool = pool.slice(0, opts.limit);
    return pool;
  }

  function introducedToday(reviews, now) {
    const day = dayKey(now instanceof Date ? now : new Date(now));
    const introduced = new Set();
    (reviews || []).forEach((review) => {
      const mapped = review && review.local_day ? review.local_day : dayKey(review && review.reviewed_at);
      if (mapped !== day) return;
      if (review && review.was_new) introduced.add(review.card_id);
    });
    return introduced;
  }

  function buildQueue({ cards = [], reviews = [], now, settings, mode, deckId, tag, limit, orders, forgotten, weak, early, preview, forgottenIds, weakIds }) {
    const resolved = normalizeSettings(settings);
    const at = now instanceof Date ? now.getTime() : new Date(now).getTime();
    const introduced = introducedToday(reviews, now);
    const newPool = (cards || []).filter(
      (card) => cardState(card) === "new" && !card.deleted_at && !card.suspended && !introduced.has(card.id),
    );

    let pool = [];
    if (mode === "due") {
      pool = dueCards(cards, now, { includeNew: true, deckId, tag, limit });
      if (early) pool = pool.filter((card) => card.state === "new" || new Date(card.due_at).getTime() <= at);
      pool = pool.filter((card) => card.state === "new" || new Date(card.due_at).getTime() <= at);
      const taken = new Set(
        (reviews || []).filter((review) => review.was_new).map((review) => review.card_id),
      );
        pool = pool.filter((card) => card.state !== "new" || !taken.has(card.id));
      pool = pool.slice(0, Math.max(1, resolved.reviews_per_day));
    } else if (mode === "new") {
      pool = newPool.slice(0, Math.max(0, resolved.new_per_day));
    } else if (mode === "all") {
      pool = (cards || []).filter((card) => card && !card.deleted_at && !card.suspended);
    } else if (mode === "custom") {
      pool = dueCards(cards, now, { deckId, tag, limit, includeNew: true });
      if (preview) pool = pool.filter((card) => card.state === "review");
    } else if (mode === "forgotten") {
      const ids = new Set(forgottenIds || []);
      pool = (cards || []).filter((card) => card && ids.has(card.id));
    } else if (mode === "weak") {
      const ids = new Set(weakIds || []);
      pool = (cards || []).filter((card) => card && ids.has(card.id));
    } else if (mode === "random") {
      pool = dueCards(cards, now, { includeNew: true });
      pool = Array.isArray(pool) ? pool : [];
      const rng = (next) => { let s = next || Math.floor(Math.random() * 100000); return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
      pool = pool.slice().sort(() => rng() - 0.5);
      pool = pool.slice(0, Math.max(1, resolved.reviews_per_day));
    } else {
      pool = dueCards(cards, now, { includeNew: true, limit });
    }

    if (mode === "due") {
      // Enforce the new-card-per-day allowance for cards that were never
      // introduced yet.
      const introduced = new Set(
        (reviews || []).filter((review) => review && review.was_new).map((review) => review.card_id),
      );
      pool = pool.filter((card) => card.state !== "new" || !introduced.has(card.id));
    }
    if (mode === "all") pool = pool.slice(0, 500);
    return pool;
  }

  function ratingValue(review) {
    const rating = review && review.rating;
    if (rating === "again") return 1;
    if (rating === "hard") return 2;
    if (rating === "good") return 3;
    if (rating === "easy") return 4;
    const numeric = Number(rating);
    if ([1, 2, 3, 4].includes(numeric)) return numeric >= 2 ? numeric + 1 : 2;
    return 0;
  }

  function retentionRate(reviews) {
    const valid = (reviews || []).filter((review) => ratingValue(review) >= 1);
    if (!valid.length) return 0;
    const goodOrBetter = valid.filter((review) => ratingValue(review) >= 3).length;
    return goodOrBetter / valid.length;
  }

  function reviewsForDay(reviews, now) {
    const day = dayKey(now instanceof Date ? now : new Date(now));
    const dayStart = new Date(`${day}T00:00:00`).getTime();
    const dayEnd = dayStart + MS_PER_DAY;
    return (reviews || []).filter((review) => {
      if (review && review.local_day) return review.local_day === day;
      const atMs = review && review.reviewed_at ? new Date(review.reviewed_at).getTime() : NaN;
      return atMs >= dayStart && atMs < dayEnd;
    });
  }

  function buildStudyDays(reviews, now, days) {
    const at = now instanceof Date ? now.getTime() : new Date(now).getTime();
    const buckets = new Map();
    const dayKeys = [];
    const count = Math.max(1, Math.min(365, Math.round(days) || 30));
    for (let offset = count - 1; offset >= 0; offset -= 1) {
      const key = dayKey(new Date(at - offset * MS_PER_DAY));
      dayKeys.push(key);
      buckets.set(key, (reviews || []).filter((review) => {
        const mapped = review && review.local_day ? review.local_day : dayKey(review && review.reviewed_at);
        return mapped === key;
      }).length);
    }
    return { buckets, dayKeys };
  }

  function buildStats({ reviews = [], cards = [], now, deckId, days = 30, settings }) {
    const at = now instanceof Date ? now.getTime() : new Date(now).getTime();
    const normalizedReviews = reviews || [];
    const todayReviews = reviewsForDay(normalizedReviews, new Date(at));
    const retention = retentionRate(normalizedReviews);
    const distribution = {
      again: normalizedReviews.filter((r) => ratingValue(r) === 1).length,
      hard: normalizedReviews.filter((r) => ratingValue(r) === 2).length,
      good: normalizedReviews.filter((r) => ratingValue(r) === 3).length,
      easy: normalizedReviews.filter((r) => ratingValue(r) === 4).length,
    };
    const { buckets, dayKeys } = buildStudyDays(normalizedReviews, new Date(at), days);
    const studyMs = normalizedReviews.reduce((sum, review) => {
      const atMs = review && review.reviewed_at ? new Date(review.reviewed_at).getTime() : 0;
      const startedAt = review && review.started_at ? new Date(review.started_at).getTime() : atMs;
      return sum + Math.max(0, atMs - startedAt);
    }, 0);
    const studyDays = new Set(
      normalizedReviews.filter((review) => review && review.reviewed_at).map((review) => dayKey(review.reviewed_at)),
    );
    let streak = 0;
    let cursor = startOfLocalDay(new Date(at));
    const studyStreakDays = new Set();
    studyDays.forEach((key) => studyStreakDays.add(key));
    while (studyStreakDays.has(dayKey(cursor))) { streak += 1; cursor = new Date(cursor.getTime() - MS_PER_DAY); }

    const filteredReviews = deckId ? normalizedReviews.filter((review) => review && review.deck_id === deckId) : normalizedReviews;
    const filteredCards = deckId ? (cards || []).filter((card) => card && card.deck_id === deckId) : (cards || []);

    const forecast = forecastCards(filteredCards, new Date(at), Math.max(7, Math.min(90, Number(days) || 30)));
    const goal = Number((settings && settings.daily_goal) || DEFAULT_SETTINGS.daily_goal);
    const goalProgress = Math.min(100, Math.round((todayReviews.length / Math.max(1, goal)) * 100));
    const goalMet = todayReviews.length >= Math.max(0, goal);

    const difficultCards = (filteredCards || [])
      .filter((card) => !card.deleted_at && !card.suspended)
      .map((card) => {
        const cardReviews = filteredReviews.filter((review) => review && review.card_id === card.id);
        const forgetRatio = cardReviews.length ? Math.min(1, (card.lapses || 0) / cardReviews.length) : 0;
        const score = forgetRatio * 100 + Math.min(100, (card.lapses || 0) * 10);
        return { card, score, reviews: cardReviews, forgetRatio };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const matureCards = filteredCards.filter(
      (card) => cardState(card) === "review" && Number(card.interval_days) >= 21 && !card.deleted_at && !card.suspended,
    );

    const newCards = filteredCards.filter((card) => cardState(card) === "new" && !card.deleted_at && !card.suspended);
    const learningCards = filteredCards.filter((card) => cardState(card) === "learning" && !card.deleted_at && !card.suspended);
    const reviewCards = filteredCards.filter(
      (card) => (cardState(card) === "review" || cardState(card) === "relearning") && !card.deleted_at && !card.suspended,
    );

    const retentionByDay = new Map();
    dayKeys.forEach((key) => {
      const rows = normalizedReviews.filter((review) => {
        const mapped = review && review.local_day ? review.local_day : dayKey(review && review.reviewed_at);
        return mapped === key;
      });
      retentionByDay.set(key, retentionRate(rows));
    });
    const retentionTrend = dayKeys.slice(-7).map((key) => ({
      key,
      retention: retentionByDay.get(key) || 0,
      reviews: buckets.get(key) || 0,
    }));

    return {
      reviews: normalizedReviews,
      filteredReviews,
      filteredCards,
      reviewsToday: todayReviews.length,
      reviewsTodayRows: todayReviews,
      reviewsTotal: filteredReviews.length,
      retention,
      distribution,
      byDay: Object.fromEntries(buckets),
      dayKeys,
      retentionTrend,
      heatmap: [...buckets.entries()].map(([key, count]) => ({ key, reviews: count })),
      studyMs,
      studyDays,
      streak,
      matureCards,
      difficultCards,
      forecast,
      goalProgress,
      goalMet,
      goal,
      decks: [...new Set(filteredCards.map((card) => card.deck_id).filter(Boolean))],
      dueCount: dueCards(filteredCards, new Date(at), { includeNew: false }).length,
      newCards,
      learningCards,
      reviewCards,
      newAvailableCount: newCards.length,
      correct: normalizedReviews.filter((review) => ratingValue(review) >= 3).length,
      totalReviews: normalizedReviews.length,
      days,
    };
  }

  function forecastCards(cards, now, days) {
    const at = now instanceof Date ? now.getTime() : new Date(now).getTime();
    const buckets = new Array(Math.max(7, Math.min(90, days))).fill(0);
    (cards || []).forEach((card) => {
      const state = cardState(card);
      if (state === "deleted" || state === "suspended") return;
      const dueAt = new Date(card.due_at).getTime();
      if (!Number.isFinite(dueAt) || dueAt < at) return;
      const offset = Math.floor((dueAt - at) / MS_PER_DAY);
      if (offset < 0 || offset >= buckets.length) return;
      buckets[offset] += 1;
    });
    return { days: buckets.length, buckets, total: buckets.reduce((sum, value) => sum + value, 0), daily: buckets.map((count, index) => ({ key: dayKey(new Date(at + index * MS_PER_DAY)), count })) };
  }

  function parseDelimited(text, delimiter) {
    const lines = String(text || "").split(/\r\n|\r|\n/).filter((line) => line.trim().length > 0);
    const rows = [];
    const errors = [];
    if (!lines.length) return { rows, errors: ["EMPTY_FILE"] };
    const splitRow = (line) => {
      const out = [];
      let current = "";
      let quoted = false;
      let quoteChar = "";
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (quoted) {
          if (char === quoteChar) {
            if (line[i + 1] === quoteChar) { current += quoteChar; i += 1; }
            else quoted = false;
          } else current += char;
        } else if (char === '"') { quoted = true; quoteChar = '"'; }
        else if (char === delimiter) { out.push(current); current = ""; }
        else current += char;
      }
      out.push(current);
      return out;
    };
    const header = splitRow(lines[0]).map((value) => value.trim());
    for (let i = 1; i < lines.length; i += 1) {
      const cells = splitRow(lines[i]);
      const row = {};
      header.forEach((key, index) => { row[key] = (cells[index] || "").trim(); });
      rows.push(row);
    }
    return { rows, errors };
  }

  function toDelimited(rows, delimiter) {
    const cols = new Set();
    (rows || []).forEach((row) => { Object.keys(row || {}).forEach((key) => cols.add(key)); });
    const header = [...cols];
    const lines = [header.join(delimiter)];
    (rows || []).forEach((row) => {
      lines.push(header.map((key) => {
        const value = row ? row[key] : "";
        const safe = String(value === null || value === undefined ? "" : value);
        return safe.indexOf(delimiter) >= 0 || safe.indexOf('"') >= 0 || safe.indexOf("\r") >= 0 || safe.indexOf("\n") >= 0
          ? `"${safe.replace(/"/g, '""')}"`
          : safe;
      }).join(delimiter));
    });
    return lines.join("\r\n");
  }

  function tokenizeCloze(text) {
    const pattern = /\{\{c1::([\s\S]*?)(?::[^{}]*?)?\}\}/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
      parts.push({ type: "cloze", value: match[1], hint: (match[2] || "") });
      lastIndex = pattern.lastIndex;
    }
    if (lastIndex < text.length) parts.push({ type: "text", value: text.slice(lastIndex) });
    return parts;
  }

  function shuffle(list, randomSource) {
    const input = Array.isArray(list) ? list.slice() : [];
    let state = typeof randomSource === "function" ? randomSource : Math.random;
    for (let i = input.length - 1; i > 0; i -= 1) {
      let j = Math.floor(state() * (i + 1));
      const tmp = input[i]; input[i] = input[j]; input[j] = tmp;
    }
    return input;
  }

  const api = {
    MS_PER_DAY,
    MS_PER_MINUTE,
    RATINGS,
    RATING_ORDER,
    DEFAULT_SETTINGS,
    clone,
    uid,
    dayKey,
    startOfLocalDay,
    normalizeSettings,
    newCard,
    cardState,
    isSchedulable,
    easeAfter,
    schedule,
    simulate,
    estimateButtonIntervals,
    dueCards,
    introducedToday,
    buildQueue,
    reviewsForDay,
    retentionRate,
    ratingValue,
    buildStats,
    forecastCards,
    parseDelimited,
    toDelimited,
    tokenizeCloze,
    shuffle,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.StudyZoneFlashcardsCore = api;
  global.StudyZoneFlashcards = global.StudyZoneFlashcards || {};
  global.StudyZoneFlashcards.Core = api;
})(typeof window !== "undefined" ? window : globalThis);
