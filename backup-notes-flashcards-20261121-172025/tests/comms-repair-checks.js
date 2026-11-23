/*
 * Focused regression checks for the communication-system repair.
 *
 * These are static/behavioural assertions over the shipped source. They do not
 * pretend to replace two-device WebRTC/FCM testing; they lock in the exact
 * fixes that were applied so they cannot silently regress.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const teamLive = read("team-live.js");
const app = read("app.js");
const sw = read("service-worker.js");
const offline = read("offline-sync.js");
const messagePush = read("supabase/functions/team-live-message-push/index.ts");
const callPush = read("supabase/functions/team-live-call-push/index.ts");
const turn = read("supabase/functions/turn-credentials/index.ts");
const migration012 = read("supabase/migrations/012_fix_team_live_invite_call_ambiguous.sql");

let passed = 0;
const failures = [];

function check(name, condition) {
  if (condition) {
    passed += 1;
  } else {
    failures.push(name);
  }
}

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) return "";
  const end = source.indexOf(endMarker, start + startMarker.length);
  return end < 0 ? source.slice(start) : source.slice(start, end);
}

// --- Private chats work without a shared team -------------------------------
check(
  "Private conversations are subscribed by conversation_id",
  teamLive.includes("function ensureConversationChannel") &&
    teamLive.includes("filter: `conversation_id=eq.${id}`"),
);
check(
  "Opening a conversation subscribes its Realtime channel",
  /ensureConversationChannel\(S\.activeId\)/.test(teamLive),
);
check(
  "Conversation polling no longer requires a team",
  /function startConversationPolling\(\) \{[\s\S]*?if \(!me\(\)\) return;/.test(teamLive) &&
    !/function startConversationPolling\(\) \{[\s\S]{0,300}!S\.teamId/.test(teamLive),
);
check(
  "Team Live page renders without a team",
  !teamLive.includes('Create or join a team first'),
);
check(
  "Team Live mount does not bail out without a selected team",
  /function mount\(\) \{[\s\S]{0,500}const teamId = deps\.getSelectedTeamId\(\) \|\| null;/.test(teamLive) &&
    !/function mount\(\) \{[\s\S]{0,500}if \(!teamId\) return;/.test(teamLive),
);
check(
  "Private DM fallback uses private_conversation_open without a team",
  /: await rpc\("private_conversation_open", \{\s*p_other_user_id: otherUserId/.test(teamLive),
);
check(
  "startDirectCall can start a private call without a team",
  /function startDirectCall[\s\S]{0,3000}rpc\("private_conversation_open"/.test(teamLive) &&
    /function startDirectCall[\s\S]{0,3000}startPrivateCall/.test(teamLive),
);

// --- Remote video is actually attached and played ---------------------------
check(
  "Call tiles include autoplay/playsinline/webkit-playsinline",
  /<video autoplay playsinline webkit-playsinline preload="auto"/.test(teamLive),
);
check(
  "Remote streams call video.play() through a guarded helper",
  teamLive.includes("function playVideoSafely") &&
    /playVideoSafely\(video, "remote"\)/.test(teamLive),
);
check(
  "Tile visibility follows live tracks, not stale camera_on",
  teamLive.includes("function tileHasLiveVideo") &&
    /tile\.classList\.toggle\("camera-off", !isAudio && !tileHasLiveVideo\(id\)\)/.test(teamLive),
);
check(
  "ontrack re-attaches and re-evaluates visibility",
  /pc\.ontrack = \(event\) => \{[\s\S]{0,1600}attachRemoteStream\(id, peer\.remoteStream\)/.test(teamLive),
);
check(
  "Private calls render the peer tile before a participant row exists",
  teamLive.includes("function privateCallPeerId") &&
    teamLive.includes("function callStageRows") &&
    /const rows = callStageRows\(call\)/.test(teamLive),
);

// --- Notifications -----------------------------------------------------------
check(
  "Incoming-call UI notification prefers Service Worker showNotification",
  /function notifyIncoming[\s\S]{0,2200}registration\.showNotification/.test(teamLive),
);
check(
  "Service worker closes ringing notifications on terminal call states",
  /type === "call" && terminalCall/.test(sw) &&
    /getNotifications\(\{ tag \}\)/.test(sw),
);
check(
  "Service worker carries call/message ids in notification data",
  /payload\.call_id \? \{ call_id: payload\.call_id \}/.test(sw) &&
    /payload\.message_id \? \{ message_id: payload\.message_id \}/.test(sw),
);
check(
  "Deep links open the right private conversation",
  app.includes("function parseRoute") &&
    app.includes("function openLiveTarget") &&
    /openConversationById\?\.\(conversationId\)/.test(app),
);
check(
  "Service worker registration is skipped inside Capacitor",
  app.includes("isCapacitorNative") &&
    /const canUseServiceWorker =\s*"serviceWorker" in navigator &&\s*!isCapacitorNative/.test(app),
);

// --- Edge functions ----------------------------------------------------------
check(
  "Message push authorises private participants and targets only the peer",
  messagePush.includes("participant_a") &&
    messagePush.includes("participant_b") &&
    /parts\.filter\(\(id\) => id !== senderId\)/.test(messagePush),
);
check(
  "Message push sends Web Push as well as FCM",
  messagePush.includes("npm:web-push@3.6.7") &&
    messagePush.includes('from("push_subscriptions")') &&
    messagePush.includes("studyzone-msg-"),
);
check(
  "Call push no longer drops non-Android tokens",
  !/String\(row\.platform\)\.toLowerCase\(\) !== "android"\) continue/.test(callPush),
);
check(
  "Call push falls back to conversation participants for private calls",
  /!participantRows\.length && call\.conversation_id/.test(callPush),
);
check(
  "Call push sends Web Push with the call deep link",
  callPush.includes("npm:web-push@3.6.7") &&
    callPush.includes('`./#team-live?call='),
);
check(
  "TURN credentials allow private conversation participants",
  turn.includes("participant_a") && turn.includes("participant_b"),
);

// --- Offline queue -----------------------------------------------------------
check(
  "Offline chat rows receive sender_id for correct rendering",
  /table === "team_messages" && !next\.sender_id/.test(offline),
);
check(
  "Offline queue keeps the client-generated id for idempotent replay",
  /if \(!payload\.id\) payload\.id = uuid\(\);/.test(offline) &&
    /"x-idempotency-key": entry\.id/.test(offline),
);

// --- SQL ---------------------------------------------------------------------
check(
  "Migration 012 drops only the uuid[] invite overload",
  /drop function if exists public\.team_live_invite_call\(uuid, uuid\[\]\)/i.test(migration012) &&
    !/drop table|truncate|drop column|drop cascade/i.test(migration012),
);

if (failures.length) {
  console.error(`Communication repair checks failed (${failures.length}):`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`Communication repair checks passed: ${passed}`);
