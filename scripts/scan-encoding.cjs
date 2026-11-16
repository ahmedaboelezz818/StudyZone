#!/usr/bin/env node
/*
 * Encoding / mojibake auditor.
 *
 * Scans project text files for:
 *  - UTF-8 validity and BOM
 *  - classic Windows-1252 -> UTF-8 double-encoded Arabic (Ã˜... patterns)
 *  - replacement-char damage (literal ???? or U+FFFD)
 *  - lossless recovery candidate (round-trip decode) count
 *
 * Read-only. Never writes or modifies files.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".git", "android", "www", ".java17-build-backup-20261113"]);
const SKIP_PREFIX = "backup-";
const EXTS = new Set([".js", ".html", ".htm", ".css", ".json", ".md", ".ts", ".cjs", ".mjs", ".xml", ".svg", ".txt"]);

const MOJIBAKE_MARKERS = ["Ã˜", "Ã™", "Ã Â", "Ã§", "Ã°", "Ã˜Â", "Ã™Æ’", "â€", "Ã¯Â»Â¿", "Ã˜Â§", "Ã˜Â±", "Ã˜Â©"];

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    if (entry.name.startsWith(SKIP_PREFIX) || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && EXTS.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

function decodeStrict(buf) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch (e) {
    return null;
  }
}

// Try to recover double-encoded UTF-8: bytes -> latin1 string -> encode -> decode utf8
function recoverOnce(text) {
  const buf = Buffer.from(text, "latin1");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return null;
  }
}

function analyzeRecovery(text) {
  // Count how many times a round-trip latin1->utf8 succeeds while text still contains markers.
  let current = text;
  let rounds = 0;
  const MAX = 4;
  while (rounds < MAX) {
    const next = recoverOnce(current);
    if (next == null) break;
    // Only count if it actually changed something meaningful
    if (next === current) break;
    current = next;
    rounds += 1;
    // stop if markers gone
    if (!MOJIBAKE_MARKERS.some((m) => current.includes(m))) break;
  }
  return { rounds, text: current };
}

function main() {
  const files = walk(ROOT, []);
  const report = [];
  let totalBad = 0;
  let totalRecovered = 0;
  for (const file of files) {
    const buf = fs.readFileSync(file);
    const bom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    const strict = decodeStrict(buf);
    if (strict === null) {
      report.push({ file: rel, status: "INVALID_UTF8", size: buf.length });
      totalBad += 1;
      continue;
    }
    const text = bom ? strict.slice(1) : strict;
    const hits = {};
    for (const marker of MOJIBAKE_MARKERS) {
      let count = 0;
      let idx = 0;
      while ((idx = text.indexOf(marker, idx)) !== -1) { count += 1; idx += marker.length; }
      if (count) hits[marker] = count;
    }
    const ffod = (text.match(/\uFFFD/g) || []).length;
    const questionRuns = (text.match(/\?{3,}/g) || []).length;
    if (Object.keys(hits).length || ffod || questionRuns) {
      const rec = Object.keys(hits).length ? analyzeRecovery(text) : { rounds: 0, text };
      report.push({
        file: rel,
        status: "SUSPECT",
        bom,
        size: buf.length,
        hits,
        replacementChars: ffod,
        questionRuns,
        recoveryRounds: rec.rounds,
        sampleAfterRecovery: Object.keys(hits).length ? rec.text.slice(0, 200) : "",
      });
      totalBad += 1;
      totalRecovered += Object.keys(hits).length ? rec.rounds : 0;
    }
  }
  report.sort((a, b) => (b.hits ? Object.values(b.hits).reduce((x, y) => x + y, 0) : 0) - (a.hits ? Object.values(a.hits).reduce((x, y) => x + y, 0) : 0));
  console.log(JSON.stringify({ filesScanned: files.length, suspectFiles: totalBad, recoveryRounds: totalRecovered, report }, null, 2));
}

main();
