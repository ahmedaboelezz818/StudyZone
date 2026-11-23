const fs = require("fs");
const path = require("path");
const root = process.cwd();

// Build an SVG favicon embedding a small PNG of the Second Brain emblem
// (external SVG <image> references are blocked for SVG-as-icon, so embed base64).
const emblem96 = fs.readFileSync(path.join(root, "icons", "icon-96.png")).toString("base64");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="72" fill="#0C4137"/>
  <image width="440" height="440" x="36" y="36" href="data:image/png;base64,${emblem96}"/>
</svg>
`;
fs.writeFileSync("favicon.svg", svg, "utf8");
fs.writeFileSync("icon.svg", svg, "utf8");
console.log("favicon.svg / icon.svg written", svg.length, "bytes");

// Build a multi-size ICO (16/32/48) embedding the PNG copies of the emblem.
// ICO layout: ICONDIR header + ICONDIRENTRY per image + PNG payloads.
const sources = [
  fs.readFileSync(path.join(root, "icons", "favicon-16.png")),
  fs.readFileSync(path.join(root, "icons", "favicon-32.png")),
  fs.readFileSync(path.join(root, "icons", "icon-48.png")),
];
const sizes = [16, 32, 48];
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);      // reserved
header.writeUInt16LE(1, 2);      // type = icon
header.writeUInt16LE(sources.length, 4);
let offset = 6 + 16 * sources.length;
const entries = [];
const payloads = [];
for (let i = 0; i < sources.length; i += 1) {
  const data = sources[i];
  const e = Buffer.alloc(16);
  e.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], 0);
  e.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], 1);
  e.writeUInt8(0, 2);            // palette
  e.writeUInt8(0, 3);            // reserved
  e.writeUInt16LE(1, 4);         // color planes
  e.writeUInt16LE(32, 6);        // bits per pixel
  e.writeUInt32LE(data.length, 8);
  e.writeUInt32LE(offset, 12);
  entries.push(e);
  payloads.push(data);
  offset += data.length;
}
fs.writeFileSync("favicon.ico", Buffer.concat([header, ...entries, ...payloads]));
console.log("favicon.ico written", fs.statSync("favicon.ico").size, "bytes (16/32/48px)");
