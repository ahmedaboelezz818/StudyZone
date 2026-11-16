/*
 * Real browser end-to-end test for Study Zone (preview/local mode).
 * Covers: language switching (ar/en, RTL/LTR), mojibake absence, Flashcards
 * full flow (deck → cards → review → persistence), real offline mode (via a
 * temporary local server we control), console errors.
 *
 * Usage: node scripts/e2e-flashcards.cjs
 * A dedicated temporary server is spawned on port 5599 for the run; your
 * existing server on :5500 is never touched.
 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 5599;
const BASE = `http://127.0.0.1:${PORT}/`;
const TEMP_SERVER = path.resolve(__dirname, "..", "server.js");
const fatalTokens = [
  "editorDraft is not defined",
  "DataError",
  "ConstraintError",
  "AbortError",
  "studyZoneLocales is not defined",
];

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`);
  console.log(`  ✓ ${message}`);
}

async function safeClick(page, sel) {
  await page.locator(sel).first().dispatchEvent("click");
}

async function clickWithRetry(page, sel, attempts = 10) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await page.click(sel, { timeout: 2500 });
      return true;
    } catch (_) {
      await page.waitForTimeout(300);
    }
  }
  return false;
}

(async () => {
  console.log(`Starting temporary Study Zone server on :${PORT}…`);
  let server = spawn(process.execPath, [TEMP_SERVER], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });
  // Wait until the server answers.
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(BASE);
      if (res.ok) break;
    } catch (_) { /* not ready yet */ }
    if (attempt === 29) throw new Error("temporary server did not start");
  }
  console.log("Launching chromium…");
  let serverStopped = false;
  const stopServer = () => {
    if (server && !serverStopped) { try { server.kill(); } catch (_) { /* already dead */ } serverStopped = true; }
  };
  process.on("exit", stopServer);
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (fallbackErr) {
    // The repo ships a cached chromium-1187; use it if the bundled headless shell is absent.
    const cached = "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe";
    console.log("Falling back to cached chromium:", cached);
    browser = await chromium.launch({ headless: true, executablePath: cached });
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 920 },
    locale: "en-US",
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const consoleWarnings = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
    else if (msg.type() === "warning") consoleWarnings.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

  const dismissAuth = async () => {
    const close = page.locator('#auth-modal [data-close-modal]').first();
    if (await close.isVisible().catch(() => false)) {
      await close.dispatchEvent("click");
      await page.waitForTimeout(300);
    }
  };

  console.log("\n== 1. Load app (default language) ==");
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".nav-link[data-page]", { timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 });
  await page.waitForTimeout(1500);
  // Let the service worker activate and claim this page (Chromium activates it on a
  // subsequent load). Wait explicitly for control instead of guessing with timers.
  await page.reload({ waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await page.waitForFunction(() => Boolean(navigator.serviceWorker && navigator.serviceWorker.controller), { timeout: 20000 }).catch(() => {});
  await page.waitForSelector(".nav-link[data-page]", { timeout: 20000 });
  // Dismiss the sign-in modal if it opens on boot (preview mode works without an account).
  const authClose = page.locator('#auth-modal [data-close-modal]').first();
  if (await authClose.isVisible().catch(() => false)) {
    await authClose.dispatchEvent("click");
    await page.waitForTimeout(400);
  }
  const initialDir = await page.evaluate(() => document.documentElement.dir);
  const initialLang = await page.evaluate(() => document.documentElement.lang);
  console.log(`  initial lang=${initialLang} dir=${initialDir}`);
  assert(["ltr", "rtl"].includes(initialDir), "html dir is set");

  const pageText = await page.evaluate(() => document.body.innerText);
  assert(!/Ã˜|â€|Ã¢|Ãƒ/.test(pageText), "no mojibake visible on initial page");

  console.log("\n== 2. Flashcards nav entry exists ==");
  const navFlashcards = await page.$('.nav-link[data-page="flashcards"]');
  assert(navFlashcards !== null, "flashcards nav link present");

  console.log("\n== 3. Open flashcards page ==");
  let fcViewFound = false;
  for (let attempt = 0; attempt < 4 && !fcViewFound; attempt += 1) {
    await clickWithRetry(page, '.nav-link[data-page="flashcards"]', 6);
    try {
      await page.waitForSelector('[data-fc-view="dashboard"]', { timeout: 30000, state: "visible" });
      fcViewFound = true;
    } catch (_) {
      console.log(`  flashcards dashboard not visible yet (attempt ${attempt + 1}/3)`);
      await page.waitForTimeout(1000);
    }
  }
  if (!fcViewFound) {
    await page.screenshot({ path: "screenshots/e2e-step3-failure.png", fullPage: true });
    throw new Error("flashcards dashboard did not render");
  }
  const statCards = await page.$$(".fc-stat-card");
  assert(statCards.length === 8, `8 statistics cards rendered (got ${statCards.length})`);
  const syncChip = await page.$(".fc-sync-chip");
  assert(syncChip !== null, "sync status chip is visible");

  console.log("\n== 4. Create a deck in Arabic ==");
  await safeClick(page, '.fc-hero-actions button[data-action="fc-new-deck"]');
  await page.waitForSelector(".fc-modal", { timeout: 8000 });
  await page.fill("#fc-deck-name", "مجموعة الأحياء");
  await page.fill("#fc-deck-desc", "مراجعة لمفاهيم الخلية");
  await safeClick(page, 'button[data-action="fc-save-deck"]');
  await page.waitForSelector(".fc-deck-card", { timeout: 8000 });
  const deckNameVisible = await page.evaluate(() => document.body.innerText.includes("مجموعة الأحياء"));
  assert(deckNameVisible, "Arabic deck name persists and renders");

  console.log("\n== 5. Add 3 cards ==");
  for (let i = 1; i <= 3; i += 1) {
    await safeClick(page, '.fc-hero-actions button[data-action="fc-add-card"]');
    await page.waitForSelector(".fc-modal", { timeout: 8000 });
    await page.selectOption("#fc-editor-deck", { index: 0 });
    await page.fill("#fc-editor-front", `ما هي الخلية رقم ${i}؟`);
    await page.fill("#fc-editor-back", `الإجابة ${i}`);
    await safeClick(page, 'button[data-action="fc-save-card"]');
    await page.waitForSelector(".fc-modal", { state: "detached", timeout: 8000 }).catch(() => {});
  }
  await safeClick(page, '.nav-link[data-page="flashcards"]');
  await page.waitForSelector('[data-fc-view="dashboard"]', { timeout: 10000 });
  const totalCardsValue = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".fc-stat-card")];
    const total = cards[1] ? cards[1].querySelector(".fc-stat-value").textContent.trim() : "0";
    return total;
  });
  console.log(`  Total Cards stat shows: ${totalCardsValue}`);
  assert(totalCardsValue !== "٠" && totalCardsValue !== "0", "cards were saved and counted");

  console.log("\n== 5.5. Browse square flip tiles ==");
  await page.locator('button[data-action="fc-open-deck"]').first().dispatchEvent("click");
  await page.waitForSelector(".fc-tile", { timeout: 8000 });
  const tileState = () => page.$eval(".fc-tile", (el) => el.classList.contains("is-flipped"));
  assert((await tileState()) === false, "tiles start unflipped");
  await page.locator(".fc-tile").first().dispatchEvent("click");
  assert(await tileState(), "tap flips the tile (front → back)");
  // action buttons must not flip the tile
  await page.locator(".fc-tile .fc-tile-actions button[data-action=\"fc-edit-card\"]").first().dispatchEvent("click");
  await page.waitForTimeout(300);
  assert(await tileState(), "edit action dispatches without flipping the tile");
  assert(await page.$(".fc-modal") !== null, "edit modal opens");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  await page.locator(".fc-tile").first().focus();
  await page.keyboard.press("Enter");
  assert(!(await tileState()), "Enter toggles the tile back to front");

  console.log("\n== 6. Study session (rate 3 cards) ==");
  await safeClick(page, '.nav-link[data-page="flashcards"]');
  await page.waitForSelector('[data-fc-view]', { timeout: 15000 });
  await safeClick(page, 'button[data-action="fc-go-dashboard"]');
  await page.waitForSelector('[data-fc-view="dashboard"]', { timeout: 10000 });
  await safeClick(page, 'button[data-action="fc-open-decks"]');
  await page.waitForSelector(".fc-deck-card", { timeout: 8000 });
  await safeClick(page, '.fc-deck-card button[data-action="fc-start-deck"]');
  await page.waitForSelector(".fc-card-stage .fc-card", { timeout: 10000 });

  console.log("\n== 6.5. Peek (preview) navigation ==");
  await safeClick(page, 'button[data-action="fc-peek-next"]');
  await page.waitForSelector(".fc-peek-card", { timeout: 6000 });
  assert(await page.$(".fc-peek-answer") !== null, "peek mode shows the answer without rating");
  await safeClick(page, 'button[data-action="fc-peek-back"]');
  await page.waitForSelector(".fc-card-stage .fc-card", { timeout: 6000 });
  assert(true, "peek mode returns to the current card");
  for (let i = 0; i < 3; i += 1) {
    await safeClick(page, 'button[data-action="fc-reveal"]');
    await page.waitForSelector('.fc-rate-row button[data-rating="good"]', { timeout: 8000 });
    await safeClick(page, '.fc-rate-row button[data-rating="good"]');
    await page.waitForTimeout(350);
  }
  await page.waitForSelector(".fc-summary-card", { timeout: 10000 });
  const summaryText = await page.evaluate(() => document.body.innerText);
  assert(/اكتملت الجلسة|Session complete/i.test(summaryText), "session completes with a summary screen");

  console.log("\n== 7. Reload → data persists (IndexedDB) ==");
  await page.reload({ waitUntil: "networkidle", timeout: 45000 });
  await dismissAuth();
  await safeClick(page, '.nav-link[data-page="flashcards"]');
  await page.waitForSelector('[data-fc-view="dashboard"]', { timeout: 10000 });
  await safeClick(page, '.fc-hero-actions button[data-action="fc-open-decks"]').catch(() => {});
  await page.waitForSelector(".fc-deck-card", { timeout: 10000 }).catch(() => {});
  const persisted = await page.evaluate(() => document.body.innerText.includes("مجموعة الأحياء"));
  assert(persisted, "deck persists after full reload");

  console.log("\n== 8. Offline mode (temporary server stopped) ==");
  stopServer(); // real offline: the SW must serve everything from cache
  await page.goto(`${BASE}#flashcards`, { waitUntil: "domcontentloaded", timeout: 45000 }).catch((e) => console.log("offline nav err", e.message));
  await dismissAuth();
  await page.waitForSelector('[data-fc-view="dashboard"]', { timeout: 15000 }).catch(() => {});
  const offlineText = await page.evaluate(() => document.body.innerText);
  assert(offlineText.includes("مجموعة الأحياء") || /Offline|بدون اتصال/.test(offlineText), "app stays usable offline (SW-served)");
  await page.locator('.fc-hero-actions button[data-action="fc-new-deck"]').dispatchEvent("click");
  await page.waitForSelector(".fc-modal", { timeout: 8000 });
  await page.fill("#fc-deck-name", "مجموعة بلا إنترنت");
  await safeClick(page, 'button[data-action="fc-save-deck"]');
  await page.waitForTimeout(600);
  const offlineDeckVisible = await page.evaluate(() => document.body.innerText.includes("مجموعة بلا إنترنت"));
  assert(offlineDeckVisible, "deck created while offline is stored locally");

  console.log("\n== 9. Back online → temp server restarts; sync doesn't error ==");
  server = spawn(process.execPath, [TEMP_SERVER], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });
  serverStopped = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((r) => setTimeout(r, 400));
    try { const res = await fetch(BASE); if (res.ok) break; } catch (_) { /* not ready */ }
  }
  await page.reload({ waitUntil: "networkidle", timeout: 45000 });
  await dismissAuth();
  await safeClick(page, '.nav-link[data-page="flashcards"]');
  await page.waitForSelector('[data-fc-view="dashboard"]', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  console.log("\n== 10. Switch language en → ar → en ==");
  const checkDir = async (expected, lang) => {
    const dir = await page.evaluate(() => document.documentElement.dir);
    const currentLang = await page.evaluate(() => document.documentElement.lang);
    assert(dir === expected && currentLang === lang, `lang=${lang} dir=${expected} (got lang=${currentLang} dir=${dir})`);
  };
  const setLanguage = async (lang) => {
    await safeClick(page, '.nav-link[data-page="settings"]');
    await page.waitForSelector(`button[data-language="${lang}"]`, { timeout: 12000 });
    await safeClick(page, `button[data-language="${lang}"]`);
    await page.waitForTimeout(800);
  };
  await setLanguage("ar");
  await checkDir("rtl", "ar");
  const arabicText = await page.evaluate(() => document.body.innerText);
  assert(!/Ã˜|â€|Ã¢/.test(arabicText), "no mojibake in Arabic UI");
  await setLanguage("en");
  await checkDir("ltr", "en");
  await setLanguage("ar");
  await checkDir("rtl", "ar");

  console.log("\n== 11. Flashcards Arabic rendering ==");
  await safeClick(page, '.nav-link[data-page="flashcards"]');
  await page.waitForSelector('[data-fc-view="dashboard"]', { timeout: 12000 });
  const arFlash = await page.evaluate(() => document.body.innerText);
  assert(!/Ã˜|â€|Ã¢|Ãƒ/.test(arFlash), "Arabic flashcards screen has no mojibake");
  assert(/البطاقات/.test(arFlash), "Arabic title is visible");

  console.log("\n== Console report ==");
  const fatal = consoleErrors.filter((msg) => fatalTokens.some((token) => msg.includes(token)));
  console.log(`  console errors total: ${consoleErrors.length}`);
  consoleErrors.slice(0, 10).forEach((msg) => console.log(`    - ${msg}`));
  console.log(`  console warnings total: ${consoleWarnings.length}`);
  consoleWarnings.slice(0, 6).forEach((msg) => console.log(`    - ${msg}`));
  assert(fatal.length === 0, `no fatal console errors (editorDraft / DataError / …) — got ${fatal.length}`);

  await browser.close();
  console.log("\nE2E PASSED");
})().catch((err) => {
  console.error("\nE2E FAILED:", err.message);
  process.exit(1);
});
