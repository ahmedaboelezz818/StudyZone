// Reproduce the Escape-closes-modal failure and capture the error.
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 5591;
const BASE = `http://127.0.0.1:${PORT}/`;

(async () => {
  const server = spawn(process.execPath, [path.resolve(__dirname, "..", "server.js")], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((r) => setTimeout(r, 400));
    try { const res = await fetch(BASE); if (res.ok) break; } catch (_) { /* not ready */ }
  }
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  const errors = [];
  page.on("pageerror", (err) => { errors.push("pageerror: " + err.message); console.log("PAGEERROR:", err.message.slice(0, 500)); if (err.stack) console.log("STACK:", err.stack.slice(0, 4000)); });
  page.on("console", (msg) => { if (msg.type() === "error") { errors.push("console: " + msg.text()); console.log("CONSOLE ERROR:", msg.text().slice(0, 500)); } });

  await page.addInitScript(() => {
    const describe = (el) => el ? (el.tagName + "#" + (el.id || "") + "." + String(el.className || "").slice(0, 70)) : "none";
    const chain = (el) => {
      const parts = [];
      let node = el;
      let guard = 0;
      while (node && guard < 10) { parts.push(describe(node)); node = node.parentElement; guard += 1; }
      return parts;
    };
    const wrap = (name) => {
      const original = Event.prototype[name];
      Event.prototype[name] = function (...args) {
        if (this && this.type === "keydown") {
          window.__stopCalls = window.__stopCalls || [];
          let currentTarget = "unknown";
          let chainInfo = [];
          try { currentTarget = describe(this.currentTarget); chainInfo = chain(this.currentTarget); } catch (_) { /* ignore */ }
          window.__stopCalls.push({
            key: this.key,
            method: name,
            currentTarget,
            chain: chainInfo,
            stack: (new Error("stack").stack || "").split("\n").slice(1, 12).join(" | "),
          });
        }
        return original.apply(this, args);
      };
    };
    const originalAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (type === "keydown") {
        window.__keydownRegistrations = window.__keydownRegistrations || [];
        window.__keydownRegistrations.push({
          target: this === window ? "window" : this === document ? "document" : (this && this.tagName ? this.tagName + "#" + (this.id || "") : "?"),
          fn: (listener && listener.name) || "anonymous",
          stack: (new Error("stack").stack || "").split("\n").slice(1, 10).join(" | "),
        });
      }
      return originalAdd.call(this, type, listener, options);
    };
    wrap("stopPropagation");
    wrap("stopImmediatePropagation");
  });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".nav-link[data-page]", { timeout: 30000 });
  await page.reload({ waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await page.waitForSelector(".nav-link[data-page]", { timeout: 30000 });
  const close = page.locator('#auth-modal [data-close-modal]').first();
  if (await close.isVisible().catch(() => false)) { await close.dispatchEvent("click"); await page.waitForTimeout(400); }
  let fcReady = false;
  for (let attempt = 0; attempt < 6 && !fcReady; attempt += 1) {
    await page.locator('.nav-link[data-page="flashcards"]').first().dispatchEvent("click");
    try {
      await page.waitForSelector('[data-fc-view]', { timeout: 12000, state: "visible" });
      fcReady = true;
    } catch (_) {
      console.log(`  flashcards view not visible yet (attempt ${attempt + 1}/6)`);
      await page.waitForTimeout(1200);
    }
  }
  if (!fcReady) throw new Error("flashcards view did not render");

  // Create a deck and a card so we can reach the review stage like the E2E.
  await page.locator('.fc-hero-actions button[data-action="fc-new-deck"]').first().dispatchEvent("click");
  await page.waitForSelector(".fc-modal", { timeout: 8000 });
  await page.fill("#fc-deck-name", "مجموعة اختبار");
  await page.locator('button[data-action="fc-save-deck"]').dispatchEvent("click");
  await page.waitForSelector(".fc-deck-card", { timeout: 8000 });
  for (let i = 1; i <= 3; i += 1) {
    await page.locator('.fc-hero-actions button[data-action="fc-add-card"]').first().dispatchEvent("click");
    await page.waitForSelector(".fc-modal", { timeout: 8000 });
    await page.selectOption("#fc-editor-deck", { index: 0 });
    await page.fill("#fc-editor-front", `سؤال ${i}؟`);
    await page.fill("#fc-editor-back", `جواب ${i}`);
    await page.locator('button[data-action="fc-save-card"]').dispatchEvent("click");
    await page.waitForTimeout(700);
  }
  const closeBtn = page.locator('.fc-modal-footer button[data-action="fc-modal-close"]').first();
  if (await closeBtn.count()) { await closeBtn.dispatchEvent("click"); await page.waitForTimeout(400); }

  await page.locator('button[data-action="fc-open-decks"]').first().dispatchEvent("click");
  await page.waitForSelector(".fc-deck-card", { timeout: 8000 });
  await page.locator('.fc-deck-card button[data-action="fc-start-deck"]').dispatchEvent("click");
  await page.waitForSelector(".fc-card-stage .fc-card", { timeout: 10000 });
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    document.getElementById("page-content").addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        window.__escCounts = window.__escCounts || [];
        window.__escCounts.push({ modalCount: document.querySelectorAll(".fc-modal").length, target: e.target ? (e.target.tagName + "#" + (e.target.id || "") + "." + String(e.target.className || "").slice(0, 50)) : "none" });
      }
    }, true);
  });
  // Open edit modal, Escape it, then open delete modal, Escape it.
  await page.locator('.fc-card-stage .fc-card button.fc-card-action-edit').dispatchEvent("click");
  await page.waitForSelector(".fc-modal", { timeout: 8000 });
  await page.evaluate(() => {
    window.__probe = { window: 0, document: 0, content: 0, captureWindow: 0 };
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") window.__probe.window += 1; }, true);
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") window.__probe.window += 100; });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") window.__probe.document += 1; }, true);
    const content = document.querySelector(".flashcards-workspace-content, [data-fc-view]");
    content?.addEventListener("keydown", (e) => { if (e.key === "Escape") window.__probe.content += 1; }, true);
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  console.log("window probe after edit-modal Escape:", JSON.stringify(await page.evaluate(() => window.__probe.window)));
  console.log("modal after edit Escape:", await page.evaluate(() => Boolean(document.querySelector(".fc-modal"))));
  console.log("activeElement:", await page.evaluate(() => document.activeElement ? document.activeElement.tagName + "." + String(document.activeElement.className || "").slice(0,60) : "null"));
  await page.locator('.fc-card-stage .fc-card button.fc-card-action-delete').dispatchEvent("click");
  await page.waitForSelector(".fc-modal", { timeout: 8000 });
  await page.evaluate(() => {
    window.__probe.docBubble = 0;
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") window.__probe.docBubble += 1; });
    window.__probe.activeDelete = document.activeElement ? document.activeElement.tagName + "." + String(document.activeElement.className || "").slice(0,60) : "null";
  });
  const popoverInfo = await page.evaluate(() => {
    const pops = [...document.querySelectorAll(".sz-pop")];
    return pops.map((p) => ({
      cls: String(p.className).slice(0, 80),
      visible: p.offsetWidth > 0 && p.offsetHeight > 0,
      text: (p.textContent || "").trim().slice(0, 60),
    }));
  });
  console.log("sz-pop elements:", JSON.stringify(popoverInfo, null, 2));
  await page.evaluate(() => { const content = document.querySelector(".flashcards-workspace-content, [data-fc-view]"); content?.addEventListener("keydown", (e) => { if (e.key === "Escape") window.__probe.content += 1; }, true); });
  await page.evaluate(() => {
    window.__mutations = [];
    window.__fcHotkeyLog = true;
    window.__fcLogCalls = [];
    const target = document.getElementById("page-content");
    const observer = new MutationObserver(() => {
      const count = document.querySelectorAll(".fc-modal").length;
      window.__mutations.push({ at: Date.now(), modalCount: count });
    });
    observer.observe(target, { childList: true, subtree: true });
    window.__closeModalProbe = true;
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  const fcLogs = await page.evaluate(() => window.__fcLogCalls || []);
  console.log("captured [FC-HANDLER] logs:", JSON.stringify(fcLogs, null, 2));
  const stopCalls = await page.evaluate(() => window.__stopCalls || []);
  console.log("mutations around Escape#2:", JSON.stringify(await page.evaluate(() => window.__mutations), null, 2));
  const decisive = await page.evaluate(() => {
    const el = document.getElementById("page-content");
    const includeModal = el ? el.innerHTML.includes("Delete card?") : null;
    const mutations = [];
    const observer = new MutationObserver((records) => mutations.push(records.length));
    observer.observe(el, { childList: true, subtree: true });
    el.innerHTML = el.innerHTML;
    observer.disconnect();
    return {
      allCount: document.querySelectorAll("[id='page-content']").length,
      includesDeleteModal: includeModal,
      appPage: window.StudyZoneApp?.page ?? "undefined",
      fcView: window.StudyZoneFlashcards?.Api?.getView?.() ?? "undefined",
      sameHtmlMutations: mutations.length,
      innerHTMLLength: el ? el.innerHTML.length : -1,
    };
  });
  console.log("decisive probe:", JSON.stringify(decisive, null, 2));
  console.log("stopPropagation calls for Escape#2:", JSON.stringify(stopCalls, null, 2));
  console.log("window probe after delete-modal Escape:", JSON.stringify(await page.evaluate(() => window.__probe.window)));
  const appPage2 = await page.evaluate(() => window.StudyZoneApp?.page ?? "undefined");
  console.log("StudyZoneApp.page at Escape#2:", appPage2);
  const remainingAfter2 = await page.evaluate(() => {
    const modals = [...document.querySelectorAll(".fc-modal")];
    return modals.map((m) => ({ cls: String(m.className).slice(0, 80), text: (m.textContent || "").trim().slice(0, 100) }));
  });
  console.log("remaining .fc-modal right after Escape#2:", JSON.stringify(remainingAfter2, null, 2));
  const modalChain = await page.evaluate(() => {
    const modal = document.querySelector(".fc-modal");
    if (!modal) return "none";
    const chain = [];
    let el = modal;
    while (el && el !== document.documentElement) {
      chain.push(el.tagName + "#" + (el.id || "") + "." + String(el.className || "").slice(0, 60));
      el = el.parentElement;
    }
    return chain;
  });
  console.log(".fc-modal parent chain:", JSON.stringify(modalChain, null, 2));
  const probe = await page.evaluate(() => window.__probe);
  const escCounts = await page.evaluate(() => window.__escCounts || []);
  console.log("escCounts:", JSON.stringify(escCounts, null, 2));
  console.log("probe counts:", JSON.stringify(probe, null, 2));
  const state = await page.evaluate(() => ({
    modal: Boolean(document.querySelector(".fc-modal")),
    view: window.StudyZoneFlashcards?.Api?.getView?.() || null,
    visibility: document.visibilityState,
    banner: document.getElementById("startup-error-banner")?.innerText || null,
  }));
  console.log("final state:", JSON.stringify(state));
  // Second Escape + click the modal close button to localize the failure.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  console.log("modal after 2nd Escape:", await page.evaluate(() => Boolean(document.querySelector(".fc-modal"))));
  const closeModalBtn = page.locator('.fc-modal-footer button[data-action="fc-modal-close"], .fc-modal button[data-action="fc-modal-close"]').first();
  if (await closeModalBtn.count()) { await closeModalBtn.dispatchEvent("click"); await page.waitForTimeout(500); }
  console.log("modal after close-button click:", await page.evaluate(() => Boolean(document.querySelector(".fc-modal"))));
  const regs = await page.evaluate(() => window.__keydownRegistrations || []);
  console.log("keydown registrations:", JSON.stringify(regs, null, 2));
  const modalHtml = await page.evaluate(() => {
    const modals = [...document.querySelectorAll(".fc-modal")];
    return modals.map((m) => ({ cls: String(m.className).slice(0, 60), text: (m.textContent || "").trim().slice(0, 120) }));
  });
  console.log("remaining .fc-modal elements:", JSON.stringify(modalHtml, null, 2));
  console.log("errors:", errors);
  const bannerVal = await page.evaluate(() => window.StudyZoneDiagnostics ? window.StudyZoneDiagnostics.errors().slice(-3) : []);
  console.log("stored runtime errors:", JSON.stringify(bannerVal, null, 2));
  await browser.close();
  server.kill();
  process.exit(0);
})().catch((err) => { console.error("REPRO FAILED:", err.message); process.exit(1); });
