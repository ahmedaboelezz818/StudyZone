const { chromium } = require("playwright");
async function safeClick(page, sel) {
  await page.locator(sel).first().dispatchEvent("click");
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const dismiss = async () => {
    const close = page.locator('#auth-modal [data-close-modal]').first();
    if (await close.isVisible().catch(() => false)) await close.click();
  };
  const swLogs = [];
  page.on("console", (m) => {
    const text = m.text();
    if (text.includes("[SW-debug]")) swLogs.push(text);
    else if (m.type() === "error" && !text.includes("ERR_INTERNET_DISCONNECTED")) consoleErrors.push(text);
  });
  const consoleErrors = [];
  // install SW online
  await page.goto("http://127.0.0.1:5500/", { waitUntil: "networkidle", timeout: 45000 });
  await dismiss();
  await page.reload({ waitUntil: "networkidle", timeout: 45000 });
  await dismiss();
  await page.waitForTimeout(1200);
  // go offline and reload
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
  await dismiss();
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => ({
    controller: Boolean(navigator.serviceWorker?.controller),
    contentLen: (document.getElementById("page-content")?.innerHTML || "").length,
    bodyBg: getComputedStyle(document.body).backgroundColor,
  }));
  console.log("state:", JSON.stringify(state));
  console.log("SW logs (" + swLogs.length + "):");
  swLogs.forEach(l => console.log("  " + l));
  console.log("console errors (" + consoleErrors.length + "):");
  consoleErrors.slice(0, 10).forEach(l => console.log("  " + l));
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
