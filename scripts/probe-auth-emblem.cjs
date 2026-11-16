const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
(async () => {
  const PORT = 5594;
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
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".brand-mark", { timeout: 30000 });
  await page.waitForTimeout(600);
  const probe = await page.evaluate(() => {
    const img = document.querySelector("#auth-modal .brand-mark");
    const cs = img ? getComputedStyle(img) : null;
    return {
      found: Boolean(img),
      className: img?.className,
      attrW: img?.getAttribute("width"),
      cssWidth: cs?.width,
      cssHeight: cs?.height,
      rect: img?.getBoundingClientRect().width,
      display: cs?.display,
      objectFit: cs?.objectFit,
      padding: cs?.padding,
    };
  });
  console.log("auth emblem probe:", JSON.stringify(probe, null, 2));
  server.kill();
  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
