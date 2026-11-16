const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
async function safeClick(page, sel) {
  await page.locator(sel).first().dispatchEvent("click");
}
(async () => {
  const PORT = 5598;
  const BASE = `http://127.0.0.1:${PORT}/`;
  const server = spawn(process.execPath, ["server.js"], { cwd: path.resolve(__dirname, ".."), env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch({ headless: true, executablePath: "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
  const page = await context.newPage();
  page.on("console", (m) => console.log(`[console.${m.type()}]`, m.text()));
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  page.on("requestfailed", (req) => console.log("[requestfailed]", req.url(), req.failure()?.errorText));
  const dismiss = async () => {
    const close = page.locator('#auth-modal [data-close-modal]').first();
    if (await close.isVisible().catch(() => false)) await close.click();
  };

  console.log("goto 1");
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
  console.log("nav-link present:", await page.$('.nav-link[data-page]') !== null);
  await page.reload({ waitUntil: "networkidle", timeout: 45000 });
  const swCtl = await page.evaluate(() => Boolean(navigator.serviceWorker?.controller));
  console.log("SW controller after reload:", swCtl);
  await dismiss();
  console.log("clicking flashcards nav");
  await safeClick(page, '.nav-link[data-page="flashcards"]');
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => ({
    url: location.href,
    view: document.querySelector("[data-fc-view]")?.getAttribute("data-fc-view") || "none",
    pageContentLen: (document.getElementById("page-content")?.innerHTML || "").length,
    fcGlobal: typeof window.StudyZoneFlashcards,
    coreGlobal: typeof window.StudyZoneFlashcardsCore,
    loading: document.querySelector(".fc-loading") !== null,
    spinner: document.querySelector(".fc-spinner") !== null,
  }));
  console.log(JSON.stringify(state, null, 2));
  await page.screenshot({ path: "screenshots/debug-fresh-1.png", fullPage: true });
  server.kill();
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
