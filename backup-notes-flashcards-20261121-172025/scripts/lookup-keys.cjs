const fs = require("fs");
const ar = JSON.parse(fs.readFileSync("locales/ar.json", "utf8"));
const en = JSON.parse(fs.readFileSync("locales/en.json", "utf8"));
const locSrc = fs.readFileSync("locales.js", "utf8");
const keys = [
  "Front and back are required.",
  "Card saved",
  "Could not save card. Your input was kept.",
  "Please sign in to create a deck.",
  "Deck name",
  "Could not delete deck.",
  "Could not open Flashcards data. Please reload.",
];
for (const k of keys) {
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = locSrc.match(new RegExp(esc + '":"([^"]*)"'));
  console.log(JSON.stringify(k));
  console.log("  ar.json :", JSON.stringify(ar[k]));
  console.log("  en.json :", JSON.stringify(en[k]));
  console.log("  locales :", m ? JSON.stringify(m[1]) : "(none)");
}
