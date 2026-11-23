// Second Brain — short-lived TURN credentials.
//
// The browser/APK never receives the TURN shared secret. It authenticates with
// its Supabase access token, and this function mints coturn REST-style
// credentials:
//
//   username   = "<unix-expiry>:<user-id>"
//   credential = base64(HMAC-SHA1(TURN_SHARED_SECRET, username))
//
// Required secrets (supabase secrets set ...):
//   TURN_URLS           comma-separated turn:/turns: URLs, e.g.
//                       turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349
//   TURN_SHARED_SECRET  the same static-auth-secret configured in coturn
// Optional:
//   TURN_TTL_SECONDS    credential lifetime, default 3600, capped at 86400
//   STUN_URLS           comma-separated stun: URLs
//
// If TURN is not configured the function still answers with public STUN only
// and `configured: false`, so the UI can explain that strict NATs may fail.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_STUN = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
  "stun:stun.cloudflare.com:3478",
];

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

function splitUrls(value: string | undefined, fallback: string[]): string[] {
  const list = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => /^(stun|turn|turns):/i.test(item));
  return list.length ? list : fallback;
}

function base64Bytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function hmacSha1Base64(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return base64Bytes(new Uint8Array(signature));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Use POST." }, 405);
  }

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return json({ error: "Sign in required." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !anonKey) {
    return json({ error: "Function is not configured." }, 500);
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user) {
    return json({ error: "Sign in required." }, 401);
  }

  // Credentials are for people who belong to a team or to at least one private
  // 1:1 conversation. Private chats/calls must work without a shared team.
  const [owned, member, privateChat] = await Promise.all([
    client.from("teams").select("id").eq("owner_id", user.id).limit(1),
    client.from("team_members").select("team_id").eq("user_id", user.id).limit(1),
    client
      .from("team_conversations")
      .select("id")
      .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
      .limit(1),
  ]);
  if (!owned?.data?.length && !member?.data?.length && !privateChat?.data?.length) {
    return json({ error: "Team membership or a private conversation is required." }, 403);
  }

  const stunUrls = splitUrls(Deno.env.get("STUN_URLS"), DEFAULT_STUN);
  const turnUrls = splitUrls(Deno.env.get("TURN_URLS"), []);
  const secret = Deno.env.get("TURN_SHARED_SECRET") || "";

  if (!turnUrls.length || !secret) {
    return json({
      configured: false,
      ttl: 0,
      iceServers: [{ urls: stunUrls }],
      warning:
        "TURN is not configured. Calls work on many networks through STUN, but strict NAT or mobile networks may fail.",
    });
  }

  const requestedTtl = Number(Deno.env.get("TURN_TTL_SECONDS") || 3600);
  const ttl = Math.min(
    86400,
    Math.max(300, Number.isFinite(requestedTtl) ? requestedTtl : 3600),
  );
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  const username = `${expiresAt}:${user.id}`;
  const credential = await hmacSha1Base64(secret, username);

  return json({
    configured: true,
    ttl,
    expiresAt,
    iceServers: [
      { urls: stunUrls },
      { urls: turnUrls, username, credential },
    ],
  });
});
