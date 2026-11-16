const fs = require("fs");
for (const f of ["index.html", "service-worker.js", "flashcards.js", "flashcards.css", "flashcards-db.js", "flashcards-sync.js", "app.js"]) {
  const b = fs.readFileSync(f);
  const s = b.toString("utf8");
  const bom = b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf;
  console.log(`${f}: BOM=${bom} size=${b.length}`);
}
const html = fs.readFileSync("index.html", "utf8");
for (const f of ["flashcards.css", "flashcards-core.js", "flashcards-db.js", "flashcards-sync.js", "flashcards.js"]) {
  const m = html.match(new RegExp(f.replace(".", "\\.") + "\\?v=\\d+"));
  console.log(f, "->", m && m[0]);
}
console.log("charset utf8:", /charset="UTF-8"/i.test(html));
console.log("title:", (html.match(/<title>[^<]*<\/title>/) || [""])[0]);
const sw = fs.readFileSync("service-worker.js", "utf8");
console.log("sw cache:", (sw.match(/studyzone-shell-v\d+/) || ["?"])[0]);
