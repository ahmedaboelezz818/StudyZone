// One-shot Second Brain rebrand replacement for text sources.
// Keeps technical identifiers: studyzone.*, studyflow.*, studyzone-shell-*,
// StudyZone* namespaces, window.studyZoneLocales, com.studyzone.app.
const fs = require("fs");
const files = [
  "app.js",
  "team-live.js",
  "native-shell.js",
  "flashcards-core.js",
  "flashcards-db.js",
  "flashcards-sync.js",
  "flashcards.js",
  "offline-sync.js",
  "sync-ui.js",
  "team-live-core.js",
  "ui-controls.js",
  "server.js",
  "locales/en.json",
  "locales/ar.json",
  "locales.js",
];
const titlePairs = [
  ['? "Study Zone — حياتك الدراسية، منظمة"', '? "Second Brain — عقلك. مُنظَّم."'],
  [': "Study Zone — Your Study Life, Organized"', ': "Second Brain — Your Mind. Organized."'],
  ['? "Study Zone — حياتك الدراسية، منظمة."', '? "Second Brain — عقلك. مُنظَّم."'],
  [': "Study Zone — Your Study Life, Organized."', ': "Second Brain — Your Mind. Organized."'],
];

for (const file of files) {
  let text = fs.readFileSync(file, "utf8");
  const before = text;
  for (const [from, to] of titlePairs) {
    if (text.includes(from)) text = text.split(from).join(to);
  }
  text = text.split("YOUR STUDY LIFE, ORGANIZED").join("YOUR MIND. ORGANIZED.");
  text = text.split("حياتك الدراسية، منظمة").join("عقلك. مُنظَّم.");
  text = text.split("STUDY ZONE").join("SECOND BRAIN");
  text = text.split("Study Zone").join("Second Brain");
  if (text !== before) {
    fs.writeFileSync(file, text, "utf8");
    console.log("updated", file);
  } else {
    console.log("unchanged", file);
  }
}
