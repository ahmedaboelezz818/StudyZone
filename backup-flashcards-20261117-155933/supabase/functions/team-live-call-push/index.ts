// Second Brain — send FCM push notifications for incoming Team Live calls.
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
import webpush from "npm:web-push@3.6.7";

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

function webPushConfigured() {
  return Boolean(
    Deno.env.get("VAPID_PUBLIC_KEY") &&
      Deno.env.get("VAPID_PRIVATE_KEY") &&
      Deno.env.get("VAPID_SUBJECT"),
  );
}

function configureWebPush() {
  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") as string,
    Deno.env.get("VAPID_PUBLIC_KEY") as string,
    Deno.env.get("VAPID_PRIVATE_KEY") as string,
  );
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
  const callerName = String(payload.caller_name || "Second Brain");
  const callType = String(payload.call_type || "audio");
  const state = String(payload.state || "ringing").toLowerCase();
  const terminal = ["ended", "canceled", "cancelled", "declined", "missed", "accepted"].includes(state);
  const title = callType === "video" ? "Incoming video call" : "Incoming audio call";
  const body = callerName;

  const message = {
    message: {
      token,
      android: {
        priority: "HIGH",
        // A terminal state is only useful long enough to cancel a ringing UI.
        ttl: terminal ? "120s" : "55s",
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
        state,
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
  const requestedState = String(body?.state || body?.action || "ringing").toLowerCase();
  const state = ["ended", "canceled", "cancelled", "declined", "missed"].includes(requestedState)
    ? requestedState
    : "ringing";

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
  // An ending call must still be allowed to push its cancellation state.
  if (String(call.status) === "ended" && state === "ringing") {
    return json({ configured: Boolean(projectId && saRaw), state, sent: 0, skipped: "ended" });
  }

  const { data: participants, error: partError } = await admin
    .from("team_call_participants")
    .select("user_id, invite_status, left_at")
    .eq("call_id", callId);
  if (partError) return json({ error: "Could not verify call participants." }, 500);

  const participantRows = participants || [];
  const actorId = String(user.id);

  // Private calls live in the same tables but may not have participant rows yet
  // (the private_call_* stack owns them). Fall back to the conversation's two
  // participants so a 1:1 call still rings when a row is missing.
  if (!participantRows.length && call.conversation_id) {
    const { data: conversation } = await admin
      .from("team_conversations")
      .select("participant_a, participant_b")
      .eq("id", call.conversation_id)
      .maybeSingle();
    for (const value of [conversation?.participant_a, conversation?.participant_b]) {
      if (value) participantRows.push({ user_id: String(value), invite_status: "invited", left_at: null });
    }
  }

  const isCreator = String(call.created_by) === actorId;
  const myRow = participantRows.find((p: any) => String(p.user_id) === actorId);
  const isAcceptedParticipant = Boolean(
    myRow &&
    !myRow.left_at &&
    ["accepted", "joined", "connected"].includes(String(myRow.invite_status || "").toLowerCase()),
  );

  if (state === "ringing") {
    if (!myRow && !isCreator) return json({ error: "Not authorized for this call." }, 403);
  } else if (state === "ended" || state === "canceled" || state === "cancelled") {
    // Only the host or somebody who actually joined may end the ringing UI on
    // every other device.
    if (!isCreator && !isAcceptedParticipant) {
      return json({ error: "Not authorized to end this call." }, 403);
    }
  } else if (!myRow && !isCreator) {
    return json({ error: "Not authorized for this call." }, 403);
  }

  let targetUserIds: string[] = [];
  if (state === "ended" || state === "canceled" || state === "cancelled") {
    targetUserIds = [...new Set(participantRows
      .filter((p: any) => String(p.user_id) !== actorId)
      .map((p: any) => String(p.user_id)))];
  } else if (state === "declined" || state === "missed") {
    const creatorId = String(call.created_by || "");
    targetUserIds = creatorId && creatorId !== actorId ? [creatorId] : [];
  } else {
    // Ring only users who have not joined, declined or left yet.
    targetUserIds = [...new Set(participantRows
      .filter((p: any) => String(p.user_id) !== actorId)
      .filter((p: any) => p.invite_status === "invited" || p.invite_status === "ringing" || p.invite_status === "pending" || !p.invite_status)
      .filter((p: any) => !p.left_at)
      .map((p: any) => String(p.user_id)))];
  }

  const webConfigured = webPushConfigured();
  const fcmConfigured = Boolean(projectId && saRaw);

  if (!targetUserIds.length) {
    return json({ configured: fcmConfigured || webConfigured, state, sent: 0, reason: "no_targets" });
  }

  let serviceAccount: any = null;
  let accessToken = "";
  let fcmError = "";
  let canUseFcm = fcmConfigured;
  if (canUseFcm) {
    try {
      serviceAccount = JSON.parse(saRaw);
    } catch {
      canUseFcm = false;
      fcmError = "FCM_SERVICE_ACCOUNT_JSON is not valid JSON.";
    }
    if (canUseFcm && (!serviceAccount?.client_email || !serviceAccount?.private_key)) {
      canUseFcm = false;
      fcmError = "FCM_SERVICE_ACCOUNT_JSON is missing client_email/private_key.";
    }
    if (canUseFcm) {
      try {
        accessToken = await getAccessToken(serviceAccount);
      } catch (e) {
        canUseFcm = false;
        fcmError = String((e as Error)?.message || e);
      }
    }
  }

  // Resolve caller/team info for display.
  let callerName = String(body?.caller_name || body?.callerName || "Second Brain");
  let teamName = String(body?.team_name || body?.teamName || "");
  try {
    const [{ data: profile }, { data: team }] = await Promise.all([
      admin.from("profiles").select("id, full_name, name, username").eq("id", user.id).maybeSingle(),
      call.team_id
        ? admin.from("teams").select("id, name").eq("id", call.team_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (!body?.caller_name && !body?.callerName) {
      callerName = profile?.full_name || profile?.name || profile?.username || callerName;
    }
    if (!teamName) teamName = team?.name || "";
  } catch {
    // best effort
  }

  const tokens = canUseFcm
    ? (await admin
      .from("device_push_tokens")
      .select("user_id, token, platform, updated_at")
      .in("user_id", targetUserIds)
      .order("updated_at", { ascending: false })).data
    : [];

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
    state,
  };

  let sent = 0;
  const failures: any[] = [];
  for (const row of uniqueTokens) {
    const result = await sendFcmMessage(projectId, accessToken, row.token, payload);
    if (result.ok) sent += 1;
    else failures.push({ user_id: row.user_id, ...result });
  }

  // Web Push (Service Worker). Separate from FCM: browsers keep a
  // push_subscriptions row keyed to the same user account.
  let webSent = 0;
  const webFailures: any[] = [];
  if (webConfigured) {
    try {
      configureWebPush();
      const { data: subscriptions } = await admin
        .from("push_subscriptions")
        .select("user_id,endpoint,p256dh,auth_secret")
        .in("user_id", targetUserIds);
      for (const sub of subscriptions || []) {
        const endpoint = String(sub.endpoint || "");
        if (!endpoint) continue;
        try {
          await webpush.sendNotification({
            endpoint,
            keys: { p256dh: String(sub.p256dh || ""), auth: String(sub.auth_secret || "") },
          }, JSON.stringify({
            title: state === "ringing"
              ? (payload.call_type === "video" ? "Incoming video call" : "Incoming audio call")
              : "Call ended",
            body: callerName,
            url: state === "ringing"
              ? `./#team-live?call=${encodeURIComponent(payload.call_id)}`
              : "./#team-live",
            tag: `studyzone-call-${payload.call_id}`,
            type: "call",
            state,
            call_id: payload.call_id,
            call_type: payload.call_type,
            conversation_id: payload.conversation_id,
            requireInteraction: state === "ringing",
          }), { TTL: state === "ringing" ? 55 : 120 });
          webSent += 1;
        } catch (error) {
          const statusCode = Number((error as { statusCode?: number })?.statusCode);
          if (statusCode === 404 || statusCode === 410) {
            await admin.from("push_subscriptions").delete()
              .eq("user_id", sub.user_id).eq("endpoint", endpoint);
          }
          webFailures.push({ user_id: sub.user_id, status: statusCode || 0 });
        }
      }
    } catch (error) {
      webFailures.push({ error: String((error as Error)?.message || error) });
    }
  }

  return json({
    configured: canUseFcm || webConfigured,
    fcmConfigured: canUseFcm,
    webPushConfigured: webConfigured,
    fcmError: fcmError || undefined,
    callId: String(call.id),
    state,
    targets: targetUserIds.length,
    tokens: uniqueTokens.length,
    sent,
    failures: failures.slice(0, 20),
    webSubscriptions: webSent + webFailures.length,
    webSent,
    webFailures: webFailures.slice(0, 20),
    note: "FCM delivery to background/terminated devices depends on device state and OEM restrictions; force-stopped apps may not receive pushes.",
  });
});
