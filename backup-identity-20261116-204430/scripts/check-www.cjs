const fs = require("fs");
const checks = [
  ["flashcards.js", (s) => s.includes("function peekMove")],
  ["flashcards.js", (s) => s.includes("fc-go-dashboard")],
  ["flashcards.js", (s) => s.includes("heroRightHtml()")],
  ["flashcards.js", (s) => s.includes("const flippedTiles = new Set()")],
  ["flashcards.css", (s) => s.includes(".fc-tile-inner")],
  ["flashcards.css", (s) => s.includes(".fc-peek-card")],
  ["service-worker.js", (s) => s.includes("studyzone-shell-v31")],
  ["index.html", (s) => s.includes("flashcards.js?v=2")],
];
for (const [f, test] of checks) {
  const r = test(fs.readFileSync("www/" + f, "utf8"));
  console.log(f.padEnd(20), r ? "OK" : "MISSING");
}
