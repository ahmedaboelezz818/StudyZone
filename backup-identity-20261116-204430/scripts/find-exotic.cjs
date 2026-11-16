const fs = require("fs");
const file = process.argv[2] || "app.js";
const s = fs.readFileSync(file, "utf8");
const lines = s.split(/\r?\n/);
const exotic = /[\u0100-\u017F\u0180-\u024F\uFFFD\u00A0-\u00FF]/;
let count = 0;
const samples = [];
lines.forEach((line, i) => {
  if (exotic.test(line)) {
    count += 1;
    if (samples.length < 25) samples.push([i + 1, line]);
  }
});
console.log("lines with Latin-ext / replacement / latin1:", count);
for (const [n, line] of samples) {
  console.log(`\n=== line ${n} ===`);
  console.log("raw:", JSON.stringify(line.slice(0, 200)));
  console.log("cps:", [...line.slice(0, 80)].map((c) => c.codePointAt(0).toString(16)).join(" "));
}
