/* Study Zone — Calendar & Deadlines timeline core.
 *
 * Pure date/geometry logic shared by the Calendar screen and the
 * Deadlines timeline. It deliberately has:
 *   - no DOM access
 *   - no app state
 *   - no dependencies
 * so the exact same maths can be unit-tested under Node (tests/timeline-core.js)
 * and reused by both screens without duplicating date logic.
 *
 * Day arithmetic is done on local calendar days (never on raw millisecond
 * differences of instants) so DST transitions, leap years and month/year
 * boundaries can never shift a bar by one day.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StudyZoneTimeline = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const MS_DAY = 86400000;

  function pad2(value) {
    return String(value).length < 2 ? `0${value}` : String(value);
  }

  /* ---- local calendar-day helpers -------------------------------------- */

  /** "YYYY-MM-DD" -> { y, m, d } or null when the value is not a day key. */
  function parseKey(key) {
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ""));
    if (!parts) return null;
    const y = Number(parts[1]);
    const m = Number(parts[2]);
    const d = Number(parts[3]);
    if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
    return { y, m, d };
  }

  /** Local Date -> "YYYY-MM-DD". */
  function keyOf(date) {
    const value = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }

  function todayKey() {
    return keyOf(new Date());
  }

  /**
   * Stable integer stamp for a day key. Built with Date.UTC so the result is
   * independent of the machine time zone and of DST.
   */
  function utcStamp(key) {
    const parsed = parseKey(key);
    if (!parsed) return null;
    return Date.UTC(parsed.y, parsed.m - 1, parsed.d);
  }

  /** Whole calendar days from `from` to `to` (negative when `to` precedes). */
  function dayDiff(from, to) {
    const a = utcStamp(from);
    const b = utcStamp(to);
    if (a == null || b == null) return null;
    return Math.round((b - a) / MS_DAY);
  }

  function addDays(key, amount) {
    const parsed = parseKey(key);
    if (!parsed) return null;
    const next = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d + Number(amount || 0)));
    return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
  }

  /** Calendar-month arithmetic (handles short months and leap years). */
  function addMonths(key, amount) {
    const parsed = parseKey(key);
    if (!parsed) return null;
    const months = parsed.m - 1 + Number(amount || 0);
    const year = parsed.y + Math.floor(months / 12);
    const monthIndex = ((months % 12) + 12) % 12;
    const lastDay = daysInMonth(year, monthIndex);
    const day = Math.min(parsed.d, lastDay);
    return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
  }

  function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  function daysInMonth(year, monthIndex) {
    return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  }

  function startOfWeekKey(key) {
    const parsed = parseKey(key);
    if (!parsed) return null;
    const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    // The app's weekday header starts on Sunday in both languages.
    date.setUTCDate(date.getUTCDate() - date.getUTCDay());
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
  }

  /** 7 day keys starting on the Sunday of `anchor`'s week. */
  function weekDayKeys(anchor) {
    const start = startOfWeekKey(anchor || todayKey());
    if (!start) return [];
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }

  /**
   * Full month grid (always 6 rows x 7 columns) so the layout never jumps
   * between 5 and 6 week months.
   */
  function monthGrid(year, monthIndex) {
    const first = `${year}-${pad2(monthIndex + 1)}-01`;
    const gridStart = startOfWeekKey(first);
    if (!gridStart) return [];
    return Array.from({ length: 6 }, (_, week) =>
      Array.from({ length: 7 }, (_, day) => {
        const key = addDays(gridStart, week * 7 + day);
        const parsed = parseKey(key);
        return {
          key,
          day: parsed ? parsed.d : 0,
          inMonth: parsed ? parsed.m === monthIndex + 1 : false,
        };
      }),
    );
  }

  /* ---- timeline windows & zoom ----------------------------------------- */

  const ZOOMS = {
    day: { days: 7, dayWidth: 168, lead: 1, label: "day" },
    week: { days: 21, dayWidth: 76, lead: 4, label: "week" },
    month: { days: 45, dayWidth: 34, lead: 10, label: "month" },
    quarter: { days: 92, dayWidth: 14, lead: 25, label: "quarter" },
  };
  const ZOOM_ORDER = ["day", "week", "month", "quarter"];

  function normalizeZoom(zoom) {
    return Object.prototype.hasOwnProperty.call(ZOOMS, zoom) ? zoom : "month";
  }

  function windowDays(zoom) {
    return ZOOMS[normalizeZoom(zoom)].days;
  }

  function dayWidth(zoom) {
    return ZOOMS[normalizeZoom(zoom)].dayWidth;
  }

  /** First visible day key for an anchor date at a given zoom. */
  function windowStart(anchor, zoom) {
    const config = ZOOMS[normalizeZoom(zoom)];
    return addDays(anchor || todayKey(), -config.lead);
  }

  function dayIndex(key, startKey) {
    return dayDiff(startKey, key);
  }

  function windowContains(key, startKey, days) {
    const offset = dayIndex(key, startKey);
    return offset != null && offset >= 0 && offset < days;
  }

  /** Move the timeline anchor one step forward/backward. */
  function shiftAnchor(anchor, zoom, direction) {
    const amount = direction < 0 ? -1 : 1;
    switch (normalizeZoom(zoom)) {
      case "day":
        return addDays(anchor, amount);
      case "week":
        return addDays(anchor, amount * 7);
      case "quarter":
        return addMonths(anchor, amount * 3);
      case "month":
      default:
        return addMonths(anchor, amount);
    }
  }

  /* ---- local instants & task day ranges --------------------------------- */

  /**
   * Build a local Date and reject impossible calendar values instead of letting
   * the engine silently roll them into the next month/day.
   */
  function localDate(year, month, day, hours, minutes, seconds, millis) {
    const date = new Date(
      year,
      month - 1,
      day,
      hours || 0,
      minutes || 0,
      seconds || 0,
      millis || 0,
    );
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  /**
   * Parse a stored date value without ever moving it to a neighbouring day.
   *
   * - "YYYY-MM-DD" (all-day tasks, date-only rows) is LOCAL midnight, not UTC
   *   midnight. `new Date("2026-11-07")` would otherwise become Nov 6 in
   *   negative-offset zones.
   * - "YYYY-MM-DDTHH:mm[:ss]" without a zone is LOCAL wall-clock time.
   * - Full ISO strings with `Z` or an offset are real instants and are parsed
   *   by the engine, then read back with local getters.
   */
  function localInstant(value) {
    if (value == null || value === "") return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
    }
    const text = String(value).trim();
    let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (match) {
      return localDate(Number(match[1]), Number(match[2]), Number(match[3]));
    }
    match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(text);
    if (match) {
      return localDate(
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
        Number(match[6] || 0),
        Number(String(match[7] || "0").padEnd(3, "0")),
      );
    }
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function startOfLocalDay(value) {
    const date = value instanceof Date ? value : localInstant(value);
    if (!date || Number.isNaN(date.getTime())) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  /** Normalised { start, end } local midnights for a task's real dates. */
  function taskDayRange(task) {
    if (!task) return null;
    const startDate = localInstant(task.starts_at || task.due_at);
    const endDate = localInstant(task.due_at || task.starts_at);
    if (!startDate || !endDate) return null;
    const start = startOfLocalDay(startDate);
    const end = startOfLocalDay(endDate);
    if (!start || !end) return null;
    return start <= end ? { start, end } : { start: end, end: start };
  }

  /** { startKey, endKey } for a task, or null when it has no usable date. */
  function taskDayKeys(task) {
    const range = taskDayRange(task);
    return range
      ? { startKey: keyOf(range.start), endKey: keyOf(range.end) }
      : null;
  }

  /**
   * Exact full-date occurrence test (YYYY-MM-DD). This is the single source of
   * truth for every calendar view: month cells, week columns, day view, agenda,
   * the day-details modal and the "+N more" popover all call it, so a task can
   * never appear on another day that merely shares the same day-of-month.
   */
  function taskOccursOnDay(task, key) {
    const keys = taskDayKeys(task);
    const parsed = parseKey(key);
    if (!keys || !parsed) return false;
    const targetKey = `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`;
    return targetKey >= keys.startKey && targetKey <= keys.endKey;
  }

  /* ---- item ranges ------------------------------------------------------ */

  function dayKeyOfInstant(value) {
    const date = localInstant(value);
    return date ? keyOf(date) : null;
  }

  /**
   * Normalised range of a task/deadline.
   *   hasStart / hasEnd tell the renderer whether real dates exist so it can
   *   choose between a bar, a deadline marker, an open-ended bar or nothing.
   * No date is ever invented here.
   */
  function itemRange(item) {
    if (!item) return null;
    const rawStart = item.starts_at;
    const rawEnd = item.due_at;
    let startKey = dayKeyOfInstant(rawStart);
    let endKey = dayKeyOfInstant(rawEnd);
    const hasStart = Boolean(startKey);
    const hasEnd = Boolean(endKey);
    if (!hasStart && !hasEnd) return null;
    if (startKey && endKey && dayDiff(startKey, endKey) < 0) {
      // Defensive: keep a sane ordering without touching stored data.
      const swap = startKey;
      startKey = endKey;
      endKey = swap;
    }
    if (!startKey) startKey = null;
    if (!endKey) endKey = null;
    return { startKey, endKey, hasStart, hasEnd };
  }

  function spanDays(range) {
    if (!range) return 0;
    if (range.startKey && range.endKey) {
      const diff = dayDiff(range.startKey, range.endKey);
      return diff == null ? 1 : Math.max(1, diff + 1);
    }
    return 1;
  }

  /**
   * Pixel geometry of a bar inside the visible window.
   * Width is always derived from the real number of days covered by the item,
   * multiplied by the current zoom's day width. Returns null when the item is
   * completely outside the window.
   * An item that has a start but no end date keeps running to the right edge of
   * the window (marked `openEnded`) — no end date is ever invented.
   */
  function barGeometry(range, startKey, days, width) {
    if (!range || !startKey || !days || !width) return null;
    const from = range.startKey || range.endKey;
    const offset = dayIndex(from, startKey);
    if (offset == null) return null;
    const span = spanDays(range);
    const openEnded = Boolean(range.startKey) && !range.endKey;
    const naturalEnd = offset + span;
    const effectiveEnd = openEnded ? days : naturalEnd;
    const visibleStart = Math.max(0, offset);
    const visibleEnd = Math.min(days, effectiveEnd);
    if (visibleEnd <= visibleStart) return null;
    return {
      left: visibleStart * width,
      width: (visibleEnd - visibleStart) * width,
      clippedStart: offset < 0,
      clippedEnd: openEnded || naturalEnd > days,
      openEnded,
      spanDays: span,
      startOffset: offset,
    };
  }

  /** Geometry of a single-day deadline marker (end date only). */
  function markerGeometry(key, startKey, days, width) {
    if (!key) return null;
    const offset = dayIndex(key, startKey);
    if (offset == null || offset < 0 || offset >= days) return null;
    return {
      left: offset * width + width / 2,
      width,
      startOffset: offset,
      clippedStart: false,
      clippedEnd: false,
      spanDays: 1,
    };
  }

  /* ---- status / progress ------------------------------------------------ */

  function localTodayKey(now) {
    return keyOf(now instanceof Date ? now : new Date(now || Date.now()));
  }

  /**
   * Deadlines timeline state:
   *   completed | overdue | active | backlog
   * "active" means the item has already started and is not finished yet.
   */
  function stateOf(item, now) {
    if (!item) return "backlog";
    if (item.status === "completed") return "completed";
    const range = itemRange(item);
    const today = localTodayKey(now);
    if (range && range.endKey && dayDiff(range.endKey, today) > 0) return "overdue";
    if (range && range.startKey && dayDiff(range.startKey, today) >= 0) return "active";
    return "backlog";
  }

  /**
   * Completion percentage when the data really carries one:
   *   - a completed item is 100%
   *   - a project with phases reports its finished phases
   * Returns null when nothing meaningful can be shown (never a fake value).
   */
  function progressOf(item, children) {
    if (!item) return null;
    if (item.status === "completed") return 100;
    const list = Array.isArray(children) ? children : [];
    if (list.length) {
      const done = list.filter((child) => child.status === "completed").length;
      return Math.round((done / list.length) * 100);
    }
    const stored = Number(item.__progress);
    if (Number.isFinite(stored)) return Math.max(0, Math.min(100, Math.round(stored)));
    return null;
  }

  /* ---- classification (timeline vs ordinary task) ------------------------ */

  const KINDS = ["project", "deadline", "phase", "task"];

  /**
   * Reads the explicit classification stored next to a task.
   * `meta` is the persisted map (localStorage) entry for that task.
   */
  function readKind(task, meta) {
    const raw =
      (task && (task.item_kind || task.__item_kind)) ||
      (meta && meta.kind) ||
      "";
    const value = String(raw).trim();
    if (!value) return null;
    if (value.startsWith("phase:")) {
      return { kind: "phase", parent: value.slice(6) || null };
    }
    if (KINDS.includes(value)) {
      return { kind: value, parent: (meta && meta.parent) || null };
    }
    return null;
  }

  /**
   * Fallback for items created before the classification existed.
   * Items produced by the deadline flow always carry a start date, so a start
   * date is a reliable "this is a planned span" signal; ordinary one-off tasks
   * only ever get a due date and are therefore kept out of the timeline.
   */
  function derivedKind(task) {
    if (!task) return null;
    if (task.routine_id || String(task.id || "").startsWith("routine:")) return null;
    if (task.starts_at) return { kind: "deadline", parent: null };
    return { kind: "task", parent: null };
  }

  function classify(task, meta) {
    const explicit = readKind(task, meta);
    if (explicit) return explicit;
    return derivedKind(task);
  }

  /** Only dedicated deadlines/projects/phases belong to the timeline. */
  function isTimelineItem(task, meta) {
    const info = classify(task, meta);
    if (!info) return false;
    if (info.kind === "task") return false;
    const range = itemRange(task);
    return Boolean(range);
  }

  /** Ordinary tasks never belong to the timeline. */
  function isOrdinaryTask(task, meta) {
    const info = classify(task, meta);
    return !info || info.kind === "task";
  }

  /**
   * Mandatory display rule for the Deadlines screen (all views, desktop +
   * mobile): an item belongs there ONLY when it spans at least two calendar
   * days, computed from its actual start and due dates.
   *
   *   - 1 day or less / same start+end day      → false
   *   - 2, 3, 7, 14, 30+ days                   → true
   *   - due-date-only / start-only / undated    → false (never auto-shown)
   *   - routines and daily recurring tasks      → false
   *
   * The rule is about display only; it never removes or alters the task rows.
   */
  function isMultiDayItem(task) {
    if (!task) return false;
    if (task.routine_id || String(task.id || "").startsWith("routine:")) return false;
    const recurrenceType = String(task.recurrence_type || "").toLowerCase();
    if (["daily", "hourly", "weekdays"].includes(recurrenceType)) return false;
    const range = itemRange(task);
    if (!range || !range.startKey || !range.endKey) return false;
    return spanDays(range) >= 2;
  }

  return {
    MS_DAY,
    parseKey,
    keyOf,
    todayKey,
    utcStamp,
    dayDiff,
    addDays,
    addMonths,
    isLeapYear,
    daysInMonth,
    startOfWeekKey,
    weekDayKeys,
    monthGrid,
    ZOOMS,
    ZOOM_ORDER,
    normalizeZoom,
    windowDays,
    dayWidth,
    windowStart,
    dayIndex,
    windowContains,
    shiftAnchor,
    localInstant,
    startOfLocalDay,
    taskDayRange,
    taskDayKeys,
    taskOccursOnDay,
    itemRange,
    spanDays,
    barGeometry,
    markerGeometry,
    stateOf,
    progressOf,
    readKind,
    derivedKind,
    classify,
    isTimelineItem,
    isOrdinaryTask,
    isMultiDayItem,
  };
});
