#!/usr/bin/env node
/**
 * Generates `themes-presets.css` — complete, independent design tokens for
 * every preset listed in `THEME_PRESETS` inside app.js.
 *
 * Why this exists: the UI offers ~20 color presets but only a handful were
 * defined in CSS. Selecting an undefined preset left the previous palette in
 * place (or mixed the new accent with the old background), which looked like
 * "colors leaking between themes". This generator guarantees that every preset
 * fully defines every color token, so switching a preset can never inherit a
 * value from another one.
 *
 * Output is deterministic and dependency-free. Re-run after editing
 * THEME_PRESETS: `node scripts/generate-theme-presets.js`.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");

const start = appSource.indexOf("const THEME_PRESETS = [");
if (start === -1) throw new Error("THEME_PRESETS not found in app.js");
const end = appSource.indexOf("];", start);
const block = appSource.slice(start, end);

const entries = [...block.matchAll(
  /id:\s*"([^"]+)"[\s\S]*?colors:\s*\[\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\]/g,
)].map((match) => ({ id: match[1], surface: match[2], accent: match[3] }));

if (!entries.length) throw new Error("No theme presets parsed");

// ---- color helpers ---------------------------------------------------------
function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean.slice(0, 6);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}
function rgbToHex({ r, g, b }) {
  const part = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}
function mix(a, b, amount) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex({
    r: x.r + (y.r - x.r) * amount,
    g: x.g + (y.g - x.g) * amount,
    b: x.b + (y.b - x.b) * amount,
  });
}
function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function rgbTriplet(hex) {
  const { r, g, b } = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
}
const darken = (hex, amount) => mix(hex, "#000000", amount);
const lighten = (hex, amount) => mix(hex, "#ffffff", amount);

// Canonical original identity — restored exactly to the Brunswick Green /
// Emerald / Polar palette so the base theme is unambiguous.
const ORIGINAL_DARK = {
  surface: "#0C4137",
  accent: "#06D6A0",
  background: "#071C18",
  raised: "#10392F",
  soft: "#0A2B24",
  text: "#E6FBF6",
  onPrimary: "#05241D",
  muted: "#73968D",
  border: "#20594C",
  secondary: "#A5C9BF",
  warning: "#E6BA6C",
  danger: "#D1BC8D",
};
const ORIGINAL_LIGHT = {
  surface: "#FFFFFF",
  accent: "#06D6A0",
  background: "#E6FBF6",
  raised: "#FFFFFF",
  soft: "#F3FCF9",
  text: "#0C4137",
  onPrimary: "#FFFFFF",
  muted: "#64877D",
  border: "#C5E6DC",
  secondary: "#35685C",
  warning: "#B45309",
  danger: "#B91C1C",
};

function palette(entry, mode) {
  if (entry.id === "original") {
    return mode === "dark" ? ORIGINAL_DARK : ORIGINAL_LIGHT;
  }
  const surface = entry.surface;
  const accent = entry.accent;
  if (mode === "dark") {
    const background = darken(surface, 0.62);
    const text = mix(accent, "#ffffff", 0.86);
    return {
      surface,
      accent,
      background,
      raised: lighten(surface, 0.1),
      soft: darken(surface, 0.3),
      text,
      onPrimary: darken(accent, 0.8),
      muted: mix(text, background, 0.48),
      border: mix(surface, accent, 0.3),
      secondary: mix(text, surface, 0.4),
      warning: "#fbbf24",
      danger: "#f87171",
    };
  }
  const background = mix(accent, "#ffffff", 0.93);
  const text = darken(accent, 0.78);
  return {
    surface: "#FFFFFF",
    accent: darken(accent, 0.12),
    background,
    raised: "#FFFFFF",
    soft: mix(accent, "#ffffff", 0.96),
    text,
    onPrimary: "#FFFFFF",
    muted: mix(text, "#ffffff", 0.5),
    border: mix(accent, "#ffffff", 0.72),
    secondary: mix(text, "#ffffff", 0.3),
    warning: "#B45309",
    danger: "#B91C1C",
  };
}

function tokens(entry, mode) {
  const p = palette(entry, mode);
  const hover = darken(p.accent, 0.12);
  const previewB = mode === "dark" ? entry.accent : p.accent;
  const chart2 = mode === "dark" ? lighten(p.accent, 0.15) : lighten(p.accent, 0.12);
  const chart3 = mode === "dark" ? lighten(p.accent, 0.32) : lighten(p.accent, 0.28);
  const chart4 = mode === "dark" ? lighten(p.accent, 0.52) : lighten(p.accent, 0.45);
  const previewA = mode === "dark" ? entry.surface : p.background;
  return [
    `  --color-primary: ${p.accent};`,
    `  --color-primary-hover: ${hover};`,
    `  --color-primary-rgb: ${rgbTriplet(p.accent)};`,
    `  --color-secondary: ${p.secondary};`,
    `  --color-secondary-rgb: ${rgbTriplet(p.secondary)};`,
    `  --color-background: ${p.background};`,
    `  --color-background-rgb: ${rgbTriplet(p.background)};`,
    `  --color-surface: ${p.surface};`,
    `  --color-surface-rgb: ${rgbTriplet(p.surface)};`,
    `  --color-surface-raised: ${p.raised};`,
    `  --color-surface-soft: ${p.soft};`,
    `  --color-card: ${mode === "dark" ? rgba(p.surface, 0.28) : "#FFFFFF"};`,
    `  --color-card-hover: ${mode === "dark" ? rgba(p.surface, 0.38) : rgba(p.accent, 0.06)};`,
    `  --color-text: ${p.text};`,
    `  --color-text-rgb: ${rgbTriplet(p.text)};`,
    `  --color-text-on-primary: ${p.onPrimary};`,
    `  --color-muted: ${p.muted};`,
    `  --color-muted-rgb: ${rgbTriplet(p.muted)};`,
    `  --color-border: ${p.border};`,
    `  --color-border-rgb: ${rgbTriplet(p.border)};`,
    `  --color-border-soft: ${rgba(p.border, 0.55)};`,
    `  --color-success: ${p.accent};`,
    `  --color-success-hover: ${hover};`,
    `  --color-warning: ${p.warning};`,
    `  --color-warning-rgb: ${rgbTriplet(p.warning)};`,
    `  --color-warning-hover: ${darken(p.warning, 0.15)};`,
    `  --color-danger: ${p.danger};`,
    `  --color-danger-rgb: ${rgbTriplet(p.danger)};`,
    `  --color-danger-hover: ${darken(p.danger, 0.15)};`,
    `  --color-info: ${mode === "dark" ? "#38bdf8" : "#0284c7"};`,
    `  --color-info-hover: ${mode === "dark" ? "#2ba4d6" : "#0369a1"};`,
    `  --color-progress: ${p.accent};`,
    `  --color-progress-track: ${rgba(p.text, 0.09)};`,
    `  --color-shadow: rgba(0, 0, 0, ${mode === "dark" ? "0.13" : "0.07"});`,
    `  --gradient-primary: linear-gradient(145deg, ${p.surface}, ${p.accent});`,
    `  --gradient-surface: linear-gradient(145deg, ${rgba(p.surface, 0.5)}, ${rgba(p.background, 0.77)});`,
    `  --gradient-card: linear-gradient(145deg, ${rgba(p.surface, 0.7)}, ${rgba(p.background, 0.82)});`,
    `  --color-icon: ${p.accent};`,
    `  --color-icon-muted: ${mode === "dark" ? lighten(p.accent, 0.35) : darken(p.accent, 0.1)};`,
    `  --color-chart-1: ${p.accent};`,
    `  --color-chart-2: ${chart2};`,
    `  --color-chart-3: ${chart3};`,
    `  --color-chart-4: ${chart4};`,
    `  --theme-preview-a: ${previewA};`,
    `  --theme-preview-b: ${previewB};`,
    `  --warning: ${p.warning};`,
    `  --danger: ${p.danger};`,
  ].join("\n");
}

const header = `/* Study Zone — generated theme presets.
 * DO NOT EDIT BY HAND. Regenerate with:
 *   node scripts/generate-theme-presets.js
 *
 * Every preset fully resets every color token so selecting one theme can
 * never inherit a color from another. Loaded after design-tokens.css and
 * before styles.css; styles.css only applies light-mode component tweaks
 * using these tokens (no palette values of its own).
 */
`;

const chunks = [header];
for (const entry of entries) {
  chunks.push(
    `\n/* ===== ${entry.id} (dark) ===== */\n:root:not([data-theme="light"])[data-theme-preset="${entry.id}"] {\n${tokens(entry, "dark")}\n}`,
  );
  chunks.push(
    `\n/* ===== ${entry.id} (light) ===== */\n:root[data-theme="light"][data-theme-preset="${entry.id}"] {\n${tokens(entry, "light")}\n}`,
  );
}

const output = chunks.join("\n") + "\n";
fs.writeFileSync(path.join(root, "themes-presets.css"), output);
console.log(
  `[theme-presets] wrote ${entries.length} presets (${entries.map((e) => e.id).join(", ")})`,
);
