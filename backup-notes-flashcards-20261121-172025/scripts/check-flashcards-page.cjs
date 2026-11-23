// Boot the real app on #flashcards and confirm the decks dashboard renders
// without console errors after the page-clobber guard.
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
(async () => {
  const PORT = 5596;
  const server = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 1600));
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/#flashcards`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  const state = await page.evaluate(() => ({
    textHas: document.body.innerText.includes("Flashcards"),
    hasDecksView: Boolean(document.querySelector("[data-fc-view='dashboard'], [data-fc-view], .fc-view")),
    title: document.title,
  }));
  console.log("flashcards page state:", JSON.stringify(state));
  console.log("errors:", errors.length ? errors : "none");
  server.kill();
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
