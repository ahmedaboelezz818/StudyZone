/*
 * Study Zone sync interface.
 *
 * The offline engine (offline-sync.js) owns the data. This module only renders
 * its state: the topbar connection chip, the live settings summary and the
 * conflict resolution list. It deliberately keeps its own copy of the small
 * label dictionary so it still works if the main app fails to boot.
 */
(() => {
  "use strict";

  const offline = window.StudyZoneOffline;
  if (!offline) return;

  const labels = {
    en: {
      synced: "Synced",
      syncing: "Syncing",
      pending: "Pending sync",
      failed: "Sync failed",
      offline: "Offline",
      syncNow: "Sync now",
      conflict: "Sync conflict",
      conflictBody:
        "This item changed on another device while you were offline. Choose which version to keep.",
      keepMine: "Keep this device",
      keepServer: "Keep server version",
      noConflicts: "No conflicts to resolve.",
      queued: "queued",
      lastSync: "Last sync",
      never: "Never",
    },
    ar: {
      synced: "متزامن",
      syncing: "جارٍ المزامنة",
      pending: "بانتظار المزامنة",
      failed: "فشلت المزامنة",
      offline: "غير متصل",
      syncNow: "زامن الآن",
      conflict: "تعارض في المزامنة",
      conflictBody:
        "تغيّر هذا العنصر على جهاز آخر أثناء عدم اتصالك. اختر النسخة التي تريد الاحتفاظ بها.",
      keepMine: "احتفظ بنسخة هذا الجهاز",
      keepServer: "احتفظ بنسخة الخادم",
      noConflicts: "لا توجد تعارضات.",
      queued: "في الانتظار",
      lastSync: "آخر مزامنة",
      never: "أبدًا",
    },
  };

  function language() {
    const fromApp = window.StudyZoneApp?.language;
    if (fromApp === "ar" || fromApp === "en") return fromApp;
    return document.documentElement.lang === "ar" ? "ar" : "en";
  }

  function t(key) {
    return labels[language()][key] || labels.en[key] || key;
  }

  function statusLabel(status) {
    return t(
      ["synced", "syncing", "pending", "failed", "offline"].includes(status)
        ? status
        : "synced",
    );
  }

  function formatDate(value) {
    if (!value) return t("never");
    try {
      return new Intl.DateTimeFormat(language() === "ar" ? "ar-EG" : "en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
    } catch {
      return t("never");
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  }

  function syncChip() {
    let chip = document.querySelector("[data-sync-chip]");
    if (chip) return chip;
    const actions = document.querySelector(".topbar-actions");
    if (!actions) return null;
    chip = document.createElement("button");
    chip.type = "button";
    chip.className = "sync-chip";
    chip.dataset.syncChip = "";
    chip.dataset.state = "synced";
    chip.setAttribute("aria-live", "polite");
    chip.innerHTML = `<i aria-hidden="true"></i><span>${escapeHtml(t("synced"))}</span>`;
    const anchor =
      actions.querySelector("#global-search-open") ||
      actions.querySelector(".notification-button") ||
      actions.lastElementChild;
    if (anchor?.parentNode === actions) actions.insertBefore(chip, anchor);
    else actions.appendChild(chip);
    return chip;
  }

  function renderChip() {
    const chip = syncChip();
    if (!chip) return;
    const state = offline.state;
    chip.dataset.state = state.status;
    chip.title = `${statusLabel(state.status)} · ${state.pending} ${t("queued")}`;
    chip.setAttribute(
      "aria-label",
      `${statusLabel(state.status)}. ${state.pending} ${t("queued")}.`,
    );
    const text = chip.querySelector("span");
    if (text) text.textContent = statusLabel(state.status);
  }

  function conflictCard(conflict) {
    const table = String(conflict.table || "item").replace(/_/g, " ");
    const when = formatDate(conflict.createdAt);
    return `<div class="sync-conflict" data-conflict-id="${escapeHtml(conflict.id)}">
      <strong>${escapeHtml(t("conflict"))} · ${escapeHtml(table)}</strong>
      <small>${escapeHtml(t("conflictBody"))} ${escapeHtml(when)}</small>
      <div class="sync-conflict-actions">
        <button class="button button-primary button-small" type="button" data-conflict-choice="local">${escapeHtml(t("keepMine"))}</button>
        <button class="button button-secondary button-small" type="button" data-conflict-choice="server">${escapeHtml(t("keepServer"))}</button>
      </div>
    </div>`;
  }

  let conflictRenderToken = 0;
  async function renderConflicts() {
    const list = document.querySelector("[data-sync-conflict-list]");
    if (!list) return;
    const token = ++conflictRenderToken;
    let conflicts = [];
    try {
      conflicts = (await offline.getConflicts?.()) || [];
    } catch (error) {
      console.warn("[StudyZoneSyncUI] could not read conflicts", error);
    }
    if (token !== conflictRenderToken) return;
    list.innerHTML = conflicts.length
      ? conflicts.map(conflictCard).join("")
      : `<p class="data-caption">${escapeHtml(t("noConflicts"))}</p>`;
  }

  function renderSettings() {
    const panel = document.querySelector("[data-sync-settings]");
    if (!panel) return;
    const state = offline.state;
    const set = (selector, value) => {
      const node = panel.querySelector(selector);
      if (node) node.textContent = value;
    };
    set("[data-sync-status]", statusLabel(state.status));
    set("[data-sync-pending]", String(state.pending));
    set("[data-sync-failed]", String(state.failed));
    set("[data-sync-conflicts]", String(state.conflicts));
    set("[data-sync-last]", formatDate(state.lastSyncAt));
    void renderConflicts();
  }

  function refresh() {
    renderChip();
    renderSettings();
  }

  // The app re-renders pages on navigation and language changes. Re-apply the
  // live values whenever a new settings panel appears. The marker prevents the
  // observer from reacting to our own conflict list updates.
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const panel = document.querySelector("[data-sync-settings]");
      if (panel && !panel.dataset.syncBound) {
        panel.dataset.syncBound = "1";
        refresh();
        return;
      }
      if (!document.querySelector("[data-sync-chip]")) renderChip();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  for (const event of [
    "state",
    "online",
    "offline",
    "sync-start",
    "sync-complete",
    "conflict-resolved",
    "user-cleared",
  ]) {
    offline.on?.(event, refresh);
  }
  window.addEventListener("studyzone:theme-changed", renderChip);
  window.addEventListener("studyzone:notification-types", refresh);

  document.addEventListener("click", async (event) => {
    const chip = event.target.closest?.("[data-sync-chip]");
    if (chip) {
      window.StudyZoneApp?.navigate?.("settings");
      window.setTimeout(() => {
        document
          .querySelector("[data-sync-settings]")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
      return;
    }

    const choice = event.target.closest?.("[data-conflict-choice]");
    if (!choice) return;
    event.preventDefault();
    event.stopPropagation();
    const card = choice.closest("[data-conflict-id]");
    const conflictId = card?.dataset.conflictId;
    if (!conflictId) return;
    const buttons = card.querySelectorAll("button");
    buttons.forEach((button) => {
      button.disabled = true;
    });
    try {
      await offline.resolveConflict(conflictId, choice.dataset.conflictChoice);
      refresh();
    } catch (error) {
      console.warn("[StudyZoneSyncUI] could not resolve conflict", error);
      buttons.forEach((button) => {
        button.disabled = false;
      });
    }
  });

  window.StudyZoneSyncUI = {
    refresh,
    renderChip,
    renderSettings,
    renderConflicts,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh, { once: true });
  } else {
    refresh();
  }
})();
