#!/usr/bin/env node
/**
 * Downloads the Study Zone webfonts once so both the website and the
 * installed Android app render identically without a network connection.
 *
 * Run with: node scripts/fetch-fonts.js
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "fonts");
const cssPath = path.join(outDir, "fonts.css");
const families = [
  "Cairo:wght@400;500;600;700;800",
  "Inter:wght@400;500;600;700;800",
  "Tajawal:wght@400;500;600;700;800",
];
const cssUrl = `https://fonts.googleapis.com/css2?${families
  .map((family) => `family=${family}`)
  .join("&")}&display=swap`;

const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const response = await fetch(cssUrl, {
    headers: { "User-Agent": userAgent },
  });
  if (!response.ok) throw new Error(`Google Fonts CSS: ${response.status}`);
  let css = await response.text();
  const urls = [...css.matchAll(/url\((https:\/\/[^)]+)\)/g)].map(
    (match) => match[1],
  );
  const unique = [...new Set(urls)];
  const localNames = new Map();
  let index = 0;
  for (const url of unique) {
    const extension = /\.woff2(\?|$)/i.test(url) ? "woff2" : "woff";
    const name = `font-${String(++index).padStart(2, "0")}.${extension}`;
    const file = await fetch(url, { headers: { "User-Agent": userAgent } });
    if (!file.ok) throw new Error(`Font ${url}: ${file.status}`);
    fs.writeFileSync(
      path.join(outDir, name),
      Buffer.from(await file.arrayBuffer()),
    );
    localNames.set(url, `./${name}`);
  }
  for (const [url, local] of localNames) css = css.split(url).join(local);
  fs.writeFileSync(cssPath, css);
  console.log(
    `[fonts] ${unique.length} font files and fonts/fonts.css written`,
  );
}

main().catch((error) => {
  console.error("[fonts] failed:", error.message);
  process.exitCode = 1;
});
