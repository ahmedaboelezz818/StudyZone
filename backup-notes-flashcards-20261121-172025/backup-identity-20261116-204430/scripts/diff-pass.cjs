const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const src = process.argv[2];
const a = fs.readFileSync(src, "utf8");
const tmp = src + ".2";
fs.copyFileSync(src, tmp);
cp.execSync(`node ${path.resolve(__dirname, "fix-mojibake.cjs")} "${tmp}" --write`, { stdio: "inherit" });
const b = fs.readFileSync(tmp, "utf8");
const al = a.split(/\r?\n/);
const bl = b.split(/\r?\n/);
let n = 0;
for (let i = 0; i < Math.max(al.length, bl.length); i++) {
  if (al[i] !== bl[i]) {
    n += 1;
    if (n <= 40) {
      console.log(`\n--- line ${i + 1} ---`);
      console.log("A:", JSON.stringify((al[i] || "").slice(0, 180)));
      console.log("B:", JSON.stringify((bl[i] || "").slice(0, 180)));
    }
  }
}
console.log("\ntotal changed on 2nd pass:", n);
