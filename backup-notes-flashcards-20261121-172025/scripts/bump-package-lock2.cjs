const fs = require("fs");
let t = fs.readFileSync("package-lock.json", "utf8");
t = t.split('"version": "2.0.0"').join('"version": "2.0.7"');
fs.writeFileSync("package-lock.json", t, "utf8");
console.log(fs.readFileSync("package-lock.json", "utf8").split(/\r?\n/).slice(0, 12).join("\n"));
