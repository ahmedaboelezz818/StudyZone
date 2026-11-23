// Reproduce the startup stack overflow and dump the FULL stack (temporary).
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 5593;
const BASE = `http://127.0.0.1:${PORT}/`;

(async () => {
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  page.on("console", async (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      const text = msg.text();
      if (/startup|call stack|overflow/i.test(text)) {
        console.log("CONSOLE", msg.type().toUpperCase() + ":", text.slice(0, 2000));
        try {
          const args = msg.args();
          for (const arg of args.slice(0, 5)) {
            try { console.log("  arg:", JSON.stringify(await arg.jsonValue())?.slice(0, 5000)); } catch (_) { /* ignore */ }
          }
        } catch (_) { /* ignore */ }
      }
    }
  });
  page.on("pageerror", (err) => {
    console.log("PAGEERROR:", err.message.slice(0, 2000));
    if (err.stack) console.log("STACK:", err.stack.slice(0, 8000));
  });
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6000);
  console.log("body innerText start:", (await page.evaluate(() => document.body.innerText)).slice(0, 300));
  const banner = await page.$("#startup-error-banner");
  if (banner) console.log("BANNER TEXT:", (await banner.innerText()).slice(0, 500));
  await browser.close();
  server.kill();
  process.exit(0);
})().catch((err) => { console.error("REPRO FAILED:", err.message); process.exit(1); });
