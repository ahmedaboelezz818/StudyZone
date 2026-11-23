const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const apk = path.resolve("android/app/build/outputs/apk/debug/app-debug.apk");
const tmp = path.resolve("android/app/build/tmp-apk-verify");
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

// Extract only the files we need to inspect (no external unzip dependency).
const entries = execFileSync(
  "C:\\Users\\ahmea\\AppData\\Local\\Android\\Sdk\\build-tools\\36.0.0\\aapt.exe",
  ["list", apk],
  { encoding: "utf8" },
)
  .split(/\r?\n/)
  .filter(Boolean);

const wanted = [
  "assets/public/native-shell.js",
  "assets/public/service-worker.js",
  "assets/public/index.html",
  "classes.dex",
];
console.log("APK entries:", entries.length);
for (const w of wanted) console.log(`  contains ${w}:`, entries.includes(w));

// Use PowerShell Expand-Archive is slow; parse the zip with Node's zlib-free reader:
// Node has no zip API, so shell out to tar (bsdtar ships with Windows 10+).
for (const w of wanted) {
  try {
    execFileSync("tar", ["-xf", apk, "-C", tmp, w], { stdio: "pipe" });
  } catch (error) {
    console.error("extract failed:", w, String(error.message).slice(0, 200));
  }
}

const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
const apkNative = path.join(tmp, "assets/public/native-shell.js");
const wwwNative = path.resolve("www/native-shell.js");
const native = fs.readFileSync(apkNative, "utf8");
console.log("\n-- packaged native-shell.js --");
console.log("  www hash == apk hash:", sha(wwwNative) === sha(apkNative));
console.log("  has Firebase guard:", native.includes("pushGuard.register()"));
console.log("  has unguarded register:", /await\s+PushNotifications\.register\(\)/.test(native));
console.log("  has token timeout:", native.includes("token-timeout"));
console.log("  has missing-google-services handling:", native.includes("pushUnavailableLogged"));

const sw = fs.readFileSync(path.join(tmp, "assets/public/service-worker.js"), "utf8");
console.log("  service worker cache:", (sw.match(/studyzone-shell-v\d+/) || [])[0]);

const html = fs.readFileSync(path.join(tmp, "assets/public/index.html"), "utf8");
console.log("  index.html brand Second Brain:", (html.match(/Second Brain/g) || []).length);
console.log('  stale "Study Zone" occurrences:', (html.match(/Study Zone/g) || []).length);

const dex = fs.readFileSync(path.join(tmp, "classes.dex"));
console.log("\n-- dex --");
console.log("  StudyZonePushPlugin in classes.dex:", dex.includes(Buffer.from("StudyZonePushPlugin")));
console.log("  StudyZonePush reason string:", dex.includes(Buffer.from("missing-google-services")));

console.log("\nAPK bytes:", fs.statSync(apk).size, "mtime:", fs.statSync(apk).mtime.toISOString());
fs.rmSync(tmp, { recursive: true, force: true });
