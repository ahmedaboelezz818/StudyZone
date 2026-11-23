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
  await page.goto("http://127.0.0.1:5500/", { waitUntil: "networkidle", timeout: 45000 });
  await dismiss();
  await page.waitForTimeout(1500);
  const swState = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    return { controller: Boolean(navigator.serviceWorker?.controller), scope: reg?.scope || null, active: Boolean(reg?.active), installing: Boolean(reg?.installing), waiting: Boolean(reg?.waiting) };
  });
  console.log("SW state after online visit:", JSON.stringify(swState));
  const cacheNames = await page.evaluate(() => caches.keys());
  console.log("caches:", JSON.stringify(cacheNames));

  await context.setOffline(true);
  // don't reload yet — probe SW cache while offline
  const probe = await page.evaluate(async () => {
    const out = {};
    try {
      const req = new Request("./app.js");
      const cache = await caches.open("studyzone-shell-v31");
      const res = await cache.match(req);
      out.appJsInCache = Boolean(res);
    } catch (e) { out.appJsInCache = "error:" + e.message; }
    try {
      const html = await fetch("./index.html", { cache: "no-store" });
      out.indexStatus = html.status;
    } catch (e) { out.indexStatus = "error:" + e.message; }
    try {
      const js = await fetch("./app.js", { cache: "no-store" });
      out.appJsStatus = js.status;
    } catch (e) { out.appJsStatus = "error:" + e.message; }
    return out;
  });
  console.log("offline probe:", JSON.stringify(probe, null, 2));

  // Now reload with SW controlling
  await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 }).catch((e) => console.log("reload err", e.message));
  await dismiss();
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => ({
    contentLen: (document.getElementById("page-content")?.innerHTML || "").length,
    swController: Boolean(navigator.serviceWorker?.controller),
    title: document.title,
  }));
  console.log("after offline reload:", JSON.stringify(after, null, 2));
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
