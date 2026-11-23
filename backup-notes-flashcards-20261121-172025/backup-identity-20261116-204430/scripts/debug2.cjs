const fs = require("fs");
const s = fs.readFileSync("app.js", "utf8");
const lines = s.split(/\r?\n/);
const nums = (process.argv[2] || "565,1789,1807,1822,1841,1891,1980,2171,2173,2324,1052,1128").split(",").map(Number);
for (const n of nums) {
  const line = lines[n - 1];
  console.log(`\n=== line ${n} ===`);
  console.log("raw:", JSON.stringify(line));
  console.log("cps:", [...line].map((c) => c.codePointAt(0).toString(16)).join(" "));
}
// test TextDecoder labels
for (const label of ["cp437", "437", "ibm437", "ibm866", "windows-1252", "iso-8859-1"]) {
  try { const d = new TextDecoder(label); console.log("label OK:", label); }
  catch (e) { console.log("label FAIL:", label, e.message); }
}
