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
  await page.goto("http://127.0.0.1:5500/", { waitUntil: "networkidle", timeout: 45000 });
  const dismiss = page.locator('#auth-modal [data-close-modal]').first();
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
  await safeClick(page, '.nav-link[data-page="flashcards"]');
  try {
    await page.waitForSelector('[data-fc-view="dashboard"]', { timeout: 8000 });
  } catch (err) {
    const html = await page.evaluate(() => document.getElementById("page-content") ? document.getElementById("page-content").innerHTML.slice(0, 600) : "NO page-content");
    console.log("page-content HTML:", html);
    await page.screenshot({ path: "screenshots/debug-timeout.png", fullPage: true });
    await browser.close();
    process.exit(1);
  }
  console.log("flashcards dashboard loaded");
  const newDeckButtons = await page.locator('button[data-action="fc-new-deck"]').count();
  console.log("fc-new-deck buttons:", newDeckButtons);
  await safeClick(page, '.fc-hero-actions button[data-action="fc-new-deck"]');
  await page.waitForTimeout(300);
  const modalVisible = await page.locator(".fc-modal").isVisible().catch(() => false);
  console.log("modal visible:", modalVisible);
  const name = page.locator("#fc-deck-name");
  const desc = page.locator("#fc-deck-desc");
  console.log("name count:", await name.count(), "desc count:", await desc.count());
  console.log("name visible:", await name.isVisible().catch(() => false), "desc visible:", await desc.isVisible().catch(() => false));
  await name.fill("مجموعة الأحياء");
  console.log("name filled:", await name.inputValue());
  console.log("desc visible after name fill:", await desc.isVisible().catch(() => false));
  console.log("desc enabled:", await desc.isEnabled().catch(() => false));
  await desc.fill("وصف تجريبي");
  console.log("desc filled:", await desc.inputValue());
  await page.screenshot({ path: "screenshots/debug-modal.png", fullPage: true });
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
