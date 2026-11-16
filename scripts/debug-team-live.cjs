const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
(async () => {
  const PORT = 5579;
  const BASE = `http://127.0.0.1:${PORT}/`;
  const server = spawn(process.execPath, ["server.js"], { cwd: path.resolve(__dirname, ".."), env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe",
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--enable-features=WebRTC",
    ],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, permissions: ["microphone", "camera"] });
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") console.log(`[console.error]`, m.text()); });
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  page.on("requestfailed", (r) => console.log("[requestfailed]", r.url()));
  const dismiss = page.locator('#auth-modal [data-close-modal]').first();
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".nav-link[data-page]", { timeout: 30000 });
  await page.waitForTimeout(1500);
  if (await dismiss.isVisible().catch(() => false)) await dismiss.dispatchEvent("click");
  // Navigate to Team Live page
  await page.locator('.nav-link[data-page="team-live"]').dispatchEvent("click");
  await page.waitForTimeout(2500);
  const state = await page.evaluate(() => ({
    hash: location.hash,
    pageContentLen: (document.getElementById("page-content")?.innerHTML || "").length,
    hasTeamPanel: Boolean(document.querySelector("[data-live-container], .teams-shell, .teams-page, #team-live-modal")),
    bodyText: document.body.innerText.slice(0, 400),
  }));
  console.log("team-live state:", JSON.stringify(state, null, 2));
  // Try to trigger a call: find a start-call button in the team panel
  const startCall = await page.evaluate(() => {
    const btn = document.querySelector('[data-live-action="call-member"], [data-live-action="start-call"], [data-live-action="confirm-start-call"]');
    return btn ? btn.outerHTML.slice(0, 120) : null;
  });
  console.log("start-call button:", startCall);
  // Verify team_live_start_call RPC is present in the bundle
  const hasRpc = await page.evaluate(() => document.documentElement.innerHTML.includes("team_live_start_call"));
  console.log("bundle has team_live_start_call:", hasRpc);
  await page.screenshot({ path: "screenshots/team-live.png", fullPage: true });
  server.kill();
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
