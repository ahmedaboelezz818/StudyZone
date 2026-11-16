// Verifies the quick-capture floating button is gone (web + no console errors).
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
(async () => {
  const PORT = 5601;
  const BASE = `http://127.0.0.1:${PORT}/`;
  const server = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 1600));
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => ({
    fabHtml: document.querySelector(".quick-capture-fab") ? "PRESENT" : "REMOVED",
    fabText: (document.querySelectorAll(".quick-capture-fab") || []).length,
    fabInBody: document.body.innerHTML.includes("quick-capture-fab"),
    hasModal: Boolean(document.getElementById("quick-capture-modal")),
    dashboardNewTask: Boolean(document.querySelector('[data-action="new-task"]')),
  }));
  console.log("quick-capture state:", JSON.stringify(state, null, 2));
  console.log("errors:", errors.length ? errors : "none");
  server.kill();
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
