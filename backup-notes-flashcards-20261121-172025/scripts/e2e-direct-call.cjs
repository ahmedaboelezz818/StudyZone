// Verifies that a direct call started from a private conversation invites the
// peer — not the wrong member, and never with an undefined invitee.
// Uses a fully mocked Supabase client; no network calls are made.
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const TEAM = "33333333-3333-4333-8333-333333333333";
const CONV = "44444444-4444-4444-8444-444444444444";
const CALL = "55555555-5555-4555-8555-555555555555";

(async () => {
  const PORT = 5598;
  const BASE = `http://127.0.0.1:${PORT}/`;
  const server = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 1600));

  const browser = await chromium.launch({
    headless: true,
    executablePath:
      "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe",
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, permissions: ["microphone", "camera"] });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    const text = m.text();
    if (/session|restore|task|team|error|failed/i.test(text)) {
      console.log(`[${m.type()}]`, text.slice(0, 220));
    }
    if (m.type() === "error") errors.push("console: " + text);
  });

  await context.addInitScript(({ A, B, TEAM, CONV, CALL }) => {
    const now = new Date().toISOString();
    const teamMembers = [
      { team_id: TEAM, user_id: A, role: "owner", joined_at: now },
      { team_id: TEAM, user_id: B, role: "member", joined_at: now },
    ];
    const teams = [{ id: TEAM, name: "Biology team", owner_id: A, created_at: now }];
    const profiles = [
      { id: A, full_name: "Alex", avatar_color: null },
      { id: B, full_name: "Sara", avatar_color: null },
    ];
    const conversations = [{
      id: CONV, team_id: TEAM, kind: "direct", title: B, task_id: null,
      created_by: A, created_at: now, last_message_at: now, updated_at: now,
    }];
    const callRow = {
      id: CALL, team_id: TEAM, conversation_id: CONV, scope: "direct", call_type: "audio",
      status: "ended", title: null, created_by: A, created_at: now,
      started_at: null, connected_at: null, last_signal_at: now,
    };
    const rpcs = [];
    window.__rpcCalls = rpcs;
    const rpcImpl = (name, args) => {
      rpcs.push({ name, args });
      switch (name) {
        case "team_chat_conversations": return Promise.resolve({ data: conversations, error: null });
        case "team_live_open_direct": return Promise.resolve({ data: CONV, error: null });
        case "team_live_pending_invites": return Promise.resolve({ data: [], error: null });
        case "team_live_start_call": return Promise.resolve({ data: CALL, error: null });
        case "team_live_end_call": return Promise.resolve({ data: callRow, error: null });
        case "team_live_leave_call": return Promise.resolve({ data: callRow, error: null });
        case "team_live_open_group": return Promise.resolve({ data: CONV, error: null });
        case "team_live_prune_signals": return Promise.resolve({ data: null, error: null });
        case "team_live_join_call": return Promise.resolve({ data: callRow, error: null });
        case "team_live_respond_call": return Promise.resolve({ data: null, error: null });
        case "team_chat_messages": return Promise.resolve({ data: [], error: null });
        default: return Promise.resolve({ data: null, error: null });
      }
    };
    const chain = (table) => {
      const tableData = {
        team_members: teamMembers,
        teams,
        profiles,
        team_calls: [callRow],
        team_call_participants: [],
        team_messages: [],
        team_conversations: conversations,
      };
      const data = tableData[table] || [];
      let filterFn = null;
      // Universal chainable proxy (works for any query-builder method), but
      // `.in(...)` is honored so status filters behave like the real server.
      const handler = {
        get(target, prop) {
          if (prop === "in") {
            return (col, values) => {
              filterFn = (row) => Array.isArray(values) ? values.includes(row[col]) : true;
              return self;
            };
          }
          if (prop === "then") {
            return (res, rej) => Promise.resolve({ data: filterFn ? data.filter(filterFn) : data, error: null }).then(res, rej);
          }
          if (prop === "maybeSingle" || prop === "single") {
            return () => Promise.resolve({ data: (filterFn ? data.filter(filterFn) : data)[0] || null, error: null });
          }
          return () => self;
        },
      };
      const self = new Proxy(function () {}, handler);
      return self;
    };
    const channelStub = { on: () => channelStub, subscribe: () => channelStub, unsubscribe: () => {} };
    const fakeClient = {
      rpc: (name, args) => rpcImpl(name, args || {}),
      from: (table) => chain(table),
      channel: () => channelStub,
      removeChannel: () => Promise.resolve("ok"),
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
      auth: {
        getSession: () => Promise.resolve({
          data: { session: { user: { id: A, email: "alex@test.dev", user_metadata: { full_name: "Alex" } } } },
          error: null,
        }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut: () => Promise.resolve({ error: null }),
      },
      storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null, error: null }) }) },
      realtime: { setAuth: () => {} },
    };
    // The vendored UMD bundle overwrites window.supabase after us; pin a getter
    // so app.js builds the fake client instead of the real one.
    const stubbed = { createClient: () => fakeClient };
    Object.defineProperty(window, "supabase", {
      configurable: true,
      get: () => stubbed,
      set: () => {},
    });
    // Select the team so the team-live page has a context.
    try { window.localStorage.setItem("studyzone.selectedTeamId", TEAM); } catch {}
  }, ({ A, B, TEAM, CONV, CALL }));

  await page.goto(BASE + "#team-live", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  // Boot routing in the empty demo workspace is racy; navigate deterministically
  // through the app's own public navigate() API.
  await page.evaluate(() => { try { window.StudyZoneApp?.navigate?.("team-live"); } catch (e) { console.warn("navigate failed", e); } });
  await page.waitForTimeout(2500);
  const early = await page.evaluate(() => ({
    hash: location.hash,
    teamPanel: Boolean(document.querySelector("[data-live-container], [data-live-chat], .live-shell")),
    panelText: (document.querySelector("main")?.innerText || "").slice(0, 500),
    rpc: (window.__rpcCalls || []).map((r) => r.name),
  }));
  console.log("early state:", JSON.stringify(early, null, 2));

  // Open the direct conversation by clicking the conversation row.
  const directRow = page.locator('[data-live-action="open-conversation"]').first();
  if (await directRow.count()) {
    await directRow.click();
    await page.waitForTimeout(1500);
    const panelState = await page.evaluate(() => ({
      liveChatHost: Boolean(document.querySelector("[data-live-chat]")),
      chatHead: Boolean(document.querySelector(".live-chat-head")),
      chatHtml: (document.querySelector("[data-live-chat]")?.outerHTML || "").slice(0, 1200),
      actions: Array.from(document.querySelectorAll("[data-live-action]")).map((el) => el.getAttribute("data-live-action")),
    }));
    console.log("panel state:", JSON.stringify(panelState, null, 2));
  } else {
    console.log("warning: direct conversation row not found");
  }

  // Press the in-chat voice-call button (☎) of the private conversation.
  const callBtn = page.locator('[data-live-action="call-here"][data-call-type="audio"]').first();
  await callBtn.waitFor({ state: "visible", timeout: 15000 });
  await callBtn.click();
  await page.waitForTimeout(2000);

  const rpcCalls = await page.evaluate(() => window.__rpcCalls);
  const startCall = rpcCalls.find((r) => r.name === "team_live_start_call");
  console.log("start_call args:", JSON.stringify(startCall && startCall.args));
  const ok = Boolean(
    startCall &&
    startCall.args &&
    Array.isArray(startCall.args.p_invitee_ids) &&
    startCall.args.p_invitee_ids.length === 1 &&
    startCall.args.p_invitee_ids[0] === B &&
    startCall.args.p_scope === "direct" &&
    startCall.args.p_conversation_id === CONV,
  );
  console.log(ok ? "DIRECT CALL E2E PASSED" : "DIRECT CALL E2E FAILED");
  console.log("page errors:", errors.length ? errors : "none");
  await page.screenshot({ path: "screenshots/direct-call-e2e.png" });
  server.kill();
  await browser.close();
  process.exit(ok && errors.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
