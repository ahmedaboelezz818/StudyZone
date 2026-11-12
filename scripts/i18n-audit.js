#!/usr/bin/env node
/**
 * Localization audit.
 *
 * Verifies that every literal string passed through translateUiText() exists in
 * both generated locale files, and that ar/en expose the same key set. This is
 * intentionally dependency-free so it can run in CI without npm install.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const ar = JSON.parse(fs.readFileSync(path.join(root, "locales", "ar.json"), "utf8"));
const en = JSON.parse(fs.readFileSync(path.join(root, "locales", "en.json"), "utf8"));

const failures = [];
const literalPattern = /translateUiText\(\s*(["'])((?:\\.|(?!\1).)*)\1/g;
const used = new Set();
for (const match of app.matchAll(literalPattern)) {
  const value = match[2]
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\");
  used.add(value);
}

for (const key of used) {
  if (!(key in ar)) failures.push(`Missing Arabic translation: ${key}`);
  if (!(key in en)) failures.push(`Missing English translation: ${key}`);
}

const arKeys = Object.keys(ar);
const enKeys = Object.keys(en);
for (const key of arKeys) {
  if (!(key in en)) failures.push(`Key exists in ar.json but not en.json: ${key}`);
}
for (const key of enKeys) {
  if (!(key in ar)) failures.push(`Key exists in en.json but not ar.json: ${key}`);
}

if (failures.length) {
  console.error(`Localization audit failed (${failures.length}):`);
  for (const failure of failures.slice(0, 80)) console.error(` - ${failure}`);
  if (failures.length > 80) console.error(` - …and ${failures.length - 80} more`);
  process.exit(1);
}

console.log(
  `Localization audit passed: ${used.size} translated literals, ${arKeys.length} keys in both dictionaries.`,
);
