/*
 * StudyZone Smart Notes — deterministic, offline organizer.
 *
 * This module contains NO network calls and NO AI service. It turns a free-form
 * note into a clean, theme-aware rich-text layout using explicit rules:
 * dates, tasks, priorities, warnings and ordinary information.
 *
 * It never adds a fact that is not present in the source text. It only:
 *  - groups existing sentences,
 *  - turns existing action phrases into checklist items,
 *  - bolds/colours the exact words the user wrote.
 *
 * Exposed as window.StudyZoneSmartNotes in the browser and as a CommonJS
 * module for the Node test suite.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StudyZoneSmartNotes = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const AR = /[\u0600-\u06FF]/;

  const PRIORITY_WORDS = [
    "أهم حاجة",
    "الأهم",
    "مهم جدًا",
    "مهم جدا",
    "مهم",
    "ضروري",
    "ضرورية",
    "عاجل",
    "لازم",
    "لا تنسى",
    "لا أنسى",
    "مش عايز أنسى",
    "مش عايز انسى",
    "حرج",
    "أولوية",
    "اولوية",
    "important",
    "urgent",
    "critical",
    "essential",
    "must",
    "do not forget",
    "don't forget",
    "dont forget",
    "highest priority",
    "priority",
  ];

  const LOW_PRIORITY_WORDS = [
    "لاحقًا",
    "لاحقا",
    "اختياري",
    "اختيارية",
    "ممكن",
    "عند توفر الوقت",
    "لو فيه وقت",
    "وقت فراغ",
    "later",
    "optional",
    "maybe",
    "if there is time",
    "when possible",
    "low priority",
  ];

  const WARNING_WORDS = [
    "تحذير",
    "انتبه",
    "احترس",
    "خطر",
    "ممنوع",
    "تجنب",
    "راجع قبل",
    "warning",
    "careful",
    "avoid",
    "watch out",
    "do not",
  ];

  const TASK_VERBS_AR = [
    "أخلص",
    "اخلص",
    "خلص",
    "أنهي",
    "انهي",
    "أنهى",
    "اكمل",
    "أكمل",
    "كمل",
    "راجع",
    "أراجع",
    "اراجع",
    "ذاكر",
    "أذاكر",
    "اذاكر",
    "حل",
    "أحل",
    "احل",
    "اقرأ",
    "أقرأ",
    "قرأ",
    "اكتب",
    "أكتب",
    "كتب",
    "اعمل",
    "أعمل",
    "عمل",
    "ادرس",
    "أدرس",
    "درس",
    "احفظ",
    "أحفظ",
    "حفظ",
    "حضر",
    "أحضر",
    "جهز",
    "أجهز",
    "جهّز",
    "رتب",
    "أرتب",
    "نظم",
    "أنظم",
    "اختبر",
    "أختبر",
    "تدرب",
    "أتدرب",
    "كرر",
    "أكرر",
  ];

  const TASK_VERBS_EN = [
    "finish",
    "complete",
    "review",
    "study",
    "solve",
    "read",
    "write",
    "prepare",
    "practice",
    "memorize",
    "memorise",
    "submit",
    "revise",
    "do",
    "make",
    "organize",
    "organise",
    "check",
    "revise",
    "learn",
    "watch",
  ];

  const TASK_CUES_AR = [
    "لازم",
    "يجب",
    "ضروري",
    "محتاج",
    "عايز",
    "عاوز",
    "أريد",
    "اريد",
    "عندي",
    "مطلوب",
    "المطلوب",
  ];

  const TASK_CUES_EN = [
    "need to",
    "have to",
    "must",
    "should",
    "i want to",
    "i need to",
    "i have to",
    "remember to",
    "make sure to",
  ];

  const DAY_WORDS_AR =
    "السبت|الأحد|الاحد|الإثنين|الاثنين|الثلاثاء|الأربعاء|الاربعاء|الخميس|الجمعة|الجمعه|اليوم|الليلة|غدًا|غدا|بكرة|بكره|بعد غد|بعد بكرة|الأسبوع القادم|الاسبوع القادم|الأسبوع الجاي|الشهر القادم|الشهر الجاي";
  const DAY_WORDS_EN =
    "today|tonight|tomorrow|next week|next month|monday|tuesday|wednesday|thursday|friday|saturday|sunday";

  const DATE_AR = new RegExp(
    `(?:يوم\\s+)?(?:${DAY_WORDS_AR})|\\d{1,2}\\s*[/.-]\\s*\\d{1,2}(?:\\s*[/.-]\\s*\\d{2,4})?|\\d{1,2}\\s*(?:يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)`,
    "g",
  );
  const DATE_EN = new RegExp(
    `\\b(?:${DAY_WORDS_EN})\\b|\\b\\d{1,2}[/.-]\\d{1,2}(?:[/.-]\\d{2,4})?\\b`,
    "gi",
  );

  function isArabic(text) {
    const value = String(text || "");
    const arabic = (value.match(/[\u0600-\u06FF]/g) || []).length;
    const latin = (value.match(/[A-Za-z]/g) || []).length;
    return arabic > 0 && arabic >= latin;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function stripDiacritics(value) {
    return String(value || "").replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
  }

  function normalizeForMatch(value) {
    return stripDiacritics(value)
      .replace(/[إأآا]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function containsAny(text, words) {
    const normalized = normalizeForMatch(text);
    return words.some((word) => {
      const needle = normalizeForMatch(word);
      if (!needle) return false;
      if (AR.test(needle)) {
        // Arabic phrases are matched as substrings so "مهم جدًا" also matches.
        return normalized.includes(needle);
      }
      return new RegExp(`(?:^|[^a-z])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z])`).test(normalized);
    });
  }

  function stripLeading(value) {
    return String(value || "")
      .replace(/^[\s\-–—•*·]+/, "")
      .replace(/^(?:و|ثم)\s+/i, "")
      .trim();
  }

  function splitSentences(text) {
    return String(text || "")
      .replace(/\r\n?/g, "\n")
      .split(/\n+|(?<=[.!?؟…])\s+/)
      .map((part) => stripLeading(part).replace(/[ \t]+/g, " ").trim())
      .filter((part) => part.length > 0);
  }

  function startsWithTaskVerb(fragment) {
    const value = normalizeForMatch(fragment);
    if (!value) return false;
    return (
      TASK_VERBS_AR.some((verb) => value.startsWith(normalizeForMatch(verb))) ||
      TASK_VERBS_EN.some((verb) => value.startsWith(verb))
    );
  }

  function isTaskSentence(sentence) {
    if (containsAny(sentence, TASK_CUES_AR) || containsAny(sentence, TASK_CUES_EN)) return true;
    const first = String(sentence || "").split(/[،,]\s*/)[0] || "";
    return startsWithTaskVerb(stripLeading(first));
  }

  function isPriority(sentence) {
    return containsAny(sentence, PRIORITY_WORDS) && !containsAny(sentence, LOW_PRIORITY_WORDS);
  }

  function isLowPriority(sentence) {
    return containsAny(sentence, LOW_PRIORITY_WORDS);
  }

  function isWarning(sentence) {
    return containsAny(sentence, WARNING_WORDS);
  }

  function findDates(sentence) {
    const out = [];
    const value = String(sentence || "");
    for (const match of value.matchAll(DATE_AR)) {
      if (match[0]) out.push(match[0].trim());
    }
    for (const match of value.matchAll(DATE_EN)) {
      if (match[0]) out.push(match[0].trim());
    }
    return [...new Set(out)];
  }

  function removeCue(value) {
    let text = stripLeading(value);
    const cues = [...TASK_CUES_AR, ...TASK_CUES_EN].sort((a, b) => b.length - a.length);
    for (const cue of cues) {
      const pattern = new RegExp(`^${cue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i");
      text = text.replace(pattern, "");
    }
    return text.trim();
  }

  function normalizeTaskVerb(value) {
    let text = removeCue(value);
    const mappings = [
      [/^(?:أن|ان|أ|ا)?خلص\b/, "إنهاء"],
      [/^(?:أن|ان|أ|ا)?نهي\b/, "إنهاء"],
      [/^(?:أن|ان|أ|ا)?كمل\b/, "إكمال"],
      [/^(?:أن|ان|أ|ا)?راجع\b/, "مراجعة"],
      [/^(?:أن|ان|أ|ا)?ذاكر\b/, "مذاكرة"],
      [/^(?:أن|ان|أ|ا)?حل\b/, "حل"],
      [/^(?:أن|ان|أ|ا)?قرأ\b/, "قراءة"],
      [/^(?:أن|ان|أ|ا)?كتب\b/, "كتابة"],
      [/^(?:أن|ان|أ|ا)?عمل\b/, "إنجاز"],
      [/^(?:أن|ان|أ|ا)?درس\b/, "دراسة"],
      [/^(?:أن|ان|أ|ا)?حفظ\b/, "حفظ"],
      [/^(?:أن|ان|أ|ا)?حضر\b/, "تحضير"],
      [/^(?:أن|ان|أ|ا)?جهز\b/, "تجهيز"],
    ];
    for (const [pattern, replacement] of mappings) {
      if (pattern.test(text)) {
        text = text.replace(pattern, replacement);
        break;
      }
    }
    // English infinitive/gerund cleanup.
    text = text.replace(/^(?:to\s+)/i, "");
    return text.replace(/\s+/g, " ").trim();
  }

  function splitTaskFragments(sentence) {
    const cleaned = removeCue(sentence);
    const parts = cleaned
      .split(/\s+و(?=[\u0621-\u064A])|(?<=[،,;؛])\s*|\s+(?:and|then)\s+(?=[a-z])/i)
      .map((part) => stripLeading(part).trim())
      .filter(Boolean);
    const tasks = parts.filter((part) => part.length > 1);
    return tasks.length ? tasks : [cleaned];
  }

  function taskText(sentence) {
    const fragments = splitTaskFragments(sentence)
      .map(normalizeTaskVerb)
      .map((part) => part.replace(/[.،,;؛]+$/, "").trim())
      .filter((part) => part.length > 1);
    return fragments.length ? fragments : [normalizeTaskVerb(sentence)];
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlightText(sentence, lang) {
    let html = escapeHtml(sentence);
    // Colour only the date phrase, never the whole sentence.
    const datePattern = lang === "ar" ? DATE_AR : DATE_EN;
    html = html.replace(datePattern, (match) => `<span style="color:var(--color-info)">${match}</span>`);
    // Bold at most two priority words so the note stays readable.
    let bolded = 0;
    for (const word of PRIORITY_WORDS) {
      if (bolded >= 2) break;
      if (!containsAny(sentence, [word])) continue;
      const escapedWord = escapeHtml(word);
      const pattern = new RegExp(escapeRegExp(escapedWord), "i");
      if (!pattern.test(html)) continue;
      html = html.replace(pattern, `<strong>${escapedWord}</strong>`);
      bolded += 1;
    }
    return html;
  }

  function deriveTitle(sentences, lang, fallback) {
    const text = sentences.join(" ");
    if (lang === "ar") {
      const match = text.match(
        /(امتحان|اختبار|كويز|مذاكرة|مراجعة|واجب|مشروع|محاضرة)\s+([\u0621-\u064A][\u0621-\u064A\s]{1,40})/,
      );
      if (match) {
        const stop = new RegExp(`\\s+(?:${DAY_WORDS_AR}|عندي|لازم|يوم|الساعة|ضروري|مهم|بسبب|علشان|عشان)\\b.*$`);
        const subject = match[2].replace(stop, "").trim();
        if (subject) return `${match[1]} ${subject}`;
      }
    } else {
      const match = text.match(/\b(exam|test|quiz|assignment|project|lecture)\s+(?:in|on|for|of)?\s*([A-Za-z][A-Za-z\s]{1,40})/i);
      if (match) {
        const stop = new RegExp(`\\s+(?:${DAY_WORDS_EN}|on|at|because|and|but|i|we|must|need)\\b.*$`, "i");
        const subject = match[2].replace(stop, "").trim();
        if (subject) return `${match[1][0].toUpperCase()}${match[1].slice(1).toLowerCase()} ${subject}`;
      }
    }
    return String(fallback || "").trim() || (lang === "ar" ? "ملاحظة منظمة" : "Organized note");
  }

  function organize(input, options) {
    const opts = options || {};
    const source = String(input || "").replace(/\u00a0/g, " ");
    const sentences = splitSentences(source);
    const lang = opts.lang === "ar" || opts.lang === "en" ? opts.lang : isArabic(source) ? "ar" : "en";
    const ar = lang === "ar";
    const title = String(opts.title || "").trim() || deriveTitle(sentences, lang, "");
    const buckets = {
      dates: [],
      tasks: [],
      priorities: [],
      warnings: [],
      info: [],
      low: [],
    };
    const seen = new Set();
    const push = (bucket, value) => {
      const key = `${bucket}:${value}`;
      if (!value || seen.has(key)) return;
      seen.add(key);
      buckets[bucket].push(value);
    };

    for (const sentence of sentences) {
      const dates = findDates(sentence);
      const task = isTaskSentence(sentence);
      const priority = isPriority(sentence);
      const warning = isWarning(sentence);
      const low = isLowPriority(sentence);
      if (dates.length) push("dates", sentence);
      if (task) {
        for (const item of taskText(sentence)) push("tasks", item);
      }
      if (priority) push("priorities", sentence);
      if (warning) push("warnings", sentence);
      if (low) push("low", sentence);
      if (!dates.length && !task && !priority && !warning && !low) push("info", sentence);
    }

    const labels = ar
      ? {
          dates: "المواعيد",
          tasks: "المهام المطلوبة",
          priority: "الأولوية",
          warning: "تحذير",
          notes: "ملاحظات",
          low: "لاحقًا / اختياري",
        }
      : {
          dates: "Dates & times",
          tasks: "Tasks",
          priority: "Priority",
          warning: "Warning",
          notes: "Notes",
          low: "Later / optional",
        };

    const html = [];
    html.push(`<h2 dir="auto">${escapeHtml(title)}</h2>`);
    if (buckets.dates.length) {
      html.push(`<p><strong>${labels.dates}:</strong></p>`);
      buckets.dates.forEach((sentence) => {
        html.push(`<p dir="auto">${highlightText(sentence, lang)}</p>`);
      });
    }
    if (buckets.tasks.length) {
      html.push(`<h3>${labels.tasks}</h3><ul class="rt-checklist">`);
      buckets.tasks.forEach((task) => {
        html.push(`<li data-checked="false" dir="auto">${highlightText(task, lang)}</li>`);
      });
      html.push("</ul>");
    }
    if (buckets.priorities.length) {
      const priorityTasks = buckets.tasks.filter((task) => isPriority(task));
      const summary = (priorityTasks.length ? priorityTasks.slice(0, 3) : buckets.priorities.slice(0, 2))
        .map((item) => escapeHtml(item))
        .join(ar ? " و" : " and ");
      html.push(
        `<p><strong style="color:var(--color-danger)">${labels.priority}:</strong> <strong>${summary}</strong></p>`,
      );
    }
    if (buckets.warnings.length) {
      buckets.warnings.forEach((sentence) => {
        html.push(
          `<p><strong style="color:var(--color-warning)">${labels.warning}:</strong> ${highlightText(sentence, lang)}</p>`,
        );
      });
    }
    if (buckets.low.length) {
      html.push(`<h3>${labels.low}</h3>`);
      buckets.low.forEach((sentence) => {
        html.push(`<p dir="auto">${highlightText(sentence, lang)}</p>`);
      });
    }
    if (buckets.info.length) {
      html.push(`<h3>${labels.notes}</h3>`);
      buckets.info.forEach((sentence) => {
        html.push(`<p dir="auto">${highlightText(sentence, lang)}</p>`);
      });
    }

    return {
      html: html.join(""),
      title,
      lang,
      source: "local-rules",
      counts: {
        sentences: sentences.length,
        dates: buckets.dates.length,
        tasks: buckets.tasks.length,
        priorities: buckets.priorities.length,
        warnings: buckets.warnings.length,
        info: buckets.info.length,
      },
    };
  }

  function plainText(html) {
    return String(html || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  return {
    organize,
    plainText,
    isArabic,
    // Exported for the test suite.
    _internal: {
      splitSentences,
      findDates,
      isTaskSentence,
      isPriority,
      isWarning,
      taskText,
      normalizeForMatch,
    },
  };
});
