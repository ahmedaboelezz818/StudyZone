const fs = require("fs");

// Android app version bump for the Firebase startup-crash fix.
let gradle = fs.readFileSync("android/app/build.gradle", "utf8");
gradle = gradle.replace("versionCode 9", "versionCode 10");
gradle = gradle.replace('versionName "2.0.7"', 'versionName "2.0.8"');
fs.writeFileSync("android/app/build.gradle", gradle, "utf8");

for (const file of ["package.json", "package-lock.json"]) {
  let text = fs.readFileSync(file, "utf8");
  text = text.split('"version": "2.0.7"').join('"version": "2.0.8"');
  fs.writeFileSync(file, text, "utf8");
}

console.log(
  gradle.match(/versionCode \d+/)[0],
  gradle.match(/versionName "[\d.]+"/)[0],
);
console.log("package versions:", (fs.readFileSync("package.json", "utf8").match(/"version": "[\d.]+"/) || [])[0]);
console.log("lock versions:", (fs.readFileSync("package-lock.json", "utf8").match(/"version": "[\d.]+"/) || [])[0]);
