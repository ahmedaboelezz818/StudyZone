const { chromium } = require("playwright");
async function safeClick(page, sel) {
  await page.locator(sel).first().dispatchEvent("click");
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5500/", { waitUntil: "domcontentloaded", timeout: 45000 });
  const out = await page.evaluate(async () => {
    const cache = await caches.open("probe-ignoresearch-test");
    await cache.put(new Request("http://127.0.0.1:5500/probe-file"), new Response("hello"));
    const tests = [];
    const test = async (label, p, opts) => {
      try {
        const r = await cache.match(p, opts);
        tests.push(`${label} -> ${r ? "HIT" : "miss"}`);
      } catch (e) {
        tests.push(`${label} -> ERROR: ${e.message}`);
      }
    };
    await test("exact string no opts", "http://127.0.0.1:5500/probe-file");
    await test("string with query no opts", "http://127.0.0.1:5500/probe-file?v=1");
    await test("string with query ignoreSearch", "http://127.0.0.1:5500/probe-file?v=1", { ignoreSearch: true });
    await test("relative string with query ignoreSearch", "./probe-file?v=1", { ignoreSearch: true });
    await test("request with query ignoreSearch", new Request("http://127.0.0.1:5500/probe-file?v=1"), { ignoreSearch: true });
    await test("ignoreVary only", "http://127.0.0.1:5500/probe-file?v=1", { ignoreVary: true });
    const keys = (await cache.keys()).map(k => k.url);
    return { tests, cacheKeys: keys };
  });
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  process.exit(0);
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
