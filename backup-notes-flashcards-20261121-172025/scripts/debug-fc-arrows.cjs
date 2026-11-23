// Debug: flashcards keyboard arrow navigation after modal/flip flows (temporary).
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 5597;
const BASE = `http://127.0.0.1:${PORT}/`;

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`);
  console.log(`  ✓ ${message}`);
}

(async () => {
  console.log("Starting temporary Second Brain server on : " + PORT + " …");
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
  page.on("pageerror", (err) => errors.push("pageerror: " + err.message));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push("console: " + msg.text()); });

  await page.goto(`${BASE}#flashcards`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".nav-link[data-page]", { timeout: 30000 });
  await page.waitForSelector('[data-fc-view="dashboard"]', { timeout: 25000 });
  await page.waitForTimeout(1500);
  const close = page.locator('#auth-modal [data-close-modal]').first();
  if (await close.isVisible().catch(() => false)) { await close.dispatchEvent("click"); await page.waitForTimeout(400); }

  await page.locator('.fc-hero-actions button[data-action="fc-new-deck"]').first().dispatchEvent("click");
  await page.waitForSelector(".fc-modal", { timeout: 8000 });
  await page.fill("#fc-deck-name", "مجموعة تشخيص");
  await page.locator('button[data-action="fc-save-deck"]').dispatchEvent("click");
  await page.waitForSelector(".fc-deck-card", { timeout: 8000 });
  for (let i = 1; i <= 3; i += 1) {
    await page.locator('.fc-hero-actions button[data-action="fc-add-card"]').first().dispatchEvent("click");
    await page.waitForSelector(".fc-modal", { timeout: 8000 });
    await page.selectOption("#fc-editor-deck", { index: 0 });
    await page.fill("#fc-editor-front", `كلمة اختبار ${i}؟`);
    await page.fill("#fc-editor-back", `إجابة ${i}`);
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

  const modalState = async (label) => {
    const m = await page.evaluate(() => ({
      modal: Boolean(document.querySelector(".fc-modal")),
      view: window.StudyZoneFlashcards?.Api?.getView?.() || null,
      revealed: window.StudyZoneFlashcards?.Api?.getSessionState?.()?.revealed,
      peek: window.StudyZoneFlashcards?.Api?.getSessionState?.()?.peekIndex,
      active: document.activeElement ? document.activeElement.tagName : "none",
    }));
    console.log(`  [${label}]`, JSON.stringify(m));
    return m;
  };

  // 1. flip twice
  const studyCard = page.locator(".fc-card-stage .fc-card");
  await studyCard.dispatchEvent("click");
  await page.waitForTimeout(500);
  await studyCard.dispatchEvent("click");
  await page.waitForTimeout(500);

  // 2. open edit modal via pencil, close via Escape
  await page.locator('.fc-card-stage .fc-card button.fc-card-action-edit').dispatchEvent("click");
  await page.waitForSelector(".fc-modal", { timeout: 8000 });
  await modalState("edit-modal-open");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await modalState("edit-modal-after-escape");

  // 3. open delete modal via X, close via Escape
  await page.locator('.fc-card-stage .fc-card button.fc-card-action-delete').dispatchEvent("click");
  await page.waitForSelector(".fc-modal", { timeout: 8000 });
  await modalState("delete-modal-open");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await modalState("delete-modal-after-escape");

  // 4. arrow navigation
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1500);
  const peekVisible = await page.$(".fc-peek-card");
  console.log("  peek visible after ArrowRight:", Boolean(peekVisible));
  await modalState("after-arrow");

  console.log("errors:", errors);
  await browser.close();
  server.kill();
  process.exit(0);
})().catch((err) => { console.error("DEBUG FAILED:", err.message); process.exit(1); });
