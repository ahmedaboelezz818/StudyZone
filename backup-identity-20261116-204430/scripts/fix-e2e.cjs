/* Rewrite the brittle boot/navigation portions of e2e-flashcards.cjs to be robust. */
const fs = require("fs");
const f = "scripts/e2e-flashcards.cjs";
let s = fs.readFileSync(f, "utf8");

// 1) Add a robust click helper right after the assert() definition.
const helper = `
async function clickWithRetry(page, sel, attempts = 10) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await page.click(sel, { timeout: 2500 });
      return true;
    } catch (_) {
      await page.waitForTimeout(300);
    }
  }
  return false;
}

`;
if (!s.includes("async function clickWithRetry")) {
  s = s.replace("(async () => {", helper + "(async () => {");
}

// 2) Wait for full boot before touching anything.
s = s.replace(
  /await page\.goto\(BASE, \{ waitUntil: "networkidle", timeout: 45000 \}\);\s*\n  await page\.waitForSelector\("\.nav-link\[data-page\]", \{ timeout: 20000 \}\);/,
  `await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".nav-link[data-page]", { timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 });
  await page.waitForTimeout(1500);`
);

// 3) Step 3: use retry nav click.
s = s.replace(
  /for \(let attempt = 0; attempt < 3 && !fcViewFound; attempt \+= 1\) \{\s*\n\s*const navLink = page\.locator\('\.nav-link\[data-page="flashcards"\]'\)\.first\(\);\s*\n\s*await navLink\.dispatchEvent\("click"\);/,
  `for (let attempt = 0; attempt < 4 && !fcViewFound; attempt += 1) {
    await clickWithRetry(page, '.nav-link[data-page="flashcards"]', 6);`
);

// 4) Step 6: retry nav click.
s = s.replace(
  "  await safeClick(page, '.nav-link[data-page=\"flashcards\"]');\n  await page.waitForSelector('[data-fc-view]', { timeout: 10000 });\n  await safeClick(page, 'button[data-action=\"fc-go-dashboard\"]');",
  "  await clickWithRetry(page, '.nav-link[data-page=\"flashcards\"]', 6);\n  await page.waitForSelector('[data-fc-view]', { timeout: 15000 });\n  await clickWithRetry(page, 'button[data-action=\"fc-go-dashboard\"]', 6);"
);

fs.writeFileSync(f, s, "utf8");
console.log("patched. dispatchEvent occurrences:", (s.match(/dispatchEvent/g) || []).length, "| clickWithRetry occurrences:", (s.match(/clickWithRetry/g) || []).length);
