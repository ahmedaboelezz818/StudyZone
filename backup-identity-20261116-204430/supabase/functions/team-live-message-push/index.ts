// Study Zone — optional push notifications for new team chat messages.
//
// This is a thin sender: the app calls it after a message is delivered to the
// server. It resolves the authorised recipients for the conversation and sends
// a privacy-safe FCM data message. No message body is sent; the app
// privacy settings on the device decide what is shown.
//
// Required Supabase secrets (same family as team-live-call-push):
//   FCM_PROJECT_ID, FCM_SERVICE_ACCOUNT_JSON,
//   SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, SUPABASE_URL.
//
// If FCM is not configured the function answers with {configured:false} and
// the app must treat that as "push not configured", not as a failure of the
// message itself.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function resolveCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowList = [
    /^https?:\/\/localhost(?::\d+)?$/i,
    /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i,
    /^https?:\/\/[a-z0-9-]+\.github\.io$/i,
    /^capacitor:\/\/localhost$/i,
    /^https:\/\/localhost$/i,
    /^http:\/\/localhost$/i,
  ];
  const allowedOrigin = origin && allowList.some((re) => re.test(origin)) ? origin : (origin ? "" : "*");
  // Echo a known origin when possible; fall back to * for non-browser/server contexts without Origin.
  const allowOrigin = allowedOrigin || (origin ? origin : "*");
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  } as Record<string, string>;
}

function json(body: unknown, status = 200, req?: Request) {
  const headers = req ? resolveCorsHeaders(req) : {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function b64url(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s+/g, "");
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
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
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

Deno.serve(async (req: Request) => {
  const corsHeaders = resolveCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405, req);

  const auth = req.headers.get("Authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return json({ error: "Sign in required." }, 401, req);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const projectId = Deno.env.get("FCM_PROJECT_ID") || "";
  const saRaw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON") || "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ configured: false, error: "Supabase function environment is incomplete." }, 500, req);
  }

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  const conversationId = String(body?.conversation_id || "").trim();
  if (!conversationId) return json({ error: "conversation_id is required." }, 400, req);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Sign in required." }, 401);

  const { data: conversation, error: convError } = await admin
    .from("team_conversations")
    .select("id, team_id, kind, title, task_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (convError || !conversation) return json({ error: "Conversation not found." }, 404, req);

  // Authorisation: sender must be a real member of the team.
  const { data: membership } = await admin
    .from("team_members")
    .select("user_id")
    .eq("team_id", conversation.team_id)
    .eq("user_id", user.id)
    .limit(1);
  const isOwner = false; // team_members is the app's authoritative membership list.
  if (!membership?.length && !isOwner) {
    // Fall back to the teams table owner_id for older installs without a membership row.
    const { data: owned } = await admin
      .from("teams")
      .select("id")
      .eq("id", conversation.team_id)
      .eq("owner_id", user.id)
      .limit(1);
    if (!owned?.length) return json({ error: "Not authorized for this conversation." }, 403, req);
  }

  // Authorised recipients only: members of the same team, excluding sender.
  const { data: teamMembers, error: memberError } = await admin
    .from("team_members")
    .select("user_id")
    .eq("team_id", conversation.team_id);
  if (memberError) return json({ error: "Could not resolve team members." }, 500, req);

  const recipientIds = [...new Set((teamMembers || [])
    .map((row: any) => String(row.user_id))
    .filter((id: string) => id && id !== String(user.id)))];

  if (!recipientIds.length) {
    return json({ configured: Boolean(projectId && saRaw), sent: 0, reason: "no_recipients" }, 200, req);
  }

  if (!projectId || !saRaw) {
    return json({ configured: false, sent: 0, recipients: recipientIds.length, error: "FCM not configured." }, 200, req);
  }

  let serviceAccount: any;
  try { serviceAccount = JSON.parse(saRaw); } catch { return json({ configured: false, sent: 0, error: "FCM_SERVICE_ACCOUNT_JSON is not valid JSON." }, 500, req); }

  let accessToken = "";
  try { accessToken = await getAccessToken(serviceAccount); }
  catch (e) { return json({ configured: false, sent: 0, error: String((e as Error)?.message || e) }, 500, req); }

  const { data: tokens } = await admin
    .from("device_push_tokens")
    .select("user_id, token, platform, updated_at")
    .in("user_id", recipientIds)
    .order("updated_at", { ascending: false });

  const uniqueTokens: any[] = [];
  const seen = new Set<string>();
  for (const row of tokens || []) {
    const t = String(row.token || "");
    if (!t || seen.has(t)) continue;
    seen.add(t);
    uniqueTokens.push(row);
  }

  // Privacy-safe payload: never include the message body. The device decides
  // whether to show sender name / preview based on its own preferences.
  const payload = {
    message: {
      android: { priority: "HIGH", ttl: "60s" },
      data: {
        type: "new_message",
        conversation_id: String(conversation.id),
        team_id: String(conversation.team_id),
        kind: String(conversation.kind || ""),
        page: "team-live",
      },
    },
  };

  let sent = 0;
  const failures: any[] = [];
  for (const row of uniqueTokens) {
    const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
    const message = { ...payload.message, token: row.token };
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = data?.error?.details?.find?.((d: any) => d?.errorCode)?.errorCode || data?.error?.status || "";
      failures.push({ user_id: row.user_id, status: res.status, code, error: data?.error?.message || "FCM send failed" });
      continue;
    }
    sent += 1;
  }

  return json({ configured: true, conversationId: conversation.id, recipients: recipientIds.length, tokens: uniqueTokens.length, sent, failures: failures.slice(0, 20) }, 200, req);
});
