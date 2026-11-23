// Boot the app against a mocked Supabase client on a temp server and verify the
// team-live page renders without console errors. No RPC is expected to hit production.
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const TEAM = "33333333-3333-4333-8333-333333333333";
const CONV = "44444444-4444-4444-8444-444444444444";
const CALL = "55555555-5555-4555-8555-555555555555";
const PORT = 5602;
const BASE = `http://127.0.0.1:${PORT}/`;

(async () => {
  const server = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 1600));
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe",
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text()); });

  await context.addInitScript(({ A, B, TEAM, CONV, CALL }) => {
    window.__rpcCalls = [];
    const now = new Date().toISOString();
    const conversations = [{
      id: CONV, team_id: null, kind: "direct", title: B, task_id: null,
      created_by: A, created_at: now, last_message_at: now, updated_at: now,
    }];
    const callRow = {
      id: CALL, team_id: null, conversation_id: CONV, scope: "direct", call_type: "audio",
      status: "ringing", title: null, created_by: A, created_at: now,
      started_at: null, connected_at: null, last_signal_at: now,
    };
    const tableData = {
      team_members: [
        { team_id: TEAM, user_id: A, role: "owner", joined_at: now },
        { team_id: TEAM, user_id: B, role: "member", joined_at: now },
      ],
      teams: [{ id: TEAM, name: "Biology team", owner_id: A, created_at: now }],
      profiles: [{ id: A, full_name: "Alex" }, { id: B, full_name: "Sara" }],
      team_calls: [callRow],
      team_call_participants: [
        { call_id: CALL, user_id: A, invite_status: "accepted" },
        { call_id: CALL, user_id: B, invite_status: "invited" },
      ],
      team_messages: [], team_conversations: conversations,
    };
    const rpcImpl = (name, args) => {
      window.__rpcCalls.push({ name, args });
      const t = {
        // Private DM without a shared team: the team RPC returns nothing —
        // the DM row comes ONLY from private_conversations().
        team_chat_conversations: () => ({ data: [], error: null }),
        private_conversations: () => ({ data: [
          { conversation_id: CONV, kind: "direct", title: B, peer_id: B, peer_name: "Sara", peer_avatar_url: null, created_by: A, created_at: now, updated_at: now, unread_count: 0 },
        ], error: null }),
        private_pending_invites: () => ({ data: [], error: null }),
        team_live_pending_invites: () => ({ data: [], error: null }),
        private_call_start: () => ({ data: CALL, error: null }),
        private_call_join: () => ({ data: callRow, error: null }),
        private_call_respond: () => ({ data: null, error: null }),
        private_call_end: () => ({ data: { ...callRow, status: "ended" }, error: null }),
        private_chat_mark_read: () => ({ data: null, error: null }),
        private_conversation_open_by_email: () => ({ data: [{ conversation_id: CONV, peer_id: B, peer_name: "Sara" }], error: null }),
        team_live_start_call: () => ({ data: CALL, error: null }),
        team_live_join_call: () => ({ data: callRow, error: null }),
        team_live_respond_call: () => ({ data: null, error: null }),
        team_live_end_call: () => ({ data: { ...callRow, status: "ended" }, error: null }),
        team_chat_messages: () => ({ data: [], error: null }),
        is_current_user_admin: () => ({ data: false, error: null }),
        team_profiles: () => ({ data: [{ id: A, team_id: TEAM, user_id: A, display_name: "Alex", avatar_url: null }, { id: B, team_id: TEAM, user_id: B, display_name: "Sara", avatar_url: null }], error: null }),
        generate_team_task_notifications: () => ({ data: null, error: null }),
        team_tasks: () => ({ data: [], error: null }),
      };
      return Promise.resolve(t[name] ? t[name]() : { data: null, error: null });
    };
    const chain = (table) => {
      const data = tableData[table] || [];
      let filterFn = null;
      const handler = {
        get(target, prop) {
          if (prop === "in") return (col, values) => { filterFn = (row) => Array.isArray(values) ? values.includes(row[col]) : true; return self; };
          if (prop === "then") return (res, rej) => Promise.resolve({ data: filterFn ? data.filter(filterFn) : data, error: null }).then(res, rej);
          if (prop === "maybeSingle" || prop === "single") return () => Promise.resolve({ data: (filterFn ? data.filter(filterFn) : data)[0] || null, error: null });
          return () => self;
        },
      };
      const self = new Proxy(function () {}, handler);
      return self;
    };
    const channelStub = { on: () => channelStub, subscribe: () => channelStub, unsubscribe: () => {} };
    const stubbed = {
      createClient: () => ({
        rpc: (n, a) => rpcImpl(n, a || {}),
        from: (t) => chain(t),
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
      }),
    };
    Object.defineProperty(window, "supabase", {
      configurable: true,
      get: () => stubbed,
      set: () => {},
    });
    try { window.localStorage.setItem("studyzone.selectedTeamId", TEAM); } catch {}
  }, { A, B, TEAM, CONV, CALL });

  await page.goto(BASE + "#team-live", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { try { window.StudyZoneApp?.navigate?.("team-live"); } catch (e) { console.warn(e); } });
  await page.waitForTimeout(2000);

  const panel = await page.evaluate(() => ({
    hash: location.hash,
    hasLiveShell: Boolean(document.querySelector("[data-live-shell]")),
    hasConvRow: Boolean(document.querySelector('[data-live-action="open-conversation"]')),
    hasPrivateSection: Boolean(document.querySelector('[data-live-list] .live-section-label')),
    sidebarHtml: (document.querySelector('[data-live-list]')?.innerHTML || "").slice(0, 600),
    bodyText: document.body.innerText.slice(0, 600),
  }));
  console.log("panel:", JSON.stringify(panel, null, 2));

  // Open the private conversation, then click the call button
  const row = page.locator('[data-live-action="open-conversation"]').first();
  if (!(await row.count())) {
    console.log("NO conversation row found");
  } else {
    await row.click();
    await page.waitForTimeout(1500);
    const callBtn = page.locator('[data-live-action="call-here"][data-call-type="audio"]').first();
    try { await callBtn.waitFor({ state: "visible", timeout: 8000 }); await callBtn.click(); } catch (e) { console.log("call button: ", e.message); }
    await page.waitForTimeout(1500);
    const rpcCalls = await page.evaluate(() => window.__rpcCalls.map((r) => ({ name: r.name, args: r.args })));
    const privateStart = rpcCalls.find((r) => r.name === "private_call_start");
    console.log("private_call_start:", JSON.stringify(privateStart && privateStart.args));
    console.log("rpc names:", JSON.stringify(rpcCalls.map((r) => r.name)));
    const dialogState = await page.evaluate(() => ({
      mediaErrorDialog: Boolean(document.getElementById("team-live-media-error")),
      callOverlay: Boolean(document.querySelector(".live-call-overlay")),
      bodyText: document.body.innerText.slice(0, 400),
    }));
    console.log("dialog:", JSON.stringify(dialogState, null, 2));
  }

  console.log("errors:", errors.length ? errors : "none");
  server.kill();
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
