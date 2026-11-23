const { chromium } = require("playwright");
async function safeClick(page, sel) {
  await page.locator(sel).first().dispatchEvent("click");
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const dismiss = async () => {
    const close = page.locator('#auth-modal [data-close-modal]').first();
    if (await close.isVisible().catch(() => false)) await close.click();
  };
  await page.goto("http://127.0.0.1:5500/", { waitUntil: "networkidle", timeout: 45000 });
  await dismiss();
  await page.reload({ waitUntil: "networkidle", timeout: 45000 });
  await dismiss();
  await page.waitForTimeout(1000);

  const swInfo = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker?.getRegistration?.("/");
    return {
      scriptURL: reg?.active?.scriptURL ? reg.active.scriptURL : null,
      state: reg?.active?.state || null,
      controller: Boolean(navigator.serviceWorker?.controller),
    };
  });
  console.log("SW info:", JSON.stringify(swInfo));

  const cacheDump = await page.evaluate(async () => {
    const names = await caches.keys();
    const out = {};
    for (const name of names) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      out[name] = keys.map(r => r.url);
    }
    return out;
  });
  for (const [name, urls] of Object.entries(cacheDump)) {
    console.log(`CACHE ${name} (${urls.length} keys):`);
    urls.slice(0, 80).forEach(u => console.log("   ", u));
  }

  const probes = ["./styles.css", "./styles.css?v=team-system-1", "./fonts/fonts.css", "./vendor/supabase.js", "./app.js", "./app.js?v=1", "./locales.js", "./flashcards.css?v=2"];
  const probe = await page.evaluate(async (list) => {
    const results = {};
    for (const name of (await caches.keys())) {
      const cache = await caches.open(name);
      for (const p of list) {
        const r = await cache.match(p, { ignoreSearch: true });
        const r2 = await cache.match(p);
        results[`${name} :: ${p}`] = { ignoreSearch: Boolean(r), exact: Boolean(r2) };
      }
    }
    return results;
  }, probes);
  console.log("probe (cache-first hits):", JSON.stringify(probe, null, 2));
  await browser.close();
  process.exit(0);
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
