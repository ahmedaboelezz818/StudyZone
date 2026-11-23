#!/usr/bin/env node
/* Read-only mojibake inspector for app.js */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const file = path.join(ROOT, process.argv[2] || "app.js");
const s = fs.readFileSync(file, "utf8");
const lines = s.split(/\r?\n/);

// cp1252 decode is built into Node via TextDecoder.
function cp1252Decode(buf) {
  return new TextDecoder("windows-1252").decode(buf);
}
// cp1252 encode: build reverse map for 0x80-0x9F, direct for the rest.
const CP1252_HIGH = {
  0x80: "\u20AC", 0x82: "\u201A", 0x83: "\u0192", 0x84: "\u201E",
  0x85: "\u2026", 0x86: "\u2020", 0x87: "\u2021", 0x88: "\u02C6",
  0x89: "\u2030", 0x8A: "\u0160", 0x8B: "\u2039", 0x8C: "\u0152",
  0x8E: "\u017D", 0x91: "\u2018", 0x92: "\u2019", 0x93: "\u201C",
  0x94: "\u201D", 0x95: "\u2022", 0x96: "\u2013", 0x97: "\u2014",
  0x98: "\u02DC", 0x99: "\u2122", 0x9A: "\u0161", 0x9B: "\u203A",
  0x9C: "\u0153", 0x9E: "\u017E", 0x9F: "\u0178",
};
const CP1252_REV = {};
for (let b = 0; b < 0x100; b++) {
  if (b < 0x80 || b >= 0xa0) CP1252_REV[String.fromCharCode(b)] = b;
}
Object.keys(CP1252_HIGH).forEach((b) => { CP1252_REV[CP1252_HIGH[b]] = Number(b); });
function cp1252Encode(str) {
  const out = [];
  for (const ch of str) {
    const code = CP1252_REV[ch];
    if (code === undefined) {
      // Not representable in cp1252: keep as literal UTF-8 bytes would be wrong;
      // use '?' fallback (should not happen for mojibake text).
      out.push(0x3f);
    } else out.push(code);
  }
  return Buffer.from(out);
}
function recoverOnce(text) {
  const bytes = Buffer.from(text, "utf8");
  const asCp = cp1252Decode(bytes);
  const back = cp1252Encode(asCp);
  return new TextDecoder("utf-8", { fatal: true }).decode(back);
}
function recover(text, maxRounds = 5) {
  let cur = text;
  let rounds = 0;
  while (rounds < maxRounds) {
    const next = recoverOnce(cur);
    if (next === cur) break;
    cur = next;
    rounds += 1;
  }
  return { text: cur, rounds };
}

const markerRe = /[\u00C3\u0098\u00C2\u00E2][\u0080-\u00BF\u0098-\u00BF]?/;
const hitLines = [];
lines.forEach((line, i) => {
  if (markerRe.test(line) && /[\u00C3\u00C2]/.test(line)) hitLines.push(i);
});
console.log("file:", path.basename(file), "lines:", lines.length, "hitLines:", hitLines.length);

// Show samples from different regions
const samples = [0, 1, 2, 5, 10, 20, 50, 100, 200, 400, 800, 1200];
for (const n of samples) {
  if (n >= hitLines.length) break;
  const idx = hitLines[n];
  const before = lines[idx];
  const after = recover(before).text;
  console.log(`\n--- hit#${n} line ${idx + 1} ---`);
  console.log("BEFORE:", JSON.stringify(before.slice(0, 220)));
  console.log("AFTER :", JSON.stringify(after.slice(0, 220)));
}

// Whole-file recovery stats
const whole = recover(s);
console.log("\nwhole-file rounds:", whole.rounds);
console.log("changed:", whole.text !== s);
console.log("after length:", whole.text.length, "before:", s.length);
console.log("sample after:", JSON.stringify(whole.text.split(/\r?\n/).find((l) => markerRe.test(l) && /[\u00C3\u00C2]/.test(l))?.slice(0, 200) || "(no mojibake lines left)"));
