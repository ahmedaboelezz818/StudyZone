// Debug: mobile team chat send button (temporary).
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 5595;
const BASE = `http://127.0.0.1:${PORT}/`;

(async () => {
  console.log("Starting temporary Second Brain server on : " + PORT + " …");
  const server = spawn(process.execPath, [path.resolve(__dirname, "..", "server.js")], {
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
    ...(require("playwright").devices && require("playwright").devices["Pixel 7"]) || { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile Safari/537.36" },
    viewport: { width: 412, height: 915 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push("pageerror: " + err.message));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push("console: " + msg.text()); });

  await page.goto(`${BASE}#team-live`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".nav-link[data-page]", { timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 });
  await page.waitForTimeout(1500);
  const close = page.locator('#auth-modal [data-close-modal]').first();
  if (await close.isVisible().catch(() => false)) { await close.dispatchEvent("click"); await page.waitForTimeout(400); }
  await page.waitForSelector('.nav-link[data-page="team-live"]', { timeout: 20000 });
  await page.locator('.nav-link[data-page="team-live"]').first().dispatchEvent("click");
  await page.waitForSelector('[data-live-composer]', { timeout: 30000 });
  await page.waitForTimeout(1500);

  // instrument events
  await page.evaluate(() => {
    window.__tcLog = [];
    document.addEventListener("submit", (e) => { window.__tcLog.push({ type: "submit", target: (e.target && e.target.className) || String(e.target), defaultPrevented: e.defaultPrevented }); }, true);
    document.addEventListener("click", (e) => { const t = e.target; if (t && (t.closest ? t.closest(".live-send") || t.closest("[data-live-form]") : false)) window.__tcLog.push({ type: "click", target: (t && (t.className || t.tagName)) || String(t), defaultPrevented: e.defaultPrevented }); }, true);
    document.addEventListener("keydown", (e) => { if (e.key === "Enter") window.__tcLog.push({ type: "keydown", target: (e.target && (e.target.tagName + "." + (e.target.className || ""))) || "none" }); }, true);
  });

  const sendBtn = page.locator('.live-send');
  console.log("send button count:", await sendBtn.count(), "visible:", await sendBtn.isVisible().catch(() => false), "enabled:", await sendBtn.isEnabled().catch(() => false));

  const draft = page.locator('[data-live-input="draft"]');
  await draft.fill("hello from mobile debug");
  await page.waitForTimeout(400);
  const stateBefore = await page.evaluate(() => { const S = window.StudyZoneTeamLive && window.StudyZoneTeamLive.__state; return { draft: S && S.draft, uploading: S && S.uploading, activeId: S && S.activeId, pending: S && S.pendingMessages ? S.pendingMessages.size : -1 }; });
  console.log("state before send:", JSON.stringify(stateBefore));

  await sendBtn.click();
  await page.waitForTimeout(2500);
  const stateAfter = await page.evaluate(() => { const S = window.StudyZoneTeamLive && window.StudyZoneTeamLive.__state; return { draft: S && S.draft, uploading: S && S.uploading, activeId: S && S.activeId, pending: S && S.pendingMessages ? S.pendingMessages.size : -1, failed: S && S.failedMessages ? S.failedMessages.size : -1, messages: (S && S.messages ? S.messages.length : -1) }; });
  const log = await page.evaluate(() => window.__tcLog);
  console.log("event log:", JSON.stringify(log));
  console.log("state after send:", JSON.stringify(stateAfter));
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 600));
  console.log("body text:", bodyText.replace(/\n+/g, " | "));

  console.log("errors:", errors);
  await browser.close();
  server.kill();
  process.exit(0);
})().catch((err) => { console.error("DEBUG FAILED:", err.message); process.exit(1); });
