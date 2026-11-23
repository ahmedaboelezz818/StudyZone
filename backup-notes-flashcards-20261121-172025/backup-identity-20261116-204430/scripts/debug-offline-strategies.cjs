const { chromium } = require("playwright");
async function safeClick(page, sel) {
  await page.locator(sel).first().dispatchEvent("click");
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe" });
  const dismiss = async (page) => {
    const close = page.locator('#auth-modal [data-close-modal]').first();
    if (await close.isVisible().catch(() => false)) await close.click();
  };
  const check = async (page) => page.evaluate(() => ({
    contentLen: (document.getElementById("page-content")?.innerHTML || "").length,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    fcView: document.querySelector("[data-fc-view]")?.getAttribute("data-fc-view") || "none",
  }));
  const warm = async (page) => {
    await page.goto("http://127.0.0.1:5500/", { waitUntil: "networkidle", timeout: 45000 });
    await dismiss(page);
    await page.reload({ waitUntil: "networkidle", timeout: 45000 });
    await dismiss(page);
    await page.waitForTimeout(1000);
  };

  // Strategy A: context.setOffline(true)
  let context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let page = await context.newPage();
  await warm(page);
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
  await dismiss(page);
  await page.waitForTimeout(2500);
  console.log("A (setOffline):", JSON.stringify(await check(page)));
  await context.close();

  // Strategy B: page.route abort all requests
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  await warm(page);
  await page.route("**/*", (route) => route.abort());
  await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
  await dismiss(page);
  await page.waitForTimeout(2500);
  console.log("B (route abort all):", JSON.stringify(await check(page)));
  await context.close();

  // Strategy C: route abort only local origin
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  await warm(page);
  await page.route("http://127.0.0.1:5500/**", (route) => route.abort());
  await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
  await dismiss(page);
  await page.waitForTimeout(2500);
  console.log("C (route abort local):", JSON.stringify(await check(page)));
  await context.close();

  await browser.close();
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
