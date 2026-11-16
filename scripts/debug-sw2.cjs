const { chromium } = require("playwright");
async function safeClick(page, sel) {
  await page.locator(sel).first().dispatchEvent("click");
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
  const page = await context.newPage();
  const failures = [];
  page.on("requestfailed", (req) => failures.push(`FAIL ${req.method()} ${req.url()} => ${req.failure()?.errorText}`));
  page.on("pageerror", (e) => failures.push(`PAGEERROR ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") failures.push(`CONSOLE ${m.text()}`); });

  const dismiss = async () => {
    const close = page.locator('#auth-modal [data-close-modal]').first();
    if (await close.isVisible().catch(() => false)) await close.click();
  };

  await page.goto("http://127.0.0.1:5500/", { waitUntil: "networkidle", timeout: 45000 });
  await dismiss();
  console.log("online, controller before reload:", await page.evaluate(() => Boolean(navigator.serviceWorker?.controller)));
  await page.reload({ waitUntil: "networkidle", timeout: 45000 });
  await dismiss();
  const state = await page.evaluate(() => ({
    controller: Boolean(navigator.serviceWorker?.controller),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    sheets: [...document.styleSheets].map(s => { try { return s.cssRules.length; } catch { return "err"; } }),
    pageContentLen: (document.getElementById("page-content")?.innerHTML || "").length,
    flashcardsGlobal: typeof window.StudyZoneFlashcards,
  }));
  console.log("after reload:", JSON.stringify(state, null, 2));
  const nav = await safeClick(page, '.nav-link[data-page="flashcards"]').then(() => "clicked").catch(e => "ERR " + e.message.split("\n")[0]);
  console.log("nav:", nav);
  await page.waitForTimeout(2500);
  const fc = await page.evaluate(() => ({
    view: document.querySelector("[data-fc-view]")?.getAttribute("data-fc-view") || "none",
    contentLen: (document.getElementById("page-content")?.innerHTML || "").length,
  }));
  console.log("flashcards view:", JSON.stringify(fc));

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
  await dismiss();
  await page.waitForTimeout(2500);
  const off = await page.evaluate(() => ({
    controller: Boolean(navigator.serviceWorker?.controller),
    contentLen: (document.getElementById("page-content")?.innerHTML || "").length,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    sheets: [...document.styleSheets].map(s => { try { return s.cssRules.length; } catch { return "err"; } }),
  }));
  console.log("offline reload:", JSON.stringify(off, null, 2));
  console.log("failures:", failures.length);
  failures.slice(0, 30).forEach(f => console.log(" -", f));
  await browser.close();
  process.exit(0);
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
