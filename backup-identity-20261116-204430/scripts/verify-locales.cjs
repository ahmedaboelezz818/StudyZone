const fs = require("fs");
const path = require("path");
const appPath = process.argv[2] || "app.js";
const s = fs.readFileSync(appPath, "utf8");
const start = s.indexOf("const interfaceText");
if (start < 0) throw new Error("interfaceText not found");
const eq = s.indexOf("=", start);
let i = eq + 1;
while (s[i] !== "{") i += 1;
let depth = 0, end = -1, inStr = null, esc = false;
for (; i < s.length; i += 1) {
  const ch = s[i];
  if (inStr) {
    if (esc) esc = false;
    else if (ch === "\\") esc = true;
    else if (ch === inStr) inStr = null;
    continue;
  }
  if (ch === '"' || ch === "'") { inStr = ch; continue; }
  if (ch === "{") depth += 1;
  else if (ch === "}") { depth -= 1; if (depth === 0) { end = i + 1; break; } }
}
const literal = s.slice(eq + 1, end);
const interfaceText = new Function(`return (${literal});`)();

// load locales.js
const locSrc = fs.readFileSync(path.join(__dirname, "..", "locales.js"), "utf8");
const fakeWindow = {};
new Function("window", locSrc)(fakeWindow);
const ar = fakeWindow.studyZoneLocales.ar || {};
const en = fakeWindow.studyZoneLocales.en || {};

const keys = Object.keys(interfaceText);
let match = 0, mismatch = 0, missing = 0;
const mismatches = [];
const missingKeys = [];
for (const k of keys) {
  const v = interfaceText[k];
  if (Object.prototype.hasOwnProperty.call(ar, k)) {
    if (ar[k] === v) match += 1;
    else { mismatch += 1; mismatches.push({ k, app: v, locale: ar[k] }); }
  } else { missing += 1; missingKeys.push(k); }
}
console.log("interfaceText keys:", keys.length);
console.log("locales.ar keys:", Object.keys(ar).length);
console.log("exact matches:", match, "| mismatches:", mismatch, "| not in locales.ar:", missing);
if (mismatches.length) {
  console.log("\nMISMATCHES (first 40):");
  mismatches.slice(0, 40).forEach((m) => console.log(`  ${JSON.stringify(m.k)}\n    app   : ${JSON.stringify(m.app)}\n    locale: ${JSON.stringify(m.locale)}`));
}
if (missingKeys.length) {
  console.log("\nKeys not in locales.ar (first 40):");
  missingKeys.slice(0, 40).forEach((k) => console.log(`  ${JSON.stringify(k)} -> ${JSON.stringify(interfaceText[k])}`));
}
// Check en dictionary sanity
const enKeys = Object.keys(en).length;
console.log("\nlocales.en keys:", enKeys);
