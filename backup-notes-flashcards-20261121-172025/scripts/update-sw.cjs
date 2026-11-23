const fs = require("fs");
const file = "service-worker.js";
let c = fs.readFileSync(file, "utf8");

const replacements = [
  ["studyzone-shell-v31", "studyzone-shell-v32"],
  ['  "./icon.svg",\r\n', '  "./assets/images/second-brain-emblem.png",\r\n  "./icons/icon-32.png",\r\n  "./icons/icon-48.png",\r\n  "./icons/icon-96.png",\r\n  "./icon.svg",\r\n'],
  ['  "./icons/icon-192-maskable.png",\r\n', '  "./icons/maskable-192.png",\r\n'],
  ['  "./icons/icon-512-maskable.png",\r\n', '  "./icons/maskable-512.png",\r\n'],
];
for (const [from, to] of replacements) {
  const count = c.split(from).length - 1;
  console.log(`"${from.replace(/\n/g, "\\n")}" -> ${count} occurrence(s)`);
  c = c.split(from).join(to);
}
fs.writeFileSync(file, c, "utf8");
console.log("written", file);
