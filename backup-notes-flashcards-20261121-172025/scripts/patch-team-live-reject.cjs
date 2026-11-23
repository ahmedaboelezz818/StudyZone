const fs = require("fs");
let s = fs.readFileSync("team-live.js", "utf8");
const pairs = [
  ['void rpc("team_live_respond_call", { p_call_id: id, p_accept: false }).c',
   'void respondToInviteRpc(id, false).c'],
  ['await rpc("team_live_respond_call", { p_call_id: id, p_accept: false })',
   'await respondToInviteRpc(id, false)'],
  ['void rpc("team_live_respond_call", { p_call_id: id, p_accept: true }).catch(() => {})',
   'void respondToInviteRpc(id, true).catch(() => {})'],
  ['await rpc("team_live_respond_call", { p_call_id: id, p_accept: true })',
   'await respondToInviteRpc(id, true)'],
  ['await rpc("team_live_join_call", { p_call_id: id });',
   'await joinCallRpc(id);'],
  ['await rpc("team_live_end_call", { p_call_id: id });',
   'await endCallRpc(id);'],
  ['void rpc("team_live_end_call", { p_call_id: callId }).catch(() => {',
   'void endCallRpc(callId).catch(() => {'],
  ['void rpc("team_live_leave_call", { p_call_id: callId }).catch(() => {});',
   'void endCallRpc(callId).catch(() => {});'],
  ['void rpc("team_live_leave_call", { p_call_id: id }).catch(() => {});',
   'void endCallRpc(id).catch(() => {});'],
  ['await rpc("team_live_leave_call", { p_call_id: id });',
   'await endCallRpc(id);'],
];
let changed = 0;
for (const [from, to] of pairs) {
  const n = s.split(from).length - 1;
  s = s.split(from).join(to);
  console.log(n + " replaced: " + from.slice(0, 60));
  changed += n;
}
fs.writeFileSync("team-live.js", s, "utf8");
console.log("total replacements:", changed);
