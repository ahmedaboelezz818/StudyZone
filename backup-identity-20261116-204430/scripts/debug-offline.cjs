const { chromium } = require("playwright");
async function safeClick(page, sel) {
  await page.locator(sel).first().dispatchEvent("click");
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") console.log("console.error:", m.text()); });
  page.on("pageerror", (e) => console.log("pageerror:", e.message));
  const dismiss = async () => {
    const close = page.locator('#auth-modal [data-close-modal]').first();
    if (await close.isVisible().catch(() => false)) await close.click();
  };

  // Phase 1: online — create data first
  await page.goto("http://127.0.0.1:5500/", { waitUntil: "networkidle", timeout: 45000 });
  await dismiss();
  await safeClick(page, '.nav-link[data-page="flashcards"]');
  await page.waitForSelector('[data-fc-view="dashboard"]', { timeout: 15000 }).catch(() => console.log("WARN: dashboard not shown (online phase)"));
  await safeClick(page, '.fc-hero-actions button[data-action="fc-new-deck"]');
  await page.waitForSelector(".fc-modal", { timeout: 8000 });
  await page.fill("#fc-deck-name", "مجموعة اختبار عدم الاتصال");
  await safeClick(page, 'button[data-action="fc-save-deck"]');
  await page.waitForTimeout(600);
  console.log("online deck created");

  // Phase 2: go offline, reload
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await dismiss();
  await page.screenshot({ path: "screenshots/debug-offline-1.png", fullPage: true });
  console.log("after reload, body text head:", (await page.evaluate(() => document.body.innerText)).slice(0, 300).replace(/\n/g, " | "));
  const navClick = await safeClick(page, '.nav-link[data-page="flashcards"]').then(() => "ok").catch((e) => "fail: " + e.message.split("\n")[0]);
  console.log("nav click:", navClick);
  await page.waitForTimeout(2500);
  const state = await page.evaluate(() => ({
    url: location.href,
    flashcardsView: document.querySelector("[data-fc-view]")?.getAttribute("data-fc-view") || "none",
    bodySample: document.body.innerText.slice(0, 400),
    hasFcContent: Boolean(document.getElementById("page-content")?.innerHTML.includes("fc-view")),
  }));
  console.log(JSON.stringify(state, null, 2));
  await page.screenshot({ path: "screenshots/debug-offline-2.png", fullPage: true });
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
