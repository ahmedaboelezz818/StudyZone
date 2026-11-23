const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
(async () => {
  const PORT = 5566;
  const BASE = `http://127.0.0.1:${PORT}/`;
  const server = spawn(process.execPath, ["server.js"], { cwd: path.resolve(__dirname, ".."), env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch({ headless: true, executablePath: "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") console.log(`[console.error]`, m.text()); });
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  const dismiss = page.locator('#auth-modal [data-close-modal]').first();
  if (await dismiss.isVisible().catch(() => false)) await dismiss.dispatchEvent("click");
  console.log("clicking flashcards nav");
  await page.locator('.nav-link[data-page="flashcards"]').dispatchEvent("click");
  for (let t = 0; t < 24; t += 1) {
    const s = await page.evaluate(() => ({
      hash: location.hash,
      view: document.querySelector("[data-fc-view]")?.getAttribute("data-fc-view") || "none",
      content: (document.getElementById("page-content")?.innerHTML || "").length,
    }));
    console.log(`t=${t * 500}ms hash=${s.hash} view=${s.view} len=${s.content}`);
    if (s.view !== "none") break;
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: "screenshots/debug-timeline.png", fullPage: true });
  server.kill();
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
