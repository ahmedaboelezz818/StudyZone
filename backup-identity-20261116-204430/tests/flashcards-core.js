/*
 * Dependency-free flashcards core unit checks. Run with: node tests/flashcards-core.js
 */
const { readFileSync } = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const core = require(path.join(root, "flashcards-core.js"));
const assert = require("node:assert");

const now = new Date("2026-11-16T09:00:00");
const settings = core.DEFAULT_SETTINGS;

function at(minutesFromNow) {
  return new Date(now.getTime() + minutesFromNow * 60000);
}

function testLearning() {
  let card = core.newCard("Q?", "A?", { deck_id: "d1" });
  let result = core.schedule({ card, rating: "good", at: now, settings });
  assert.equal(result.card.state, "learning");
  assert.equal(result.card.learning_step, 1);
  result = core.schedule({ card: result.card, rating: "good", at: now, settings });
  assert.equal(result.card.state, "review");
  assert.equal(result.card.interval_days, 1);
}

function testEasy() {
  const card = core.newCard("Q?", "A?");
  const result = core.schedule({ card, rating: "easy", at: now, settings });
  assert.equal(result.card.state, "review");
  assert.ok(result.card.interval_days >= 4);
}

function testAgainEntersRelearning() {
  let card = core.newCard("Q?", "A?");
  let result = core.schedule({ card, rating: "good", at: now, settings });
  result = core.schedule({ card: result.card, rating: "good", at: now, settings });
  result = core.schedule({ card: result.card, rating: "again", at: now, settings });
  assert.equal(result.card.state, "relearning");
  assert.ok(result.card.lapses >= 1);
}

function testIntervalsDifferentiate() {
  const base = { state: "review", interval_days: 6, ease: 2.5 };
  const hard = core.schedule({ card: core.newCard("Q?", "A?", base), rating: "hard", at: now, settings });
  assert.ok(hard.card.interval_days > 6);
  const good = core.schedule({ card: core.newCard("Q?", "A?", base), rating: "good", at: now, settings });
  assert.ok(good.card.interval_days > 6);
  const easy = core.schedule({ card: core.newCard("Q?", "A?", base), rating: "easy", at: now, settings });
  assert.ok(easy.card.interval_days > good.card.interval_days);
}

function testEstimates() {
  const card = core.newCard("Q?", "A?");
  const estimates = ["again", "hard", "good", "easy"].map((rating) => core.estimateButtonIntervals(card, rating, now, settings));
  assert.ok(estimates.every((entry) => Number.isFinite(entry.dueAt)));
  assert.ok(new Set(estimates.map((entry) => entry.label)).size > 1);
}

function testDueAndQueues() {
  const decks = [
    { id: "a", deck_id: "d1", state: "new", due_at: new Date(now).toISOString() },
    { id: "b", deck_id: "d1", state: "new", due_at: new Date(now).toISOString() },
    { id: "c", deck_id: "d2", state: "review", due_at: new Date(now.getTime() - 60000).toISOString() },
  ];
  const due = core.dueCards(decks, now, { includeNew: true });
  assert.equal(due.length, 3);
  const excludedNew = core.dueCards(decks, now, { includeNew: false });
  assert.equal(excludedNew.length, 1);
  const byDeck = core.dueCards(decks, now, { includeNew: false, deckId: "d2" });
  assert.equal(byDeck.length, 1);
  const newQueue = core.buildQueue({ cards: decks, now, settings, mode: "new" });
  assert.ok(newQueue.length > 0);
  const custom = core.buildQueue({ cards: decks, now, settings, mode: "custom", deckId: "d2", limit: 50 });
  assert.equal(custom.length, 1);
}

function testStats() {
  const stats = core.buildStats({
    reviews: [{ card_id: "a", rating: "good", reviewed_at: new Date(now).toISOString(), deck_id: "d1", local_day: "2026-11-16" }],
    cards: [],
    now,
    settings,
  });
  assert.equal(stats.reviewsToday, 1);
  assert.ok(Number.isFinite(stats.retention));
  assert.ok(Array.isArray(stats.heatmap));
  assert.ok(Array.isArray(stats.forecast.buckets));
}

function testDelimited() {
  const parsed = core.parseDelimited("front,back\nHello,World", ",");
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].front, "Hello");
  const csv = core.toDelimited([{ front: "Hello", back: "World" }], ",");
  assert.ok(csv.includes("front,back"));
  assert.equal(core.toDelimited([{ front: "a,b", back: 'He said "hi"' }], ","), 'front,back\r\n"a,b","He said ""hi"""');
}

function testCloze() {
  const parts = core.tokenizeCloze("The capital of {{c1::Egypt::EG}} is Cairo");
  assert.equal(parts.length, 3);
  assert.equal(parts[1].type, "cloze");
  assert.equal(parts[1].value, "Egypt");
}

testLearning();
testEasy();
testAgainEntersRelearning();
testIntervalsDifferentiate();
testEstimates();
testDueAndQueues();
testStats();
testDelimited();
testCloze();
console.log("flashcards-core unit checks passed");
