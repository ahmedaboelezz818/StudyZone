#!/usr/bin/env node
/*
 * Repair mojibake (wrong-decoding) in project text files.
 *
 * Two damage patterns exist in this repository:
 *  A) UTF-8 bytes decoded as Windows-1252, then stored as UTF-8 (1..n times).
 *     Inverse: encode string as Windows-1252 -> original UTF-8 bytes -> decode UTF-8.
 *  B) UTF-8 bytes decoded as IBM CP437 (DOS), then stored as UTF-8.
 *     Inverse: encode string as CP437 -> original UTF-8 bytes -> decode UTF-8.
 *
 * Safety rules:
 *  - Only strings whose characters are all representable in the source codepage
 *    are candidates. Valid Arabic/CJK/emoji are not, so they are never touched.
 *  - A candidate is accepted only if the inverse transform is valid UTF-8 and
 *    changes the text. Results are scored; the candidate with the most Arabic
 *    script characters wins, then the one with the fewest replacement chars.
 *  - Works per line, with a per-token fallback for mixed lines.
 *
 * Usage: node scripts/fix-mojibake.cjs <file...> [--write]
 */
const fs = require("fs");
const path = require("path");

// ---------------- Windows-1252 ----------------
const CP1252_HIGH = {
  0x80: "\u20AC", 0x81: "\u0081", 0x82: "\u201A", 0x83: "\u0192", 0x84: "\u201E",
  0x85: "\u2026", 0x86: "\u2020", 0x87: "\u2021", 0x88: "\u02C6", 0x89: "\u2030",
  0x8A: "\u0160", 0x8B: "\u2039", 0x8C: "\u0152", 0x8D: "\u008D", 0x8E: "\u017D",
  0x8F: "\u008F", 0x90: "\u0090", 0x91: "\u2018", 0x92: "\u2019", 0x93: "\u201C",
  0x94: "\u201D", 0x95: "\u2022", 0x96: "\u2013", 0x97: "\u2014", 0x98: "\u02DC",
  0x99: "\u2122", 0x9A: "\u0161", 0x9B: "\u203A", 0x9C: "\u0153", 0x9D: "\u009D",
  0x9E: "\u017E", 0x9F: "\u0178",
};
const CP1252_REV = {};
for (let b = 0; b < 0x100; b++) if (b < 0x80 || b >= 0xa0) CP1252_REV[String.fromCharCode(b)] = b;
Object.keys(CP1252_HIGH).forEach((b) => { CP1252_REV[CP1252_HIGH[b]] = Number(b); });
function encodeCp1252(str) {
  const out = [];
  for (const ch of str) { const c = CP1252_REV[ch]; if (c === undefined) return null; out.push(c); }
  return Buffer.from(out);
}

// ---------------- IBM CP437 ----------------
const CP437_HIGH = [
  "\u00C7","\u00FC","\u00E9","\u00E2","\u00E4","\u00E0","\u00E5","\u00E7",
  "\u00EA","\u00EB","\u00E8","\u00EF","\u00EE","\u00EC","\u00C4","\u00C5",
  "\u00C9","\u00E6","\u00C6","\u00F4","\u00F6","\u00F2","\u00FB","\u00F9",
  "\u00FF","\u00D6","\u00DC","\u00A2","\u00A3","\u00A5","\u20A7","\u0192",
  "\u00E1","\u00ED","\u00F3","\u00FA","\u00F1","\u00D1","\u00AA","\u00BA",
  "\u00BF","\u2310","\u00AC","\u00BD","\u00BC","\u00A1","\u00AB","\u00BB",
  "\u2591","\u2592","\u2593","\u2502","\u2524","\u2561","\u2562","\u2556",
  "\u2555","\u2563","\u2551","\u2557","\u255D","\u255C","\u255B","\u2510",
  "\u2514","\u2534","\u252C","\u251C","\u2500","\u253C","\u255E","\u255F","\u255A",
  "\u2554","\u2569","\u2566","\u2560","\u2550","\u256C","\u2567","\u2568",
  "\u2564","\u2565","\u2559","\u2558","\u2552","\u2553","\u256B","\u256A",
  "\u2518","\u250C","\u2588","\u2584","\u258C","\u2590","\u2580","\u03B1",
  "\u00DF","\u0393","\u03C0","\u03A3","\u03C3","\u00B5","\u03C4","\u03A6",
  "\u0398","\u03A9","\u03B4","\u221E","\u03C6","\u03B5","\u2229","\u2261",
  "\u00B1","\u2265","\u2264","\u2320","\u2321","\u00F7","\u2248","\u00B0",
  "\u00B7","\u221A","\u207F","\u00B2","\u25A0","\u00A0","\u00A0",
];
const CP437_REV = {};
for (let b = 0; b < 0x100; b++) {
  const ch = b < 0x80 ? String.fromCharCode(b) : CP437_HIGH[b - 0x80];
  if (CP437_REV[ch] === undefined) CP437_REV[ch] = b;
}
function encodeCp437(str) {
  const out = [];
  for (const ch of str) { const c = CP437_REV[ch]; if (c === undefined) return null; out.push(c); }
  return Buffer.from(out);
}

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const MOJIBAKE_HINT_RE = /[\u00C0-\u00FF\u0100-\u017F\u02C6-\u02DC\u2018-\u203A\u20AC\u2122\u2500-\u257F\u2591-\u25A0\u2310\u0391-\u03C9]/;

function decodeUtf8(buf) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
  catch { return null; }
}
function inverseWith(encoder, text) {
  const bytes = encoder(text);
  if (!bytes) return null;
  return decodeUtf8(bytes);
}
function score(text, round) {
  const arabic = (text.match(ARABIC_RE) || []).length;
  const repl = (text.match(/\uFFFD/g) || []).length;
  // Count how many characters still look like mojibake; fewer is better.
  const hints = (text.match(MOJIBAKE_HINT_RE) || []).length;
  return { arabic, repl, hints, value: arabic * 1000 - hints * 10 - repl * 50 + round };
}
function bestCandidate(text) {
  const candidates = [];
  const encoders = [["cp1252", encodeCp1252], ["cp437", encodeCp437]];
  for (const [name, encoder] of encoders) {
    let cur = text;
    for (let round = 1; round <= 5; round += 1) {
      const next = inverseWith(encoder, cur);
      if (next === null) break;
      if (next === cur) break;
      cur = next;
      candidates.push({ name, round, text: cur });
      // stop early if the result has no mojibake-looking characters left
      if (!MOJIBAKE_HINT_RE.test(cur)) break;
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => score(b.text, b.round).value - score(a.text, a.round).value);
  const best = candidates[0];
  if (best.text === text) return null;
  return best;
}
function recoverString(text) {
  if (!MOJIBAKE_HINT_RE.test(text)) return { text, how: "none" };
  const whole = bestCandidate(text);
  if (whole) return { text: whole.text, how: `${whole.name}x${whole.round}` };
  // token fallback (split on ASCII spaces, keep delimiters)
  const parts = text.split(/( )/);
  let changed = false;
  const out = parts.map((part) => {
    if (part === " " || !MOJIBAKE_HINT_RE.test(part)) return part;
    const c = bestCandidate(part);
    if (c) { changed = true; return c.text; }
    return part;
  });
  return { text: changed ? out.join("") : text, how: changed ? "token" : "failed" };
}
function processOnce(original) {
  const lines = original.split(/(\r?\n)/);
  let changedLines = 0;
  let failedLines = 0;
  const methods = {};
  const failures = [];
  const outParts = [];
  for (let i = 0; i < lines.length; i += 2) {
    const line = lines[i];
    const sep = lines[i + 1] || "";
    const r = recoverString(line);
    if (r.how === "failed") {
      failedLines += 1;
      if (failures.length < 30) failures.push({ line: i / 2 + 1, text: line.slice(0, 180) });
    } else if (r.how !== "none") {
      methods[r.how] = (methods[r.how] || 0) + 1;
    }
    if (r.text !== line) changedLines += 1;
    outParts.push(r.text, sep);
  }
  return { text: outParts.join(""), changedLines, failedLines, methods, failures, changed: outParts.join("") !== original };
}
function processFile(file, write) {
  const original = fs.readFileSync(file, "utf8");
  let text = original;
  let pass = 0;
  let last = null;
  const allMethods = {};
  let totalChanged = 0;
  for (; pass < 6; pass += 1) {
    last = processOnce(text);
    totalChanged += last.changedLines;
    Object.keys(last.methods).forEach((k) => { allMethods[k] = (allMethods[k] || 0) + last.methods[k]; });
    if (!last.changed) break;
    text = last.text;
  }
  if (write && text !== original) fs.writeFileSync(file, text, "utf8");
  return {
    file,
    changed: text !== original,
    passes: pass + 1,
    totalChangedLines: totalChanged,
    failedLines: last ? last.failedLines : 0,
    methods: allMethods,
    failures: last ? last.failures : [],
  };
}

const args = process.argv.slice(2);
const write = args.includes("--write");
const files = args.filter((a) => !a.startsWith("--"));
const reports = files.map((f) => processFile(path.resolve(f), write));
for (const r of reports) {
  console.log(`\n=== ${r.file} ===`);
  console.log(`changed: ${r.changed} | changedLines: ${r.changedLines} | failedLines: ${r.failedLines}`);
  console.log("methods:", JSON.stringify(r.methods));
  if (r.failures.length) {
    console.log("unrecovered samples:");
    r.failures.forEach((f) => console.log(`  line ${f.line}: ${JSON.stringify(f.text)}`));
  }
}
