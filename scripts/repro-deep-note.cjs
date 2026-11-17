// Verify the sanitizeRichText recursion with deeply nested disallowed HTML.
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const PORT = 5592;
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
  const errors = [];
  page.on("pageerror", (err) => { errors.push(err.message); console.log("PAGEERROR:", err.message.slice(0, 300)); if (err.stack) console.log("STACK:", err.stack.slice(0, 4000)); });
  page.on("console", (msg) => { if (msg.type() === "error") { errors.push(msg.text()); } });

  // Seed a note with 4000 nested <marquee> tags (disallowed) around a span.
  const deepHtml = "<div>" + "<marquee>".repeat(4000) + "<span>deep</span>" + "</marquee>".repeat(4000) + "</div>";
  const note = {
    id: "note-deep-1",
    title: "Deep note",
    content: deepHtml,
    subject_id: "",
    subject: "Test",
    is_favorite: false,
    color: "",
    type: "text",
    attachments: [],
    description: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ownerId: null,
  };
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".nav-link[data-page]", { timeout: 30000 });
  await page.evaluate((seeded) => {
    localStorage.setItem("studyzone.notes.v1", JSON.stringify([seeded]));
  }, note);
  await page.reload({ waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForSelector(".nav-link[data-page]", { timeout: 30000 });
  // Open the notes page which renders note content through noteContentHtml.
  await page.locator('.nav-link[data-page="notes"]').first().dispatchEvent("click");
  await page.waitForTimeout(3000);
  const rendered = await page.evaluate(() => document.body.innerText.includes("Deep note"));
  console.log("seeded note visible in notes page:", rendered);
  const banner = await page.$("#startup-error-banner");
  console.log("banner text:", banner ? (await banner.innerText()).slice(0, 300) : "(none)");
  console.log("errors:", JSON.stringify(errors.slice(0, 5)));
  await browser.close();
  server.kill();
  process.exit(0);
})().catch((err) => { console.error("DEEP-REPRO FAILED:", err.message); process.exit(1); });
