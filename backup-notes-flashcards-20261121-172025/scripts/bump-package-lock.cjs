const fs = require("fs");
let t = fs.readFileSync("package-lock.json", "utf8");
t = t
  .split('"version": "2.0.5"').join('"version": "2.0.7"')
  .split('"version":"2.0.5"').join('"version":"2.0.7"')
  .split('"version": "2.0.6"').join('"version": "2.0.7"')
  .split('"version":"2.0.6"').join('"version":"2.0.7"');
fs.writeFileSync("package-lock.json", t, "utf8");
const head = fs.readFileSync("package-lock.json", "utf8").split(/\r?\n/).slice(0, 12).join("\n");
console.log(head);
