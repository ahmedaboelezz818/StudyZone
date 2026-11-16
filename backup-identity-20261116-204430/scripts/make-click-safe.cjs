const fs = require("fs");
for (const file of ["scripts/e2e-flashcards.cjs", "scripts/screenshots.cjs", "scripts/debug-offline.cjs", "scripts/debug-sw4.cjs", "scripts/debug-fresh.cjs", "scripts/debug-modal.cjs", "scripts/debug-ignoresearch.cjs", "scripts/debug-sw2.cjs", "scripts/debug-sw3.cjs", "scripts/debug-sw.cjs", "scripts/debug-offline-strategies.cjs", "scripts/debug-real-offline.cjs"]) {
  let s = fs.readFileSync(file, "utf8");
  // define helper once after imports
  if (!s.includes("async function safeClick") && s.includes("(async () => {")) {
    s = s.replace("(async () => {", `async function safeClick(page, sel) {
  await page.locator(sel).first().dispatchEvent("click");
}
(async () => {`);
  }
  s = s.split("await page.click(").join("await safeClick(page, ");
  s = s.split("await dismissAuth()").join("await dismissAuth()");
  fs.writeFileSync(file, s, "utf8");
  console.log(file, "patched", !s.includes("page.click("));
}
