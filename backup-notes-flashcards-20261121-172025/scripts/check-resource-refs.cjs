const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..", "android", "app", "src", "main", "res");

const fileType = (p) => path.basename(path.dirname(p)).split("-")[0];

const existing = new Set();
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    const type = fileType(p);
    const base = path.parse(e.name).name;
    if (type === "values") {
      const t = fs.readFileSync(p, "utf8");
      const re = /<(color|string|integer|bool|dimen|style|item|declare-styleable|array|string-array|integer-array)\s+name="([^"]+)"/g;
      for (const m of t.matchAll(re)) {
        // <item> entries are not standalone resources unless inside declare-styleable/values-array
        if (m[1] === "item") continue;
        // map element type to reference prefix
        const prefix = m[1] === "style" ? "style" : m[1];
        existing.add("@" + prefix + "/" + m[2]);
      }
    } else {
      existing.add("@" + type + "/" + base);
    }
  }
})(root);

const refs = [];
(function walk2(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk2(p); continue; }
    if (!/\.xml$/.test(e.name)) continue;
    const t = fs.readFileSync(p, "utf8");
    for (const m of t.matchAll(/@(color|drawable|mipmap|string|integer|xml|layout|style|menu|raw|font|dimen|bool)\/([A-Za-z0-9_.\-]+)/g)) {
      refs.push({ file: p.replace(root, "/").replace(/\\/g, "/"), full: m[0] });
    }
  }
})(root);

const missingSet = new Set(refs.filter(r => !existing.has(r.full)).map(r => r.full));
if (missingSet.size === 0) {
  console.log("NO missing resource references (checked", refs.length, "refs)");
} else {
  console.log("MISSING RESOURCES (", missingSet.size, "):");
  for (const r of [...missingSet].sort()) console.log("  " + r);
  console.log("\nFiles referencing them:");
  const seen = new Set();
  for (const full of [...missingSet].sort()) {
    console.log("  " + full + " referenced by:");
    for (const r of refs) if (r.full === full) console.log("    " + r.file);
  }
}
