const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
(async () => {
  const PORT = 5580;
  const BASE = `http://127.0.0.1:${PORT}/`;
  const server = spawn(process.execPath, ["server.js"], { cwd: path.resolve(__dirname, ".."), env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch({ headless: true, executablePath: "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
  const page = await context.newPage();
  page.on("console", (m) => console.log(`[console.${m.type()}]`, m.text()));
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  const dismiss = page.locator('#auth-modal [data-close-modal]').first();
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".nav-link[data-page]", { timeout: 30000 });
  await page.waitForTimeout(1500);
  if (await dismiss.isVisible().catch(() => false)) await dismiss.dispatchEvent("click");
  await page.locator('.nav-link[data-page="flashcards"]').dispatchEvent("click");
  await page.waitForSelector('[data-fc-view="dashboard"]', { timeout: 15000 }).catch(() => console.log("no dashboard"));
  // create deck
  await page.locator('.fc-hero-actions button[data-action="fc-new-deck"]').first().dispatchEvent("click");
  await page.waitForSelector(".fc-modal", { timeout: 8000 });
  await page.fill("#fc-deck-name", "مجموعة الاختبار");
  await page.fill("#fc-deck-desc", "وصف");
  await page.locator('button[data-action="fc-save-deck"]').dispatchEvent("click");
  await page.waitForTimeout(700);
  console.log("after deck save, view =", await page.evaluate(() => document.querySelector("[data-fc-view]")?.getAttribute("data-fc-view")));
  // add 3 cards
  for (let i = 1; i <= 3; i += 1) {
    await page.locator('.fc-hero-actions button[data-action="fc-add-card"]').first().dispatchEvent("click");
    await page.waitForSelector(".fc-modal", { timeout: 8000 });
    await page.selectOption("#fc-editor-deck", { index: 0 });
    await page.fill("#fc-editor-front", `سؤال ${i}؟`);
    await page.fill("#fc-editor-back", `إجابة ${i}`);
    await page.locator('button[data-action="fc-save-card"]').dispatchEvent("click");
    await page.waitForTimeout(600);
  }
  console.log("cards added, view =", await page.evaluate(() => document.querySelector("[data-fc-view]")?.getAttribute("data-fc-view")));
  // open decks view
  await page.locator('button[data-action="fc-open-decks"]').first().dispatchEvent("click");
  await page.waitForTimeout(500);
  console.log("after fc-open-decks, view =", await page.evaluate(() => document.querySelector("[data-fc-view]")?.getAttribute("data-fc-view")));
  // open browse for the deck
  await page.locator('.fc-deck-card button[data-action="fc-open-deck"]').first().dispatchEvent("click");
  await page.waitForTimeout(500);
  console.log("after open deck, view =", await page.evaluate(() => document.querySelector("[data-fc-view]")?.getAttribute("data-fc-view")));
  // home button
  await page.locator('button[data-action="fc-go-dashboard"]').first().dispatchEvent("click");
  await page.waitForTimeout(600);
  console.log("after fc-go-dashboard, view =", await page.evaluate(() => document.querySelector("[data-fc-view]")?.getAttribute("data-fc-view")));
  server.kill();
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
