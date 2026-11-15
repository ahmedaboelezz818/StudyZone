// Study Zone — send FCM push notifications for incoming Team Live calls.
//
// This function is called by the app after a call/invite is created so invited
// users receive a high-priority push even when the app is backgrounded or not
// currently open. It never exposes service credentials to clients.
//
// Required Supabase secrets:
//   FCM_PROJECT_ID            Firebase project ID (e.g. my-project-123)
//   FCM_SERVICE_ACCOUNT_JSON  Full Firebase service account JSON (string)
//
// If these are missing, the function returns { configured: false, ... } and no
// pushes are sent. The app must treat this as "FCM not configured", not as
// success.
//
// Notes:
// - Android delivery after force-stop or with restricted background/network
//   depends on device/OEM/FCM behavior and cannot be guaranteed by this code.
// - This sends data messages with high priority and Android-specific options so
//   the native app can display a full-screen incoming call UI.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function b64url(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${b64url(new Uint8Array(signature))}`;

  const res = await fetch(serviceAccount.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || "Could not obtain FCM access token");
  }
  return data.access_token;
}

async function sendFcmMessage(projectId: string, accessToken: string, token: string, payload: any) {
  const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
  const callId = String(payload.call_id || "");
  const callerName = String(payload.caller_name || "Study Zone");
  const callType = String(payload.call_type || "audio");
  const title = callType === "video" ? "Incoming video call" : "Incoming audio call";
  const body = callerName;

  const message = {
    message: {
      token,
      android: {
        priority: "HIGH",
        ttl: "55s",
      },
      data: {
        type: "incoming_call",
        call_id: callId,
        caller_name: String(payload.caller_name || ""),
        caller_id: String(payload.caller_id || ""),
        call_type: callType,
        team_name: String(payload.team_name || ""),
        conversation_id: String(payload.conversation_id || ""),
        scope: String(payload.scope || ""),
        avatar: String(payload.avatar || ""),
        state: "ringing",
        page: "team-live",
        title,
        body,
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = data?.error?.details?.find?.((d: any) => d?.errorCode)?.errorCode || data?.error?.status || "";
    return { ok: false, status: res.status, code, error: data?.error?.message || "FCM send failed" };
  }
  return { ok: true, name: data?.name || null };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const auth = req.headers.get("Authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return json({ error: "Sign in required." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const projectId = Deno.env.get("FCM_PROJECT_ID") || "";
  const saRaw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON") || "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ configured: false, error: "Supabase function environment is incomplete." }, 500);
  }

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  const callId = String(body?.call_id || body?.callId || "").trim();
  if (!callId) return json({ error: "call_id is required." }, 400);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Sign in required." }, 401);

  // Verify caller is a participant/authorized for this call and load invitees.
  const { data: call, error: callError } = await admin
    .from("team_calls")
    .select("id, team_id, conversation_id, call_type, status, title, created_by, scope")
    .eq("id", callId)
    .maybeSingle();
  if (callError || !call) return json({ error: "Call not found." }, 404);
  if (String(call.status) === "ended") return json({ configured: Boolean(projectId && saRaw), sent: 0, skipped: "ended" });

  const { data: participants, error: partError } = await admin
    .from("team_call_participants")
    .select("user_id, invite_status, left_at")
    .eq("call_id", callId);
  if (partError) return json({ error: "Could not verify call participants." }, 500);

  const participantRows = participants || [];
  const isParticipant = participantRows.some((p: any) => String(p.user_id) === String(user.id));
  const isCreator = String(call.created_by) === String(user.id);
  if (!isParticipant && !isCreator) return json({ error: "Not authorized for this call." }, 403);

  const targetUserIds = [...new Set(participantRows
    .filter((p: any) => String(p.user_id) !== String(user.id))
    .filter((p: any) => p.invite_status === "invited" || p.invite_status === "ringing" || p.invite_status === "pending" || !p.invite_status)
    .filter((p: any) => !p.left_at)
    .map((p: any) => String(p.user_id)))];

  if (!targetUserIds.length) {
    return json({ configured: Boolean(projectId && saRaw), sent: 0, reason: "no_targets" });
  }

  if (!projectId || !saRaw) {
    return json({
      configured: false,
      sent: 0,
      targetUsers: targetUserIds.length,
      error: "FCM not configured. Set FCM_PROJECT_ID and FCM_SERVICE_ACCOUNT_JSON secrets for team-live-call-push.",
    });
  }

  let serviceAccount: any;
  try {
    serviceAccount = JSON.parse(saRaw);
  } catch {
    return json({ configured: false, sent: 0, error: "FCM_SERVICE_ACCOUNT_JSON is not valid JSON." }, 500);
  }
  if (!serviceAccount?.client_email || !serviceAccount?.private_key) {
    return json({ configured: false, sent: 0, error: "FCM_SERVICE_ACCOUNT_JSON is missing client_email/private_key." }, 500);
  }

  let accessToken = "";
  try {
    accessToken = await getAccessToken(serviceAccount);
  } catch (e) {
    return json({ configured: false, sent: 0, error: String((e as Error)?.message || e) }, 500);
  }

  // Resolve caller/team info for display.
  let callerName = String(body?.caller_name || body?.callerName || "Study Zone");
  let teamName = String(body?.team_name || body?.teamName || "");
  try {
    const [{ data: profile }, { data: team }] = await Promise.all([
      admin.from("profiles").select("id, full_name, name, username").eq("id", user.id).maybeSingle(),
      admin.from("teams").select("id, name").eq("id", call.team_id).maybeSingle(),
    ]);
    if (!body?.caller_name && !body?.callerName) {
      callerName = profile?.full_name || profile?.name || profile?.username || callerName;
    }
    if (!teamName) teamName = team?.name || "";
  } catch {
    // best effort
  }

  const { data: tokens, error: tokenError } = await admin
    .from("device_push_tokens")
    .select("user_id, token, platform, updated_at")
    .in("user_id", targetUserIds)
    .order("updated_at", { ascending: false });
  if (tokenError) return json({ error: "Could not load device push tokens." }, 500);

  const uniqueTokens = [];
  const seen = new Set();
  for (const row of tokens || []) {
    const t = String(row.token || "");
    if (!t || seen.has(t)) continue;
    seen.add(t);
    uniqueTokens.push(row);
  }

  const payload = {
    call_id: String(call.id),
    caller_name: callerName,
    caller_id: String(user.id),
    call_type: String(call.call_type || "audio"),
    team_name: teamName,
    conversation_id: String(call.conversation_id || ""),
    scope: String(call.scope || ""),
  };

  let sent = 0;
  const failures: any[] = [];
  for (const row of uniqueTokens) {
    const result = await sendFcmMessage(projectId, accessToken, row.token, payload);
    if (result.ok) sent += 1;
    else failures.push({ user_id: row.user_id, ...result });
  }

  return json({
    configured: true,
    callId: String(call.id),
    targets: targetUserIds.length,
    tokens: uniqueTokens.length,
    sent,
    failures: failures.slice(0, 20),
    note: "FCM delivery to background/terminated devices depends on device state and OEM restrictions; force-stopped apps may not receive pushes.",
  });
});
