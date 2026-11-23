const fs = require("fs");
const s = fs.readFileSync("app.js", "utf8");
const lines = s.split(/\r?\n/);
const line = lines[2469];
console.log("line:", JSON.stringify(line));
const chars = [...line];
console.log("codepoints:", chars.map((c) => c.codePointAt(0).toString(16)).join(" "));
// isolate the arabic value
const m = line.match(/"([^"]*)"\s*,\s*$/);
const val = line.slice(line.indexOf('": "') + 4, -2);
console.log("value:", JSON.stringify(val));
console.log("value cps:", [...val].map((c) => c.codePointAt(0).toString(16) + ":" + c).join(" "));
