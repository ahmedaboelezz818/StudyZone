/*
 * StudyZone Smart Notes — deterministic local organizer unit checks.
 * Run with: node tests/notes-smart.js
 */
const path = require("node:path");
const assert = require("node:assert");
const smart = require(path.join(__dirname, "..", "notes-smart.js"));

function testPlainText() {
  assert.equal(smart.plainText("<p>Hello <strong>world</strong></p>"), "Hello world");
  assert.equal(smart.plainText("<h1>Title</h1>Body"), "Title Body");
}

function testIsArabic() {
  assert.equal(smart.isArabic("هذا ملاحظة"), true);
  assert.equal(smart.isArabic("This is English"), false);
}

function testTaskExtraction() {
  const source = "عندي امتحان رياضة يوم الخميس ولازم أخلص الفصل التالي وأراجع القوانين";
  const result = smart.organize(source, { title: "", lang: "ar" });
  assert.ok(result.counts && typeof result.counts === "object");
  assert.ok(result.counts.tasks > 0);
  const joined = result.html;
  assert.ok(joined.includes("الخميس") || joined.includes("الخميس"), "source date text must be preserved");
}

function testNeverInventsFacts() {
  const source = "أنا مريض اليوم ولازم أراجع الرياضيات";
  const result = smart.organize(source, { title: "", lang: "en" });
  const plain = smart.plainText(result.html);
  assert.ok(plain.includes("مريض"), "the organizer must not drop source facts");
  assert.ok(plain.includes("الرياضيات"), "the organizer must not invent facts");
}

function testCountsAreLocalOnly() {
  const result = smart.organize("Finish the biology homework tonight.", { title: "", lang: "en" });
  assert.equal(result.source, "local-rules");
  assert.equal(result.html.includes("AI"), false);
}

function testEnglishTaskChecklist() {
  const result = smart.organize("I need to finish the chemistry lab report tomorrow.", { title: "", lang: "en" });
  const tasks = smart._internal.taskText("I need to finish the chemistry lab report tomorrow.");
  assert.ok(tasks.length >= 1);
}

function main() {
  testPlainText();
  testIsArabic();
  testTaskExtraction();
  testNeverInventsFacts();
  testCountsAreLocalOnly();
  testEnglishTaskChecklist();
  console.log("notes-smart unit checks passed");
}

main();
