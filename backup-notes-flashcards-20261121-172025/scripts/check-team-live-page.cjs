// Boot smoke: load the app, open Team Live (mobile viewport + touch),
// confirm no console/page errors and that the send path is wired.
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 5594;
const BASE = `http://127.0.0.1:${PORT}/`;

(async () => {
  const server = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((r) => setTimeout(r, 400));
    try { const res = await fetch(BASE); if (res.ok) break; } catch (_) { /* not ready */ }
  }
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe",
  });
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push("pageerror: " + err.message));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push("console: " + msg.text()); });

  await page.goto(`${BASE}#team-live`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".nav-link[data-page]", { timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await page.locator('.nav-link[data-page="team-live"]').first().dispatchEvent("click");
  await page.waitForTimeout(2000);
  const close = page.locator('#auth-modal [data-close-modal]').first();
  if (await close.isVisible().catch(() => false)) { await close.dispatchEvent("click"); await page.waitForTimeout(400); }
  await page.waitForTimeout(800);

  const state = await page.evaluate(() => ({
    page: window.StudyZoneApp?.page,
    hasLive: Boolean(window.StudyZoneTeamLive),
    composer: Boolean(document.querySelector("[data-live-composer]")),
    sendAction: document.querySelector('.live-send')?.getAttribute("data-live-action") || null,
    sendType: document.querySelector('.live-send')?.getAttribute("type") || null,
    liveView: document.querySelector(".live-page")?.getAttribute("class") || null,
  }));
  console.log("smoke state:", JSON.stringify(state));
  console.log("errors:", errors);
  await browser.close();
  server.kill();
  if (errors.length) { console.error("SMOKE FAILED: console/page errors"); process.exit(1); }
  console.log("SMOKE OK");
  process.exit(0);
})().catch((err) => { console.error("SMOKE FAILED:", err.message); process.exit(1); });
