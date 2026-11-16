const fs = require("fs");
const lines = fs.readFileSync("app.js", "utf8").split(/\r?\n/);
const internal = /localStorage|sessionStorage|storageKey|const \w*Key\s*=|studyflow\.|studyzone\.|studyzone-|sb-url|supabase/i;
const brand = /Study Zone|StudyZone|studyzone(?!\.)|STUDY ZONE/i;
for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  if (brand.test(line) && !internal.test(line)) {
    console.log(`${i + 1}: ${line.trim().slice(0, 200)}`);
  }
}
