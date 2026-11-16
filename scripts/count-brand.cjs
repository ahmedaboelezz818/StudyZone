const fs = require("fs");
for (const file of ["app.js", "locales/en.json", "locales/ar.json", "locales.js"]) {
  const text = fs.readFileSync(file, "utf8");
  const plain = (text.match(/Study Zone/g) || []).length;
  const dotted = (text.match(/STUDY ZONE/g) || []).length;
  const studyzone = (text.match(/studyzone/gi) || []).length;
  console.log(file, "| 'Study Zone':", plain, "| 'STUDY ZONE':", dotted, "| studyzone*:", studyzone);
}
