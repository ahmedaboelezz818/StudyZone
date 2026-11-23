const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
(async () => {
  const PORT = 5577;
  const BASE = `http://127.0.0.1:${PORT}/`;
  const server = spawn(process.execPath, ["server.js"], { cwd: path.resolve(__dirname, ".."), env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  try {
    for (let a = 0; a < 20; a++) {
      await new Promise(r => setTimeout(r, 250));
      try { const res = await fetch(BASE); if (res.ok) break; } catch (_) {}
    }
    console.log("server up");
    const browser = await chromium.launch({ headless: true, executablePath: "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe" });
    const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
    const page = await context.newPage();
    page.on("console", (m) => console.log(`[console.${m.type()}]`, m.text()));
    page.on("pageerror", (e) => console.log("[pageerror]", e.message));
    page.on("requestfailed", (r) => console.log("[requestfailed]", r.url()));

    console.log("goto (domcontentloaded)");
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 20000 });
    console.log("goto done");

    const dismiss = page.locator('#auth-modal [data-close-modal]').first();
    if (await dismiss.isVisible().catch(() => false)) await dismiss.dispatchEvent("click");
    console.log("auth dismissed");

    console.log("clicking flashcards");
    await page.locator('.nav-link[data-page="flashcards"]').dispatchEvent("click");
    console.log("clicked");

    const state = await page.evaluate(() => ({
      href: location.href,
      view: document.querySelector("[data-fc-view]")?.getAttribute("data-fc-view") || "none",
      html: (document.getElementById("page-content")?.innerHTML || "").slice(0, 300),
      fcGlobal: typeof window.StudyZoneFlashcards,
      coreGlobal: typeof window.StudyZoneFlashcardsCore,
      dbGlobal: typeof window.StudyZoneFlashcardsDb,
    }));
    console.log("state:", JSON.stringify(state, null, 2));
    await page.screenshot({ path: "screenshots/debug-diag.png", fullPage: true });
    await browser.close();
  } finally {
    try { server.kill(); } catch (_) {}
  }
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
