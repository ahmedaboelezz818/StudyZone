const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
(async () => {
  const PORT = 5578;
  const BASE = `http://127.0.0.1:${PORT}/`;
  const server = spawn(process.execPath, ["server.js"], { cwd: path.resolve(__dirname, ".."), env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch({ headless: true, executablePath: "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
  const page = await context.newPage();
  page.on("console", (m) => console.log(`[console.${m.type()}]`, m.text()));
  page.on("pageerror", (e) => console.log("[pageerror]", e.message, e.stack));
  page.on("requestfailed", (r) => console.log("[requestfailed]", r.url()));

  const dismiss = page.locator('#auth-modal [data-close-modal]').first();
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".nav-link[data-page]", { timeout: 30000 });
  await page.waitForTimeout(2000);
  if (await dismiss.isVisible().catch(() => false)) await dismiss.dispatchEvent("click");

  await page.locator('.nav-link[data-page="flashcards"]').dispatchEvent("click");
  await page.waitForSelector('[data-fc-view="dashboard"]', { timeout: 15000 }).catch(() => console.log("NO DASHBOARD"));
  console.log("view now:", await page.evaluate(() => document.querySelector("[data-fc-view]")?.getAttribute("data-fc-view")));

  console.log("clicking fc-add-card…");
  await page.locator('.fc-hero-actions button[data-action="fc-add-card"]').first().dispatchEvent("click");
  await page.waitForTimeout(2500);
  const modal = await page.evaluate(() => ({
    modalCount: document.querySelectorAll(".fc-modal").length,
    anyModalVisible: Boolean([...document.querySelectorAll(".fc-modal")].some(m => getComputedStyle(m).visibility !== "hidden")),
    view: document.querySelector("[data-fc-view]")?.getAttribute("data-fc-view") || "none",
    bodyHasEditor: document.body.innerHTML.includes("fc-editor"),
  }));
  console.log("modal state:", JSON.stringify(modal, null, 2));
  await page.screenshot({ path: "screenshots/debug-addcard.png", fullPage: true });
  server.kill();
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
