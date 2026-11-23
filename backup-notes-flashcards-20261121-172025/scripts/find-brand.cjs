const fs = require("fs");
const path = require("path");
const root = process.cwd();
const EXT = new Set([".html", ".js", ".css", ".json", ".md", ".xml", ".gradle", ".properties", ".svg", ".cjs", ".mjs", ".ts"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "android", "www", "screenshots"]);
const SKIP_PREFIX = "backup-";
const hits = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(SKIP_PREFIX) || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!EXT.has(path.extname(entry.name).toLowerCase())) continue;
    let text;
    try { text = fs.readFileSync(full, "utf8"); } catch { continue; }
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (/Study Zone|StudyZone|studyzone|study-zone|StudyFlow|studyflow/i.test(line)) {
        hits.push(`${path.relative(root, full).replace(/\\/g, "/")}:${i + 1}: ${line.trim().slice(0, 160)}`);
      }
    }
  }
}
walk(root);
console.log(hits.join("\n"));
console.log("\ntotal hits:", hits.length);
