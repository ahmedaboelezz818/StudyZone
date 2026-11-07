#!/usr/bin/env node
/**
 * Minify JS and CSS assets for faster loading.
 * Reads source files from repo root and writes minified versions alongside.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function minifyJS(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .replace(/;\s+/g, ";")
    .replace(/{\s+/g, "{")
    .replace(/}\s+/g, "}")
    .replace(/\(\s+/g, "(")
    .replace(/\)\s+/g, ")")
    .replace(/,\s+/g, ",")
    .replace(/:\s+/g, ":")
    .replace(/=\s+/g, "=")
    .replace(/===\s+/g, "===")
    .replace(/!==\s+/g, "!==")
    .replace(/;\s*}/g, "}")
    .trim();
}

function minifyCSS(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/;\s*/g, ";")
    .replace(/{\s*/g, "{")
    .replace(/}\s*/g, "}")
    .replace(/:\s*/g, ":")
    .replace(/,\s*/g, ",")
    .trim();
}

const files = {
  "app.js": { fn: minifyJS, out: "app.min.js" },
  "supabase.js": { fn: minifyJS, out: "supabase.min.js" },
  "styles.css": { fn: minifyCSS, out: "styles.min.css" },
  "locales.js": { fn: minifyJS, out: "locales.min.js" },
};

for (const [file, cfg] of Object.entries(files)) {
  const src = path.join(root, file);
  if (!fs.existsSync(src)) continue;
  const code = fs.readFileSync(src, "utf8");
  const min = cfg.fn(code);
  const out = path.join(root, cfg.out);
  fs.writeFileSync(out, min, "utf8");
  const saved = ((code.length - min.length) / code.length * 100).toFixed(1);
  console.log(`[minify] ${file}: ${code.length} -> ${min.length} (-${saved}%)`);
}

console.log("[minify] Done.");
