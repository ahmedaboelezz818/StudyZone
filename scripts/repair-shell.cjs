const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const BACKUP = path.join(ROOT, "backup-full-start-20261116-151752");

// 1) flashcards-db.js: strip BOM only (content is intact).
const dbPath = path.join(ROOT, "flashcards-db.js");
let db = fs.readFileSync(dbPath);
if (db[0] === 0xef && db[1] === 0xbb && db[2] === 0xbf) {
  fs.writeFileSync(dbPath, db.subarray(3));
  console.log("flashcards-db.js: BOM stripped");
} else console.log("flashcards-db.js: no BOM");

// 2) index.html: restore from backup, re-apply cache-bust query bump.
const html = fs.readFileSync(BACKUP + "/index.html", "utf8");
const htmlFixed = html
  .replace("flashcards.css?v=1", "flashcards.css?v=2")
  .replace("flashcards-core.js?v=1", "flashcards-core.js?v=2")
  .replace("flashcards-db.js?v=1", "flashcards-db.js?v=2")
  .replace("flashcards-sync.js?v=1", "flashcards-sync.js?v=2")
  .replace("flashcards.js?v=1", "flashcards.js?v=2");
fs.writeFileSync(path.join(ROOT, "index.html"), htmlFixed, "utf8");
console.log("index.html restored from backup; flashcards assets -> v=2");
console.log("title:", (htmlFixed.match(/<title>[^<]*<\/title>/) || ["?"])[0]);

// 3) service-worker.js: restore from backup, bump cache version.
const sw = fs.readFileSync(BACKUP + "/service-worker.js", "utf8");
const swFixed = sw.replace("studyzone-shell-v30", "studyzone-shell-v31");
fs.writeFileSync(path.join(ROOT, "service-worker.js"), swFixed, "utf8");
console.log("service-worker.js restored from backup; cache ->", (swFixed.match(/studyzone-shell-v\d+/) || ["?"])[0]);
