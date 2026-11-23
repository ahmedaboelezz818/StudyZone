const fs = require("fs");
for (const file of [
  "android/app/src/main/res/values/strings.xml",
  "android/app/src/main/res/values-ar/strings.xml",
]) {
  const before = fs.readFileSync(file, "utf8");
  const after = before
    .replace(/<string name="app_name">[^<]*<\/string>/, '<string name="app_name">Second Brain</string>')
    .replace(/<string name="title_activity_main">[^<]*<\/string>/, '<string name="title_activity_main">Second Brain</string>')
    .replace(/Study Zone/g, "Second Brain");
  fs.writeFileSync(file, after, "utf8");
  console.log("updated", file);
}
