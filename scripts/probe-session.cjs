const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const TEAM = "33333333-3333-4333-8333-333333333333";
const CONV = "44444444-4444-4444-8444-444444444444";
const CALL = "55555555-5555-4555-8555-555555555555";

(async () => {
  const PORT = 5599;
  const server = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 1600));
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Users\\ahmea\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe",
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
  const page = await context.newPage();
  page.on("console", (m) => console.log(`[${m.type()}]`, m.text().slice(0, 160)));
  page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 160)));
  await context.addInitScript(({ A, B, TEAM, CONV, CALL }) => {
    window.__rpcCalls = [];
    const now = new Date().toISOString();
    const tableData = {
      team_members: [
        { team_id: TEAM, user_id: A, role: "owner", joined_at: now },
        { team_id: TEAM, user_id: B, role: "member", joined_at: now },
      ],
      teams: [{ id: TEAM, name: "Biology team", owner_id: A, created_at: now }],
      profiles: [{ id: A, full_name: "Alex" }, { id: B, full_name: "Sara" }],
      team_calls: [{
        id: CALL, team_id: TEAM, conversation_id: CONV, scope: "direct", call_type: "audio",
        status: "ringing", title: null, created_by: A, created_at: now,
      }],
      team_call_participants: [], team_messages: [], team_conversations: [{ id: CONV, team_id: TEAM, kind: "direct", title: B, task_id: null, created_by: A, created_at: now, last_message_at: now, updated_at: now }],
    };
    const rpcImpl = (name, args) => {
      window.__rpcCalls.push({ name, args });
      const t = {
        team_chat_conversations: () => ({ data: tableData.team_conversations, error: null }),
        team_live_open_direct: () => ({ data: CONV, error: null }),
        team_live_start_call: () => ({ data: CALL, error: null }),
      };
      return Promise.resolve(t[name] ? t[name]() : { data: null, error: null });
    };
    const chain = (table) => {
      const data = tableData[table] || [];
      const handler = {
        get(_t, prop) {
          if (prop === "then") return (res, rej) => Promise.resolve({ data, error: null }).then(res, rej);
          if (prop === "maybeSingle" || prop === "single") return () => Promise.resolve({ data: data[0] || null, error: null });
          return () => proxy;
        },
      };
      const proxy = new Proxy(function () {}, handler);
      return proxy;
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
          getSession: () => Promise.resolve({ data: { session: { user: { id: A, email: "a@test", user_metadata: { full_name: "Alex" } } } }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          signOut: () => Promise.resolve({ error: null }),
        },
      }),
    };
    // The vendored UMD bundle overwrites window.supabase after us; pin a getter
    // that always returns our stub so app.js builds the fake client.
    Object.defineProperty(window, "supabase", {
      configurable: true,
      get: () => stubbed,
      set: () => {},
    });
  }, { A, B, TEAM, CONV, CALL });

  await page.goto(`http://127.0.0.1:${PORT}/#team-live`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);
  const probe = await page.evaluate(() => ({
    hash: location.hash,
    rpcDone: window.__rpcCalls.map((r) => r.name),
    teamPanelPresent: Boolean(document.querySelector("[data-live-container], [data-live-shell], .live-shell")),
    panelText: (document.querySelector("main")?.innerText || "").slice(0, 400),
    appTasks: Array.isArray(window.StudyZoneApp?.tasks) ? window.StudyZoneApp.tasks.length : "n/a",
  }));
  console.log("probe:", JSON.stringify(probe, null, 2));
  server.kill();
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
