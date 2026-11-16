// Visual verification of the Second Brain rebrand.
// Spawns a temporary server (never port 5500 — that is the user's server),
// then screenshots the branded surfaces.
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

(async () => {
  const PORT = 5593;
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
  const context = await browser.newContext({
    viewport: { width: 1440, height: 920 },
    permissions: ["microphone", "camera"],
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

  // 1) Manifest parses and names the app correctly
  const manifest = await page.request.get(BASE + "manifest.json");
  console.log("manifest status:", manifest.status());
  const manifestJson = await manifest.json();
  console.log(
    "manifest:",
    JSON.stringify({
      name: manifestJson.name,
      short_name: manifestJson.short_name,
      description: manifestJson.description,
      theme_color: manifestJson.theme_color,
      background_color: manifestJson.background_color,
      id: manifestJson.id,
      icons: manifestJson.icons.map((i) => i.src + " (" + i.sizes + ", " + i.purpose + ")"),
    }),
  );

  // 2) Favicon / apple-touch icons return 200
  for (const icon of ["favicon.ico", "favicon.svg", "icon.svg", "apple-touch-icon.png", "icons/icon-32.png", "icons/icon-48.png", "icons/icon-96.png", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-192.png", "icons/maskable-512.png", "assets/images/second-brain-emblem.png"]) {
    const resp = await page.request.get(BASE + icon);
    console.log("icon", icon, resp.status());
  }

  // 3) Load the app and check the sidebar brand
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".brand", { timeout: 30000 });
  await page.waitForTimeout(1200);
  const brandState = await page.evaluate(() => ({
    title: document.title,
    themeColor: document.querySelector('meta[name="theme-color"]')?.content,
    appleTitle: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content,
    brandText: document.querySelector(".brand strong")?.textContent?.trim(),
    tagline: document.querySelector(".brand small")?.textContent?.trim(),
    emblemSrc: document.querySelector(".brand-mark")?.getAttribute("src"),
    emblemVisible: Boolean(document.querySelector(".brand-mark")?.getBoundingClientRect().width),
    oldBrandVisible: document.body.innerText.includes("Study Zone"),
    footerText: document.querySelector(".footer span")?.textContent?.trim(),
  }));
  console.log("brand state:", JSON.stringify(brandState, null, 2));
  await page.screenshot({ path: "screenshots/brand-sidebar.png", clip: { x: 0, y: 0, width: 280, height: 220 } });

  // 4) Auth modal with large emblem (login screen)
  const auth = await page.evaluate(() => {
    const close = document.querySelector("#auth-modal [data-close-modal]");
    return close ? true : false;
  });
  // open auth modal if possible
  const authBtn = page.locator('[data-navigate="auth"], #signin-button, button:has-text("Sign in")').first();
  if (await authBtn.count()) {
    try {
      await authBtn.click({ timeout: 3000 });
      await page.waitForTimeout(600);
    } catch { /* modal may already be open */ }
  }
  const authState = await page.evaluate(() => ({
    modalOpen: !document.getElementById("auth-modal")?.hidden,
    h2: document.getElementById("auth-title")?.textContent?.trim(),
    eyebrow: document.querySelector("#auth-modal .eyebrow")?.textContent?.trim(),
    img: document.querySelector("#auth-modal .brand-mark")?.getAttribute("src"),
    imgSize: document.querySelector("#auth-modal .brand-mark")?.getBoundingClientRect()?.width,
  }));
  console.log("auth state:", JSON.stringify(authState, null, 2));
  await page.screenshot({ path: "screenshots/brand-auth.png", fullPage: false });

  // 5) Settings page contains new brand text, no old brand
  await page.goto(BASE + "#settings", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  const settingsText = await page.evaluate(() => document.body.innerText);
  console.log("settings mentions Second Brain:", settingsText.includes("Second Brain"));
  console.log("settings mentions Study Zone:", settingsText.includes("Study Zone"));
  await page.screenshot({ path: "screenshots/brand-settings.png", fullPage: true });

  // 6) PWA install modal content (if present in DOM)
  const pwaModal = await page.evaluate(() => ({
    eyebrow: document.querySelector("#pwa-install-modal .eyebrow")?.textContent?.trim()
      || document.querySelector(".pwa-install-icon")?.parentElement?.querySelector(".eyebrow")?.textContent?.trim(),
    title: document.getElementById("pwa-install-title")?.textContent?.trim(),
  }));
  console.log("pwa install modal:", JSON.stringify(pwaModal));

  // 7) Global search placeholder/heading
  const gs = await page.evaluate(() => ({
    heading: document.getElementById("global-search-title")?.textContent?.trim(),
  }));
  console.log("global search:", JSON.stringify(gs));

  console.log("console errors:", errors.length ? errors : "none");
  server.kill();
  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
