const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const SKIP = new Set(["node_modules", ".git", "android", "www", ".java17-build-backup-20261113", "backup-full-start-20261116-151752"]);
function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith("backup-") || SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const files = walk(ROOT, []);
let reported = 0;
for (const f of files) {
  const ext = path.extname(f).toLowerCase();
  if (![".js", ".html", ".css", ".json", ".md", ".ts", ".cjs", ".mjs", ".java", ".gradle", ".xml"].includes(ext)) continue;
  let buf;
  try { buf = fs.readFileSync(f); } catch { continue; }
  // skip UTF-16 files
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) { console.log("UTF16LE:", path.relative(ROOT, f)); continue; }
  const s = buf.toString("utf8");
  const q = (s.match(/\?{3,}/g) || []).length;
  const cp = (s.match(/[\u00C3\u00C2][\u0080-\u00BF]/g) || []).length;
  const c437 = (s.match(/[\u2500-\u257F]{2,}/g) || []).length;
  const fffd = (s.match(/\uFFFD/g) || []).length;
  if (q || cp || c437 || fffd) {
    reported += 1;
    console.log(`${path.relative(ROOT, f)} | q=${q} cp1252=${cp} cp437=${c437} fffd=${fffd}`);
  }
}
console.log("files with lossy/mojibake markers:", reported);
// references to _head_team_live
const refs = [];
for (const f of files) {
  if (f.includes("backup-")) continue;
  let s;
  try { s = fs.readFileSync(f, "utf8"); } catch { continue; }
  if (s.includes("_head_team_live")) refs.push(path.relative(ROOT, f));
}
console.log("references to _head_team_live:", refs);
