/* Screenshot helper: seeds demo flashcards data and captures ar/en screenshots. */
const { chromium } = require("playwright");

async function safeClick(page, sel) {
  await page.locator(sel).first().dispatchEvent("click");
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("pageerror", (err) => console.log("pageerror:", err.message));
  await page.goto("http://127.0.0.1:5500/", { waitUntil: "networkidle", timeout: 45000 });
  const dismiss = async () => {
    const close = page.locator('#auth-modal [data-close-modal]').first();
    if (await close.isVisible().catch(() => false)) await close.dispatchEvent("click");
  };
  await dismiss();
  // Open flashcards first so the app creates the IndexedDB stores, then seed demo data.
  await safeClick(page, '.nav-link[data-page="flashcards"]');
  await page.waitForSelector('[data-fc-view="dashboard"], [data-fc-view="loading"]', { timeout: 15000 });
  await page.waitForTimeout(600);

  // Seed demo data directly in IndexedDB (the app creates the stores on mount).
  await page.evaluate(async () => {
    const uid = (p) => `${p}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    const deckId = "deck_demo_biology";
    const open = () => new Promise((resolve, reject) => {
      const req = indexedDB.open("studyzone_flashcards", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const db = await open();
    const tx = db.transaction(["decks", "cards"], "readwrite");
    const deckStore = tx.objectStore("decks");
    const cardStore = tx.objectStore("cards");
    deckStore.put({ id: deckId, name: "الأحياء — الخلية", description: "مراجعة سريعة لمفاهيم الخلية الحية", color: "#8b5cf6", icon: "🔬", parent_id: null, created_at: new Date(Date.now() - 86400000 * 20).toISOString(), updated_at: new Date().toISOString(), deleted_at: null });
    const samples = [
      { front: "ما هي وظيفة الميتوكندريا؟", back: "توليد الطاقة (ATP) عبر التنفس الخلوي", tags: ["biology", "cells"], difficulty: "easy" },
      { front: "عرّف الفجوة", back: "عضية خزن وتوازن مائي داخل الخلية", tags: ["biology"], difficulty: "medium" },
      { front: "ما الفرق بين الشبكة الإندوبلازمية الخشنة والناعمة؟", back: "الخشنة تحتوي ريبوسومات لصنع البروتين، والناعمة لصنع الدهون", tags: ["cells", "advanced"], difficulty: "hard" },
    ];
    samples.forEach((s, i) => {
      cardStore.put({
        id: `card_demo_${i}`,
        deck_id: deckId,
        front: s.front,
        back: s.back,
        tags: s.tags,
        difficulty: s.difficulty,
        state: i === 2 ? "learning" : "new",
        due_at: new Date().toISOString(),
        interval_days: i === 2 ? 1 : 0,
        ease: 2.5,
        reps: i === 2 ? 2 : 0,
        lapses: 0,
        learning_step: i === 2 ? 1 : 0,
        suspended: false,
        type: "basic",
        source: "manual",
        created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      });
    });
    return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(true); tx.onerror = () => reject(tx.error); });
  });

  // Reload so the app reads the seeded rows from IndexedDB.
  await page.reload({ waitUntil: "networkidle", timeout: 45000 });
  await dismiss();
  await safeClick(page, '.nav-link[data-page="flashcards"]');
  await page.waitForSelector('[data-fc-view="dashboard"]', { timeout: 15000 });
  await page.waitForTimeout(500);

  const shot = async (name) => {
    await page.screenshot({ path: `screenshots/${name}.png`, fullPage: false });
    console.log("saved", name);
  };

  require("fs").mkdirSync("screenshots", { recursive: true });

  await safeClick(page, '.nav-link[data-page="flashcards"]');
  await page.waitForSelector('[data-fc-view="dashboard"]', { timeout: 15000 });
  await page.waitForTimeout(600);
  await shot("01-dashboard-en");

  await safeClick(page, '.nav-link[data-page="settings"]');
  await page.waitForSelector('button[data-language="ar"]', { timeout: 12000 });
  await safeClick(page, 'button[data-language="ar"]');
  await page.waitForTimeout(900);
  await safeClick(page, '.nav-link[data-page="flashcards"]');
  await page.waitForSelector('[data-fc-view="dashboard"]', { timeout: 12000 });
  await page.waitForTimeout(600);
  await shot("02-dashboard-ar");

  await page.locator('button[data-action="fc-open-decks"]').first().dispatchEvent("click");
  await page.waitForSelector(".fc-deck-card", { timeout: 8000 });
  await page.waitForTimeout(400);
  await shot("03-decks-ar");

  await safeClick(page, '.fc-deck-card button[data-action="fc-open-deck"]');
  await page.waitForSelector('[data-fc-view="browse"]', { timeout: 8000 });
  await page.waitForTimeout(400);
  await shot("04-browse-ar");

  await safeClick(page, '.fc-hero-actions button[data-action="fc-start-deck"]');
  await page.waitForSelector(".fc-card-stage .fc-card", { timeout: 10000 });
  await page.waitForTimeout(500);
  await shot("05-review-ar");

  // Reveal + screenshot the revealed card
  await safeClick(page, 'button[data-action="fc-reveal"]');
  await page.waitForTimeout(600);
  await shot("06-review-revealed-ar");

  // English dashboard
  await safeClick(page, '.nav-link[data-page="settings"]');
  await page.waitForSelector('button[data-language="en"]', { timeout: 12000 });
  await safeClick(page, 'button[data-language="en"]');
  await page.waitForTimeout(800);
  await safeClick(page, '.nav-link[data-page="flashcards"]');
  await page.waitForSelector('[data-fc-view="dashboard"]', { timeout: 12000 });
  await page.waitForTimeout(600);
  await shot("07-dashboard-en-again");

  await browser.close();
  console.log("screenshots done");
})().catch((err) => { console.error(err); process.exit(1); });
