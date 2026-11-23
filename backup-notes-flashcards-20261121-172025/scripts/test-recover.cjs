const fs = require("fs");
const CP1252_HIGH = {
  0x80: "\u20AC", 0x82: "\u201A", 0x83: "\u0192", 0x84: "\u201E",
  0x85: "\u2026", 0x86: "\u2020", 0x87: "\u2021", 0x88: "\u02C6",
  0x89: "\u2030", 0x8A: "\u0160", 0x8B: "\u2039", 0x8C: "\u0152",
  0x8E: "\u017D", 0x91: "\u2018", 0x92: "\u2019", 0x93: "\u201C",
  0x94: "\u201D", 0x95: "\u2022", 0x96: "\u2013", 0x97: "\u2014",
  0x98: "\u02DC", 0x99: "\u2122", 0x9A: "\u0161", 0x9B: "\u203A",
  0x9C: "\u0153", 0x9E: "\u017E", 0x9F: "\u0178",
};
const REV = {};
for (let b = 0; b < 0x100; b++) if (b < 0x80 || b >= 0xa0) REV[String.fromCharCode(b)] = b;
Object.keys(CP1252_HIGH).forEach((b) => { REV[CP1252_HIGH[b]] = Number(b); });
function enc(str) {
  const out = [];
  for (const ch of str) { const c = REV[ch]; if (c === undefined) return null; out.push(c); }
  return Buffer.from(out);
}
function tryRecover(text) {
  const bytes = enc(text);
  if (!bytes) return null;
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return null; }
}
function recoverRuns(text, maxPasses = 6) {
  let cur = text;
  let passes = 0;
  const stats = { changedRuns: 0, passes: 0 };
  while (passes < maxPasses) {
    passes += 1;
    let changed = 0;
    let out = "";
    let i = 0;
    const n = cur.length;
    while (i < n) {
      // find maximal run of cp1252-encodable chars
      let j = i;
      while (j < n && REV[cur[j]] !== undefined) j += 1;
      const run = cur.slice(i, j);
      let replaced = run;
      if (run && /[\u00C3\u00C2\u00E2\u00D8\u00D9]/.test(run)) {
        const r = tryRecover(run);
        if (r !== null && r !== run) { replaced = r; changed += 1; }
      }
      out += replaced;
      if (j === i) { out += cur[i]; i += 1; }
      else i = j;
    }
    cur = out;
    stats.changedRuns += changed;
    stats.passes = passes;
    if (!changed) break;
  }
  return { text: cur, ...stats };
}

const s = fs.readFileSync(process.argv[2] || "app.js", "utf8");
const lines = s.split(/\r?\n/);
const nums = (process.argv[3] || "2470,2471,2472,2474,2536,2546,160,153,146").split(",").map(Number);
for (const n of nums) {
  const before = lines[n - 1];
  const r = recoverRuns(before);
  console.log(`\n=== line ${n} changed=${r.changedRuns} ===`);
  console.log("BEFORE:", JSON.stringify(before));
  console.log("AFTER :", JSON.stringify(r.text));
}
const whole = recoverRuns(s);
console.log("\nwhole changed:", whole.text !== s, "passes:", whole.passes, "changedRuns:", whole.changedRuns);
const afterLines = whole.text.split(/\r?\n/);
console.log("line 2470 after:", JSON.stringify(afterLines[2469]));
console.log("line 2536 after:", JSON.stringify(afterLines[2535]));
