/*
 * Study Zone — Unified UI controls
 * ---------------------------------------------------------------------------
 * Progressive enhancement for every <select>, <input type="date">,
 * <input type="time"> and <input type="datetime-local"> in the app.
 *
 * Design rules:
 *  - The native element stays in the form, keeps its name/value/required/min/
 *    max attributes and receives real `input` + `change` events, so all the
 *    existing app logic (FormData, validation, offline sync) keeps working.
 *  - A themed trigger + popover is inserted next to it. No page markup has to
 *    change and no feature is removed.
 *  - Language comes from the app's <html lang> (set by app.js) and every label
 *    uses the app language, never the device language.
 *  - Colors come from design-tokens.css, so all six themes and light mode work
 *    automatically.
 *  - The module is idempotent: re-renders are picked up with a MutationObserver
 *    and already-enhanced fields are skipped.
 */
(() => {
  "use strict";

  const doc = document;
  if (window.StudyZoneUiControls && window.StudyZoneUiControls.version) return;

  const VERSION = "1.0.0";
  const MONTH_MS = 86400000;

  const STRINGS = {
    en: {
      select: "Select…",
      selectDate: "Select date",
      selectTime: "Select time",
      date: "Date",
      time: "Time",
      today: "Today",
      now: "Now",
      clear: "Clear",
      cancel: "Cancel",
      confirm: "Confirm",
      noDate: "No date selected",
      prevMonth: "Previous month",
      nextMonth: "Next month",
      prevYear: "Previous year",
      nextYear: "Next year",
      chooseMonth: "Choose month and year",
      hours: "Hours",
      minutes: "Minutes",
      am: "AM",
      pm: "PM",
      increaseHour: "Increase hour",
      decreaseHour: "Decrease hour",
      increaseMinute: "Increase minute",
      decreaseMinute: "Decrease minute",
      openCalendar: "Open calendar",
      openTime: "Open time picker",
      openMenu: "Open menu",
    },
    ar: {
      select: "اختر…",
      selectDate: "اختر التاريخ",
      selectTime: "اختر الوقت",
      date: "التاريخ",
      time: "الوقت",
      today: "اليوم",
      now: "الآن",
      clear: "مسح",
      cancel: "إلغاء",
      confirm: "تأكيد",
      noDate: "لم يتم اختيار تاريخ",
      prevMonth: "الشهر السابق",
      nextMonth: "الشهر التالي",
      prevYear: "السنة السابقة",
      nextYear: "السنة التالية",
      chooseMonth: "اختر الشهر والسنة",
      hours: "الساعات",
      minutes: "الدقائق",
      am: "ص",
      pm: "م",
      increaseHour: "زيادة الساعة",
      decreaseHour: "تقليل الساعة",
      increaseMinute: "زيادة الدقيقة",
      decreaseMinute: "تقليل الدقيقة",
      openCalendar: "فتح التقويم",
      openTime: "فتح منتقي الوقت",
      openMenu: "فتح القائمة",
    },
  };

  const state = {
    version: VERSION,
    busyDates: new Set(),
    hour12: detectHour12(),
    active: null,
    scanFrame: 0,
  };

  const triggerMap = new WeakMap();

  /* ---------------------------------------------------------------------- */
  /* Language + formatting helpers                                          */
  /* ---------------------------------------------------------------------- */

  function language() {
    const value = String(doc.documentElement.lang || "").toLowerCase();
    return value.startsWith("ar") ? "ar" : "en";
  }

  function isRtl() {
    return language() === "ar" || doc.documentElement.dir === "rtl";
  }

  function t(key) {
    const dictionary = STRINGS[language()] || STRINGS.en;
    return dictionary[key] || STRINGS.en[key] || key;
  }

  function locale() {
    return language() === "ar" ? "ar-EG" : "en-US";
  }

  function detectHour12() {
    try {
      const stored = localStorage.getItem("studyzone.time-format");
      if (stored === "12") return true;
      if (stored === "24") return false;
      const resolved =
        Intl.DateTimeFormat(locale(), { hour: "numeric" }).resolvedOptions();
      return resolved.hour12 !== false;
    } catch {
      return true;
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clampInt(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function keyOf(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function parseKey(key) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(key || ""));
    if (!match) return null;
    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function addDays(date, delta) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + delta);
    return next;
  }

  function normalizeTime(value) {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ""));
    if (!match) return "";
    const hour = clampInt(Number(match[1]), 0, 23);
    const minute = clampInt(Number(match[2]), 0, 59);
    return `${pad2(hour)}:${pad2(minute)}`;
  }

  function defaultTimeString() {
    const now = new Date();
    return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  }

  function formatDateKey(key, opts) {
    const date = parseKey(key);
    if (!date) return "";
    try {
      return new Intl.DateTimeFormat(locale(), {
        weekday: opts && opts.weekday ? "short" : undefined,
        year: "numeric",
        month: opts && opts.longMonth ? "long" : "short",
        day: "numeric",
      }).format(date);
    } catch {
      return key;
    }
  }

  function formatMonthYear(year, month) {
    try {
      const monthName = new Intl.DateTimeFormat(locale(), {
        month: "long",
      }).format(new Date(year, month, 1));
      const yearLabel = new Intl.NumberFormat(locale(), {
        useGrouping: false,
      }).format(year);
      return `${monthName} ${yearLabel}`;
    } catch {
      return `${year}-${pad2(month + 1)}`;
    }
  }

  function formatTimeString(value) {
    const normalized = normalizeTime(value);
    if (!normalized) return "";
    const [hour, minute] = normalized.split(":").map(Number);
    try {
      return new Intl.DateTimeFormat(locale(), {
        hour: "numeric",
        minute: "2-digit",
        hour12: state.hour12,
      }).format(new Date(2000, 0, 1, hour, minute));
    } catch {
      return normalized;
    }
  }

  function formatFieldValue(input, value) {
    if (!value) return "";
    if (input.type === "time") return formatTimeString(value);
    const key = String(value).slice(0, 10);
    const dateText = formatDateKey(key);
    if (input.type === "datetime-local") {
      const timePart = normalizeTime(String(value).split("T")[1] || "");
      return timePart ? `${dateText} · ${formatTimeString(timePart)}` : dateText;
    }
    return dateText;
  }

  function weekdayIndexes() {
    try {
      const info = new Intl.Locale(locale()).weekInfo;
      if (info && Number.isInteger(info.firstDay)) return info.firstDay % 7;
    } catch {
      /* older engines */
    }
    return language() === "ar" ? 6 : 0;
  }

  function weekdayLabel(index) {
    // 2024-01-07 is a Sunday, used as a stable reference week.
    const date = new Date(2024, 0, 7 + index);
    try {
      return new Intl.DateTimeFormat(locale(), { weekday: "short" }).format(
        date,
      );
    } catch {
      return "";
    }
  }

  function numberLabel(value) {
    try {
      return new Intl.NumberFormat(locale(), { useGrouping: false }).format(
        value,
      );
    } catch {
      return String(value);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* DOM helpers                                                            */
  /* ---------------------------------------------------------------------- */

  function dom(tag, className, text) {
    const element = doc.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }

  const ICONS = {
    "chevron-down": '<path d="M6 9l6 6 6-6"/>',
    "chevron-up": '<path d="M18 15l-6-6-6 6"/>',
    "chevron-left": '<path d="M15 6l-6 6 6 6"/>',
    "chevron-right": '<path d="M9 6l6 6-6 6"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    calendar:
      '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  };

  function icon(name) {
    const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", `sz-icon sz-icon-${name}`);
    svg.innerHTML = ICONS[name] || "";
    return svg;
  }

  function iconButton(iconName, label, handler) {
    const button = dom("button", "sz-nav-btn");
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.appendChild(icon(iconName));
    button.addEventListener("click", handler);
    return button;
  }

  function stepButton(iconName, label, handler) {
    const button = iconButton(iconName, label, handler);
    button.classList.remove("sz-nav-btn");
    button.classList.add("sz-step-btn");
    return button;
  }

  function actionButton(label, variant) {
    const button = dom("button", "sz-action");
    button.type = "button";
    if (variant) button.classList.add(`sz-action-${variant}`);
    button.textContent = label;
    return button;
  }

  function footButton(label, handler) {
    const button = dom("button", "sz-foot-link", label);
    button.type = "button";
    button.addEventListener("click", handler);
    return button;
  }

  function setInputValue(input, value) {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function mirrorProperty(element, constructor, property, callback) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(
        constructor.prototype,
        property,
      );
      if (!descriptor || !descriptor.get || !descriptor.set) return;
      Object.defineProperty(element, property, {
        configurable: true,
        enumerable: descriptor.enumerable,
        get() {
          return descriptor.get.call(this);
        },
        set(value) {
          descriptor.set.call(this, value);
          try {
            callback();
          } catch {
            /* never break the native write */
          }
        },
      });
    } catch {
      /* Some engines refuse instance descriptors; triggers still refresh on
         change/focus in that case. */
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Popover engine                                                         */
  /* ---------------------------------------------------------------------- */

  function isMobileSheet() {
    return window.matchMedia("(max-width: 640px)").matches;
  }

  function positionPopover(el, anchor) {
    if (!anchor || !anchor.isConnected) {
      closePopover(false);
      return;
    }
    if (isMobileSheet()) {
      el.style.left = "";
      el.style.top = "";
      el.style.maxHeight = "";
      return;
    }
    const margin = 12;
    const rect = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    el.style.maxHeight = "";
    const popRect = el.getBoundingClientRect();
    let left = isRtl() ? rect.right - popRect.width : rect.left;
    left = Math.min(Math.max(margin, left), Math.max(margin, vw - popRect.width - margin));
    let top = rect.bottom + 8;
    let maxHeight = vh - top - margin;
    if (maxHeight < 200) {
      const aboveHeight = rect.top - margin - 8;
      if (aboveHeight > maxHeight) {
        maxHeight = aboveHeight;
        top = rect.top - Math.min(popRect.height, aboveHeight) - 8;
      }
    }
    if (top < margin) top = margin;
    if (maxHeight > 180) {
      el.style.maxHeight = `${Math.min(maxHeight, vh - margin * 2)}px`;
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  function openPopover(anchor, build, options) {
    closePopover(false);
    const opts = options || {};
    const el = dom("div", "sz-pop");
    if (opts.className) el.classList.add(...opts.className.split(/\s+/));
    el.dir = isRtl() ? "rtl" : "ltr";
    el.setAttribute("data-sz-no-translate", "true");
    el.setAttribute("role", opts.role || "dialog");

    if (isMobileSheet()) {
      const backdrop = dom("div", "sz-pop-backdrop");
      backdrop.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        closePopover(false);
      });
      doc.body.appendChild(backdrop);
      requestAnimationFrame(() => backdrop.classList.add("is-open"));
      opts.backdrop = backdrop;
      doc.body.classList.add("sz-pop-open");
    }

    doc.body.appendChild(el);
    build(el);
    if (el.maxHeight) el.style.maxHeight = el.maxHeight;

    anchor.setAttribute("aria-expanded", "true");
    const onReposition = () => positionPopover(el, anchor);
    state.active = { el, anchor, onReposition, backdrop: opts.backdrop || null };
    positionPopover(el, anchor);
    window.addEventListener("resize", onReposition, { passive: true });
    window.addEventListener("scroll", onReposition, true);
    requestAnimationFrame(() => el.classList.add("is-open"));
    return el;
  }

  function closePopover(restoreFocus) {
    const active = state.active;
    if (!active) return;
    state.active = null;
    window.removeEventListener("resize", active.onReposition);
    window.removeEventListener("scroll", active.onReposition, true);
    if (active.anchor && active.anchor.isConnected) {
      active.anchor.setAttribute("aria-expanded", "false");
    }
    doc.body.classList.remove("sz-pop-open");
    const backdrop = active.backdrop;
    if (backdrop) {
      backdrop.classList.remove("is-open");
      window.setTimeout(() => backdrop.remove(), 200);
    }
    const el = active.el;
    el.classList.remove("is-open");
    el.classList.add("is-closing");
    window.setTimeout(() => el.remove(), 200);
    if (restoreFocus && active.anchor && active.anchor.isConnected) {
      try {
        active.anchor.focus({ preventScroll: true });
      } catch {
        active.anchor.focus();
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Select menus                                                           */
  /* ---------------------------------------------------------------------- */

  function enhanceSelect(select) {
    if (!select || select.dataset.szControl) return;
    if (select.multiple || Number(select.size) > 1) return;
    if (select.closest(".sz-pop")) return;
    if (select.disabled && select.dataset.szControl) return;

    select.dataset.szControl = "select";
    select.classList.add("sz-native");
    select.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;

    const trigger = dom("button", "sz-select-trigger");
    trigger.type = "button";
    trigger.setAttribute("data-sz-no-translate", "true");
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    if (select.classList.contains("filter-select")) trigger.classList.add("sz-compact");

    const value = dom("span", "sz-select-value");
    trigger.appendChild(value);
    trigger.appendChild(icon("chevron-down"));

    select.insertAdjacentElement("afterend", trigger);
    triggerMap.set(select, trigger);

    const sync = () => {
      const option = select.selectedOptions && select.selectedOptions[0];
      const text = option ? String(option.textContent || "").trim() : "";
      value.textContent = text || t("select");
      trigger.classList.toggle("is-placeholder", !text);
      trigger.disabled = select.disabled;
      trigger.setAttribute(
        "aria-label",
        `${select.getAttribute("aria-label") || t("openMenu")}: ${text || t("select")}`,
      );
    };

    trigger.addEventListener("pointerdown", (event) => event.preventDefault());
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (select.disabled) return;
      if (state.active && state.active.anchor === trigger) {
        closePopover(true);
        return;
      }
      openSelect(select, trigger);
    });
    trigger.addEventListener("keydown", (event) => {
      if (select.disabled) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (state.active && state.active.anchor === trigger) closePopover(true);
        else openSelect(select, trigger);
        return;
      }
      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        if (state.active && state.active.anchor === trigger) closePopover(true);
        else openSelect(select, trigger);
      }
    });

    select.addEventListener("change", sync);
    select.addEventListener("input", sync);
    select.addEventListener("invalid", () => {
      trigger.classList.add("is-invalid");
      try {
        trigger.focus({ preventScroll: false });
      } catch {
        trigger.focus();
      }
    });
    select.addEventListener("input", () => trigger.classList.remove("is-invalid"));

    if (typeof MutationObserver !== "undefined") {
      const observer = new MutationObserver(sync);
      observer.observe(select, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["disabled"],
      });
    }

    mirrorProperty(select, HTMLSelectElement, "value", sync);
    mirrorProperty(select, HTMLSelectElement, "selectedIndex", sync);
    select.__szSync = sync;
    sync();
  }

  function openSelect(select, trigger) {
    const el = openPopover(
      trigger,
      (pop) => {
        pop.classList.add("sz-pop-select", "sz-anchored");
        pop.setAttribute("aria-label", t("openMenu"));
        const list = dom("div", "sz-options");
        list.setAttribute("role", "listbox");
        Array.from(select.options).forEach((option) => {
          const button = dom("button", "sz-option");
          button.type = "button";
          button.setAttribute("role", "option");
          button.setAttribute(
            "aria-selected",
            option.selected ? "true" : "false",
          );
          button.dataset.index = String(option.index);
          const label = dom("span", "", option.textContent);
          button.appendChild(label);
          button.appendChild(icon("check"));
          button.addEventListener("click", () => {
            const index = Number(button.dataset.index);
            const target = Array.from(select.options)[index];
            if (!target || target.disabled) return;
            closePopover(true);
            select.selectedIndex = index;
            select.dispatchEvent(new Event("input", { bubbles: true }));
            select.dispatchEvent(new Event("change", { bubbles: true }));
          });
          list.appendChild(button);
        });
        pop.appendChild(list);
      },
      { role: "dialog", className: "sz-anchored" },
    );

    requestAnimationFrame(() => {
      const selected =
        el.querySelector('.sz-option[aria-selected="true"]') ||
        el.querySelector(".sz-option");
      if (!selected) return;
      try {
        selected.focus({ preventScroll: true });
      } catch {
        selected.focus();
      }
      selected.scrollIntoView({ block: "nearest" });
    });

    el.addEventListener("keydown", (event) => {
      const options = Array.from(el.querySelectorAll(".sz-option:not([disabled])"));
      const current = options.indexOf(doc.activeElement);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const next = current < 0 ? 0 : Math.min(options.length - 1, Math.max(0, current + delta));
        if (options[next]) options[next].focus();
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const target = event.key === "Home" ? options[0] : options[options.length - 1];
        if (target) target.focus();
      }
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Time control (shared by the time picker and the date-time picker)       */
  /* ---------------------------------------------------------------------- */

  function buildTimeControl(initial, onChange, options) {
    const opts = options || {};
    const match = /^(\d{1,2}):(\d{2})/.exec(String(initial || ""));
    let hour = match ? clampInt(Number(match[1]), 0, 23) : new Date().getHours();
    let minute = match ? clampInt(Number(match[2]), 0, 59) : 0;
    const use12 = state.hour12;

    const root = dom("div", "sz-time");
    const clock = dom("div", "sz-time-clock");

    function makeColumn(unit, name) {
      const column = dom("div", "sz-time-col");
      const increase = stepButton("chevron-up", t(`increase${name}`), () => {
        if (unit === "hour") changeHour(1);
        else changeMinute(1);
      });
      const input = doc.createElement("input");
      input.type = "text";
      input.className = "sz-time-input";
      input.inputMode = "numeric";
      input.autocomplete = "off";
      input.maxLength = 2;
      input.setAttribute("aria-label", t(unit === "hour" ? "hours" : "minutes"));
      input.dataset.unit = unit;
      const decrease = stepButton("chevron-down", t(`decrease${name}`), () => {
        if (unit === "hour") changeHour(-1);
        else changeMinute(-1);
      });
      column.append(increase, input, decrease);
      return { column, input };
    }

    const hourCol = makeColumn("hour", "Hour");
    const minuteCol = makeColumn("minute", "Minute");

    const ampm = dom("div", "sz-ampm");
    ampm.setAttribute("role", "group");
    let amButton = null;
    let pmButton = null;
    if (use12) {
      amButton = dom("button", "", t("am"));
      amButton.type = "button";
      pmButton = dom("button", "", t("pm"));
      pmButton.type = "button";
      amButton.addEventListener("click", () => setMeridiem(false));
      pmButton.addEventListener("click", () => setMeridiem(true));
      ampm.append(amButton, pmButton);
    } else {
      ampm.hidden = true;
    }

    clock.append(
      hourCol.column,
      dom("span", "sz-time-sep", ":"),
      minuteCol.column,
      ampm,
    );

    const presets = dom("div", "sz-time-presets");
    [0, 15, 30, 45].forEach((preset) => {
      const button = dom("button", "", `:${pad2(preset)}`);
      button.type = "button";
      button.dataset.minute = String(preset);
      button.addEventListener("click", () => setMinute(preset));
      presets.appendChild(button);
    });

    root.append(clock, presets);

    function getValue() {
      return `${pad2(hour)}:${pad2(minute)}`;
    }

    function displayHour() {
      return use12 ? hour % 12 || 12 : hour;
    }

    function sync(force) {
      if (force || doc.activeElement !== hourCol.input) {
        hourCol.input.value = pad2(displayHour());
      }
      if (force || doc.activeElement !== minuteCol.input) {
        minuteCol.input.value = pad2(minute);
      }
      if (amButton) {
        amButton.classList.toggle("is-active", hour < 12);
        pmButton.classList.toggle("is-active", hour >= 12);
      }
      presets.querySelectorAll("button").forEach((button) => {
        button.classList.toggle(
          "is-active",
          Number(button.dataset.minute) === minute,
        );
      });
    }

    function notify() {
      sync(true);
      if (onChange) onChange(getValue());
    }

    function changeHour(delta) {
      hour = ((hour + delta) % 24 + 24) % 24;
      notify();
    }

    function changeMinute(delta) {
      minute = ((minute + delta) % 60 + 60) % 60;
      notify();
    }

    function setMinute(value) {
      minute = clampInt(value, 0, 59);
      sync(true);
      notify();
    }

    function setMeridiem(pm) {
      hour = (hour % 12) + (pm ? 12 : 0);
      notify();
    }

    function commitHour() {
      const raw = hourCol.input.value.replace(/\D/g, "");
      if (!raw) {
        sync(true);
        return;
      }
      const value = Number(raw);
      if (use12) {
        const twelve = clampInt(value || 12, 1, 12);
        hour = (twelve % 12) + (hour >= 12 ? 12 : 0);
      } else {
        hour = clampInt(value, 0, 23);
      }
      sync(true);
      notify();
    }

    function commitMinute() {
      const raw = minuteCol.input.value.replace(/\D/g, "");
      minute = raw ? clampInt(Number(raw), 0, 59) : minute;
      sync(true);
      notify();
    }

    hourCol.input.addEventListener("input", () => {
      hourCol.input.value = hourCol.input.value.replace(/\D/g, "").slice(0, 2);
    });
    minuteCol.input.addEventListener("input", () => {
      minuteCol.input.value = minuteCol.input.value.replace(/\D/g, "").slice(0, 2);
    });
    hourCol.input.addEventListener("change", commitHour);
    hourCol.input.addEventListener("blur", commitHour);
    minuteCol.input.addEventListener("change", commitMinute);
    minuteCol.input.addEventListener("blur", commitMinute);

    [hourCol.input, minuteCol.input].forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          const delta = event.key === "ArrowUp" ? 1 : -1;
          if (input === hourCol.input) changeHour(delta);
          else changeMinute(delta);
          input.select();
        } else if (event.key === "Enter") {
          event.preventDefault();
          commitHour();
          commitMinute();
          if (opts.onConfirm) opts.onConfirm();
        }
      });
    });

    sync(true);

    return {
      root,
      getValue,
      setValue(nextHour, nextMinute) {
        hour = clampInt(nextHour, 0, 23);
        minute = clampInt(nextMinute, 0, 59);
        sync(true);
        notify();
      },
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Date picker (date-only + combined date-time)                           */
  /* ---------------------------------------------------------------------- */

  function openDatePicker(input, includeTime) {
    const trigger = triggerMap.get(input) || input;
    const raw = String(input.value || "");
    const parts = includeTime ? raw.split("T") : [raw];
    const rawDate = String(parts[0] || "").slice(0, 10);
    const parsed = parseKey(rawDate);
    const ctx = {
      viewYear: (parsed || new Date()).getFullYear(),
      viewMonth: (parsed || new Date()).getMonth(),
      chosen: parsed ? rawDate : "",
      includeTime,
      time: normalizeTime(includeTime ? parts[1] : "") || defaultTimeString(),
      mode: "days",
      min: String(input.min || "").slice(0, 10),
      max: String(input.max || "").slice(0, 10),
    };

    let popEl = null;
    let timeControl = null;
    let summaryEl = null;

    openPopover(
      trigger,
      (el) => {
        popEl = el;
        el.classList.add("sz-pop-date", "sz-anchored");
        renderPicker();
      },
      { role: "dialog", className: "sz-anchored" },
    );

    function renderPicker() {
      if (!popEl) return;
      if (timeControl) ctx.time = timeControl.getValue();
      popEl.innerHTML = "";
      popEl.dir = isRtl() ? "rtl" : "ltr";
      popEl.appendChild(dom("div", "sz-sheet-handle"));

      if (ctx.mode === "years") {
        popEl.appendChild(buildYearsBar());
        popEl.appendChild(buildYearsGrid());
      } else if (ctx.mode === "months") {
        popEl.appendChild(buildYearBar());
        popEl.appendChild(buildMonthGrid());
      } else {
        popEl.appendChild(buildMonthBar());
        popEl.appendChild(buildWeekdays());
        popEl.appendChild(buildDays());
        if (ctx.includeTime) {
          const wrap = dom("div", "sz-datetime-block");
          wrap.appendChild(dom("div", "sz-datetime-label", t("time")));
          timeControl = buildTimeControl(
            ctx.time,
            (value) => {
              ctx.time = value;
              refreshSummary();
            },
            { onConfirm: confirmPicker },
          );
          wrap.appendChild(timeControl.root);
          popEl.appendChild(wrap);
        }
      }

      summaryEl = dom("div", "sz-picker-summary");
      summaryEl.setAttribute("aria-live", "polite");
      popEl.appendChild(summaryEl);
      refreshSummary();
      popEl.appendChild(buildFooter());
    }

    function refreshSummary() {
      if (!summaryEl) return;
      if (!ctx.chosen) {
        summaryEl.textContent = t("noDate");
        return;
      }
      const dateText = formatDateKey(ctx.chosen, { weekday: true });
      if (!ctx.includeTime) {
        summaryEl.innerHTML = `<strong>${escapeHtml(dateText)}</strong>`;
      } else {
        summaryEl.innerHTML = `<strong>${escapeHtml(dateText)}</strong> · ${escapeHtml(
          formatTimeString(ctx.time),
        )}`;
      }
    }

    function buildMonthBar() {
      const bar = dom("div", "sz-picker-head");
      const prev = iconButton("chevron-left", t("prevMonth"), () => shiftMonth(-1));
      const title = dom("button", "sz-picker-title", formatMonthYear(ctx.viewYear, ctx.viewMonth));
      title.type = "button";
      title.setAttribute("aria-label", t("chooseMonth"));
      title.addEventListener("click", () => {
        ctx.mode = "months";
        renderPicker();
      });
      const next = iconButton("chevron-right", t("nextMonth"), () => shiftMonth(1));
      bar.append(prev, title, next);
      return bar;
    }

    function buildYearBar() {
      const bar = dom("div", "sz-picker-head");
      const prev = iconButton("chevron-left", t("prevYear"), () => {
        ctx.viewYear -= 1;
        renderPicker();
      });
      const title = dom(
        "button",
        "sz-picker-title",
        new Intl.NumberFormat(locale(), { useGrouping: false }).format(ctx.viewYear),
      );
      title.type = "button";
      title.setAttribute("aria-label", t("chooseMonth"));
      title.addEventListener("click", () => {
        ctx.mode = "years";
        renderPicker();
      });
      const next = iconButton("chevron-right", t("nextYear"), () => {
        ctx.viewYear += 1;
        renderPicker();
      });
      bar.append(prev, title, next);
      return bar;
    }

    function buildYearsBar() {
      const bar = dom("div", "sz-picker-head");
      const start = Math.floor(ctx.viewYear / 12) * 12;
      const prev = iconButton("chevron-left", t("prevYear"), () => {
        ctx.viewYear -= 12;
        renderPicker();
      });
      const title = dom(
        "button",
        "sz-picker-title",
        `${numberLabel(start)} – ${numberLabel(start + 11)}`,
      );
      title.type = "button";
      title.setAttribute("aria-label", t("chooseMonth"));
      title.addEventListener("click", () => {
        ctx.mode = "months";
        renderPicker();
      });
      const next = iconButton("chevron-right", t("nextYear"), () => {
        ctx.viewYear += 12;
        renderPicker();
      });
      bar.append(prev, title, next);
      return bar;
    }

    function buildYearsGrid() {
      const grid = dom("div", "sz-month-grid");
      grid.setAttribute("role", "group");
      const start = Math.floor(ctx.viewYear / 12) * 12;
      for (let offset = 0; offset < 12; offset += 1) {
        const year = start + offset;
        const button = dom("button", "sz-month-cell", numberLabel(year));
        button.type = "button";
        if (year === ctx.viewYear) button.classList.add("is-selected");
        button.addEventListener("click", () => {
          ctx.viewYear = year;
          ctx.mode = "months";
          renderPicker();
        });
        grid.appendChild(button);
      }
      return grid;
    }

    function buildWeekdays() {
      const row = dom("div", "sz-cal-week");
      row.setAttribute("role", "row");
      const first = weekdayIndexes();
      for (let index = 0; index < 7; index += 1) {
        const cell = dom("span", "", weekdayLabel((first + index) % 7));
        cell.setAttribute("role", "columnheader");
        row.appendChild(cell);
      }
      return row;
    }

    function buildDays() {
      const grid = dom("div", "sz-cal-grid");
      grid.setAttribute("role", "grid");
      const firstDay = weekdayIndexes();
      const first = new Date(ctx.viewYear, ctx.viewMonth, 1);
      const daysInMonth = new Date(ctx.viewYear, ctx.viewMonth + 1, 0).getDate();
      const lead = (first.getDay() - firstDay + 7) % 7;
      const todayKey = keyOf(new Date());

      for (let index = 0; index < lead; index += 1) {
        const empty = dom("span", "sz-cal-day is-outsider");
        empty.setAttribute("aria-hidden", "true");
        grid.appendChild(empty);
      }

      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(ctx.viewYear, ctx.viewMonth, day);
        const key = keyOf(date);
        const button = dom("button", "sz-cal-day", numberLabel(day));
        button.type = "button";
        button.dataset.date = key;
        button.setAttribute("role", "gridcell");
        button.setAttribute("aria-label", formatDateKey(key, { weekday: true }));
        button.setAttribute("aria-selected", key === ctx.chosen ? "true" : "false");
        if (key === todayKey) button.classList.add("is-today");
        if (key === ctx.chosen) button.classList.add("is-selected");
        if (state.busyDates.has(key)) button.classList.add("has-items");
        if ((ctx.min && key < ctx.min) || (ctx.max && key > ctx.max)) {
          button.disabled = true;
          button.setAttribute("aria-disabled", "true");
        }
        button.addEventListener("click", () => {
          ctx.chosen = key;
          renderPicker();
        });
        button.addEventListener("dblclick", () => {
          ctx.chosen = key;
          confirmPicker();
        });
        grid.appendChild(button);
      }

      const trailing = (7 - ((lead + daysInMonth) % 7)) % 7;
      for (let index = 0; index < trailing; index += 1) {
        const empty = dom("span", "sz-cal-day is-outsider");
        empty.setAttribute("aria-hidden", "true");
        grid.appendChild(empty);
      }

      grid.addEventListener("keydown", (event) => {
        const buttons = Array.from(grid.querySelectorAll("button.sz-cal-day:not(:disabled)"));
        const current = buttons.indexOf(doc.activeElement);
        if (!buttons.length) return;
        let target = -1;
        if (event.key === "ArrowRight") target = current + 1;
        else if (event.key === "ArrowLeft") target = current - 1;
        else if (event.key === "ArrowDown") target = current + 7;
        else if (event.key === "ArrowUp") target = current - 7;
        else if (event.key === "Home") target = 0;
        else if (event.key === "End") target = buttons.length - 1;
        else return;
        event.preventDefault();
        target = Math.min(buttons.length - 1, Math.max(0, target));
        buttons[target].focus();
      });

      return grid;
    }

    function buildMonthGrid() {
      const grid = dom("div", "sz-month-grid");
      grid.setAttribute("role", "group");
      const formatter = new Intl.DateTimeFormat(locale(), { month: "short" });
      for (let month = 0; month < 12; month += 1) {
        const button = dom(
          "button",
          "sz-month-cell",
          formatter.format(new Date(ctx.viewYear, month, 1)),
        );
        button.type = "button";
        if (month === ctx.viewMonth) button.classList.add("is-selected");
        button.addEventListener("click", () => {
          ctx.viewMonth = month;
          ctx.mode = "days";
          renderPicker();
        });
        grid.appendChild(button);
      }
      return grid;
    }

    function buildFooter() {
      const footer = dom("div", "sz-picker-foot");
      footer.appendChild(
        footButton(t("today"), () => {
          const today = new Date();
          const todayKey = keyOf(today);
          ctx.viewYear = today.getFullYear();
          ctx.viewMonth = today.getMonth();
          ctx.mode = "days";
          const blocked =
            (ctx.min && todayKey < ctx.min) || (ctx.max && todayKey > ctx.max);
          if (!blocked) ctx.chosen = todayKey;
          renderPicker();
        }),
      );

      if (!input.required) {
        footer.appendChild(
          footButton(t("clear"), () => {
            closePopover(true);
            resetRangePartner(input);
            setInputValue(input, "");
          }),
        );
      }

      const actions = dom("div", "sz-picker-actions");
      const cancel = actionButton(t("cancel"));
      cancel.addEventListener("click", () => closePopover(true));
      const confirm = actionButton(t("confirm"), "primary");
      confirm.disabled = !ctx.chosen;
      confirm.addEventListener("click", confirmPicker);
      actions.append(cancel, confirm);
      footer.appendChild(actions);
      return footer;
    }

    function shiftMonth(delta) {
      const next = new Date(ctx.viewYear, ctx.viewMonth + delta, 1);
      ctx.viewYear = next.getFullYear();
      ctx.viewMonth = next.getMonth();
      renderPicker();
    }

    function confirmPicker() {
      if (!ctx.chosen) return;
      const value = ctx.includeTime
        ? `${ctx.chosen}T${ctx.time || defaultTimeString()}`
        : ctx.chosen;
      closePopover(true);
      setInputValue(input, value);
      syncRangePartner(input, ctx.chosen);
    }
  }

  function syncRangePartner(input, key) {
    const group = input.dataset.szRangeGroup;
    if (!group) return;
    const role = input.dataset.szRangeRole;
    Array.from(doc.querySelectorAll("[data-sz-range-group]")).forEach((other) => {
      if (other === input || other.dataset.szRangeGroup !== group) return;
      if (role === "start") other.min = key;
      else if (role === "end") other.max = key;
    });
  }

  function resetRangePartner(input) {
    const group = input.dataset.szRangeGroup;
    if (!group) return;
    const role = input.dataset.szRangeRole;
    Array.from(doc.querySelectorAll("[data-sz-range-group]")).forEach((other) => {
      if (other === input || other.dataset.szRangeGroup !== group) return;
      if (role === "start") other.min = "";
      else if (role === "end") other.max = "";
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Standalone time picker                                                 */
  /* ---------------------------------------------------------------------- */

  function openTimePicker(input) {
    const trigger = triggerMap.get(input) || input;
    let value = normalizeTime(input.value) || defaultTimeString();
    let control = null;

    openPopover(
      trigger,
      (el) => {
        el.classList.add("sz-pop-time", "sz-anchored");
        el.appendChild(dom("div", "sz-sheet-handle"));
        el.appendChild(dom("div", "sz-pop-title", t("selectTime")));
        control = buildTimeControl(value, (next) => {
          value = next;
        }, { onConfirm: confirmTime });
        el.appendChild(control.root);

        const footer = dom("div", "sz-picker-foot");
        footer.appendChild(
          footButton(t("now"), () => {
            const now = new Date();
            control.setValue(now.getHours(), now.getMinutes());
          }),
        );
        if (!input.required) {
          footer.appendChild(
            footButton(t("clear"), () => {
              closePopover(true);
              setInputValue(input, "");
            }),
          );
        }
        const actions = dom("div", "sz-picker-actions");
        const cancel = actionButton(t("cancel"));
        cancel.addEventListener("click", () => closePopover(true));
        const confirm = actionButton(t("confirm"), "primary");
        confirm.addEventListener("click", confirmTime);
        actions.append(cancel, confirm);
        footer.appendChild(actions);
        el.appendChild(footer);
      },
      { role: "dialog", className: "sz-anchored" },
    );

    function confirmTime() {
      closePopover(true);
      setInputValue(input, control ? control.getValue() : value);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Field enhancement                                                      */
  /* ---------------------------------------------------------------------- */

  function enhanceField(input) {
    if (!input || input.dataset.szControl) return;
    if (input.closest(".sz-pop")) return;
    const kind = input.type;
    if (!["date", "time", "datetime-local"].includes(kind)) return;

    input.dataset.szControl = kind;
    input.classList.add("sz-native");
    input.setAttribute("aria-hidden", "true");
    input.tabIndex = -1;

    const trigger = dom("button", "sz-field-trigger");
    trigger.type = "button";
    trigger.setAttribute("data-sz-no-translate", "true");
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");
    if (input.classList.contains("filter-select")) trigger.classList.add("sz-compact");

    const valueEl = dom("span", "sz-field-value");
    trigger.appendChild(valueEl);
    trigger.appendChild(icon(kind === "time" ? "clock" : "calendar"));

    input.insertAdjacentElement("afterend", trigger);
    triggerMap.set(input, trigger);

    const sync = () => {
      const formatted = formatFieldValue(input, input.value);
      valueEl.textContent = formatted || t(kind === "time" ? "selectTime" : "selectDate");
      trigger.classList.toggle("is-placeholder", !formatted);
      trigger.disabled = input.disabled || input.readOnly;
      trigger.setAttribute(
        "aria-label",
        `${t(kind === "time" ? "openTime" : "openCalendar")}: ${
          formatted || t(kind === "time" ? "selectTime" : "selectDate")
        }`,
      );
    };

    trigger.addEventListener("pointerdown", (event) => event.preventDefault());
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (input.disabled || input.readOnly) return;
      if (state.active && state.active.anchor === trigger) {
        closePopover(true);
        return;
      }
      if (kind === "time") openTimePicker(input);
      else openDatePicker(input, kind === "datetime-local");
    });
    trigger.addEventListener("keydown", (event) => {
      if (input.disabled || input.readOnly) return;
      if (
        event.key === "Enter" ||
        event.key === " " ||
        event.key === "Spacebar" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowUp"
      ) {
        event.preventDefault();
        if (state.active && state.active.anchor === trigger) closePopover(true);
        else if (kind === "time") openTimePicker(input);
        else openDatePicker(input, kind === "datetime-local");
      }
    });

    input.addEventListener("input", sync);
    input.addEventListener("change", sync);
    input.addEventListener("invalid", () => {
      trigger.classList.add("is-invalid");
      try {
        trigger.focus({ preventScroll: false });
      } catch {
        trigger.focus();
      }
    });
    input.addEventListener("input", () => trigger.classList.remove("is-invalid"));
    mirrorProperty(input, HTMLInputElement, "value", sync);
    mirrorProperty(input, HTMLInputElement, "disabled", sync);
    mirrorProperty(input, HTMLInputElement, "readOnly", sync);
    input.__szSync = sync;
    sync();
  }

  /* ---------------------------------------------------------------------- */
  /* Scanning + lifecycle                                                   */
  /* ---------------------------------------------------------------------- */

  const FIELD_SELECTOR =
    'select, input[type="date"], input[type="time"], input[type="datetime-local"]';

  function scan(root) {
    if (doc.documentElement.dataset.szControls === "off") return;
    if (state.active && state.active.anchor && !state.active.anchor.isConnected) {
      closePopover(false);
    }
    const scope = root && root.querySelectorAll ? root : doc;
    const elements = [];
    if (scope !== doc && scope.matches && scope.matches(FIELD_SELECTOR)) {
      elements.push(scope);
    }
    scope.querySelectorAll(FIELD_SELECTOR).forEach((element) => elements.push(element));
    elements.forEach((element) => {
      if (element.dataset.szControl) return;
      if (element.tagName === "SELECT") enhanceSelect(element);
      else enhanceField(element);
    });
  }

  function refreshAll() {
    doc.querySelectorAll("[data-sz-control]").forEach((element) => {
      if (typeof element.__szSync === "function") element.__szSync();
    });
  }

  function scheduleScan() {
    if (state.scanFrame) return;
    state.scanFrame = window.requestAnimationFrame(() => {
      state.scanFrame = 0;
      scan();
    });
  }

  /* Global dismissal + keyboard support */
  doc.addEventListener(
    "pointerdown",
    (event) => {
      const active = state.active;
      if (!active) return;
      if (active.el.contains(event.target) || active.anchor.contains(event.target)) return;
      closePopover(false);
    },
    true,
  );

  doc.addEventListener("keydown", (event) => {
    if (!state.active || event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closePopover(true);
  }, true);

  /* Native form reset must refresh the visible trigger labels. */
  doc.addEventListener(
    "reset",
    () => {
      window.requestAnimationFrame(refreshAll);
    },
    true,
  );

  /* Re-render scan. Only childList is observed so our own data-attributes and
     text updates never cause a scan loop. */
  if (typeof MutationObserver !== "undefined" && doc.body) {
    const observer = new MutationObserver(scheduleScan);
    observer.observe(doc.body, { childList: true, subtree: true });

    const languageObserver = new MutationObserver(() => {
      state.hour12 = detectHour12();
      closePopover(false);
      refreshAll();
    });
    languageObserver.observe(doc.documentElement, {
      attributes: true,
      attributeFilter: ["lang", "dir"],
    });
  }

  /* Public surface used by app.js. */
  window.StudyZoneUiControls = {
    version: VERSION,
    scan: () => scan(),
    refresh: refreshAll,
    close: () => closePopover(false),
    setLanguage: () => {
      state.hour12 = detectHour12();
      closePopover(false);
      refreshAll();
    },
    setBusyDates: (dates) => {
      state.busyDates = new Set(Array.isArray(dates) ? dates : []);
    },
    setHour12: (enabled) => {
      state.hour12 = Boolean(enabled);
      closePopover(false);
      refreshAll();
    },
    openDatePicker: (elementOrId) => {
      const element =
        typeof elementOrId === "string" ? doc.getElementById(elementOrId) : elementOrId;
      if (element) openDatePicker(element, element.type === "datetime-local");
    },
    openTimePicker: (elementOrId) => {
      const element =
        typeof elementOrId === "string" ? doc.getElementById(elementOrId) : elementOrId;
      if (element) openTimePicker(element);
    },
  };

  scan();
})();
