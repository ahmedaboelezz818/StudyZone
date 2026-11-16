const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

async function safeClick(page, sel) {
  await page.locator(sel).first().dispatchEvent("click");
}
(async () => {
  // Start a temporary server we own on port 5599, warm it, then kill it to simulate a real offline.
  const server = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, PORT: "5599" },
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 1500));

  const browser = await chromium.launch({ headless: true, executablePath: "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("pageerror:", e.message));
  const dismiss = async () => {
    const close = page.locator('#auth-modal [data-close-modal]').first();
    if (await close.isVisible().catch(() => false)) await close.click();
  };
  const check = async () => page.evaluate(() => ({
    contentLen: (document.getElementById("page-content")?.innerHTML || "").length,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    fcView: document.querySelector("[data-fc-view]")?.getAttribute("data-fc-view") || "none",
    flashcardsRendered: Boolean(document.querySelector(".fc-view")),
  }));

  await page.goto("http://127.0.0.1:5599/", { waitUntil: "networkidle", timeout: 45000 });
  await dismiss();
  // open flashcards + wait so its JS modules load and the SW caches them
  await safeClick(page, '.nav-link[data-page="flashcards"]');
  await page.waitForSelector('[data-fc-view]', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // warm reload so the SW takes control
  await page.reload({ waitUntil: "networkidle", timeout: 45000 });
  await dismiss();
  await safeClick(page, '.nav-link[data-page="flashcards"]');
  await page.waitForSelector('[data-fc-view]', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  console.log("online sanity:", JSON.stringify(await check()));

  // Now kill the server to simulate a real offline
  server.kill();
  await new Promise((r) => setTimeout(r, 500));

  await page.goto("http://127.0.0.1:5599/#flashcards", { waitUntil: "domcontentloaded", timeout: 30000 }).catch((e) => console.log("offline nav err", e.message));
  await dismiss();
  await page.waitForTimeout(2500);
  console.log("offline after server kill:", JSON.stringify(await check()));

  const sw = await page.evaluate(() => Boolean(navigator.serviceWorker?.controller));
  console.log("SW controller:", sw);
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
