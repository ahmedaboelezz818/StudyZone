const fs = require("fs");
const s = fs.readFileSync("index.html", "utf8");
const i = s.indexOf('id="auth-modal"');
console.log(s.slice(Math.max(0, i - 100), i + 2600));
