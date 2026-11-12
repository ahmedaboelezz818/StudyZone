#!/usr/bin/env node
/**
 * Copies the static Study Zone web app into `www/` for Capacitor.
 * The repository root remains the canonical web project; nothing is moved.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");

const files = [
  "index.html",
  "app.js",
  "styles.css",
  "mobile.css",
  "themes.css",
  "ui-controls.css",
  "ui-controls.js",
<<<<<<< HEAD
  "premium.css",
  "premium-dashboard.css",
  "premium-pages.css",
  "premium-responsive.css",
=======
>>>>>>> f97e75219e4e1614f47cfda7a15deea4a3c08ecb
  "design-tokens.css",
  "themes-presets.css",
  "supabase-config.js",
  "locales.js",
  "offline-sync.js",
  "native-shell.js",
  "sync-ui.js",
  "service-worker.js",
  "manifest.json",
  "favicon.ico",
  "favicon.svg",
  "icon.svg",
  "apple-touch-icon.png",
];

<<<<<<< HEAD
const directories = ["icons", "vendor", "locales", "fonts", "assets"];
=======
const directories = ["icons", "vendor", "locales", "fonts"];
>>>>>>> f97e75219e4e1614f47cfda7a15deea4a3c08ecb

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const file of files) {
  const source = path.join(root, file);
  if (!fs.existsSync(source)) {
    console.warn(`[build-web] skip missing ${file}`);
    continue;
  }
  fs.copyFileSync(source, path.join(out, file));
}

for (const directory of directories) {
  const source = path.join(root, directory);
  if (!fs.existsSync(source)) continue;
  fs.cpSync(source, path.join(out, directory), { recursive: true });
}

console.log(`[build-web] Study Zone web assets copied to ${out}`);
