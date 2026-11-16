// Read-only metadata probe against the live Supabase project (anon key).
// GET /rest/v1/ returns the OpenAPI document describing every exposed table
// and column. No data is read or written.
const URL = "https://lcysfoymnobmbxwwapll.supabase.co";
const KEY = "sb_publishable_FF4Minfpb74yW9BZEBVaVw_2Y8cMMza";

(async () => {
  const r = await fetch(URL + "/rest/v1/", {
    headers: { apikey: KEY, Authorization: "Bearer " + KEY },
  });
  console.log("status:", r.status);
  const text = await r.text();
  console.log("bytes:", text.length);
  let spec = null;
  try { spec = JSON.parse(text); } catch (e) {
    console.log("not JSON:", text.slice(0, 300));
    process.exit(1);
  }
  const defs = spec.definitions || {};
  const names = Object.keys(defs);
  console.log("tables exposed to anon role:", names.length);
  const wanted = ["team_call_participants", "team_calls", "flashcard_decks", "flashcard_review_logs", "flashcard_reviews"];
  for (const t of wanted) {
    const def = defs[t];
    if (!def) { console.log("\n== " + t + ": NOT EXPOSED to anon =="); continue; }
    console.log("\n== " + t + " ==");
    console.log(JSON.stringify(def.properties, null, 2));
  }
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
