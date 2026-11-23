/* Dependency-free Team Live helper checks. Run: node tests/team-live-unit.js */
const core = require("../team-live-core.js");

let passed = 0;
const failures = [];
function check(name, condition) {
  if (condition) passed += 1;
  else failures.push(name);
}
function equal(name, actual, expected) {
  check(
    `${name} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`,
    JSON.stringify(actual) === JSON.stringify(expected),
  );
}

function containsAll(name, actual, expected) {
  const actualObject = actual || {};
  const missing = Object.entries(expected).filter(
    ([key, value]) => JSON.stringify(actualObject[key]) !== JSON.stringify(value),
  );
  check(`${name} (missing ${JSON.stringify(missing)})`, missing.length === 0);
}

/* ---------- attachment validation ---------- */
equal("rejects a missing file", core.validateAttachment(null), {
  ok: false,
  reason: "empty",
});
equal("rejects a zero-byte file", core.validateAttachment({ size: 0, type: "image/png" }), {
  ok: false,
  reason: "empty",
});
equal("rejects a negative size", core.validateAttachment({ size: -5, type: "image/png" }), {
  ok: false,
  reason: "empty",
});
equal(
  "rejects oversized files",
  core.validateAttachment({ size: core.MAX_ATTACHMENT_BYTES + 1, type: "image/png" }),
  { ok: false, reason: "too_large" },
);
equal(
  "accepts a file exactly at the limit",
  core.validateAttachment({ size: core.MAX_ATTACHMENT_BYTES, type: "image/png" }),
  { ok: true, type: "image/png", image: true, video: false, audio: false },
);
equal(
  "rejects unknown mime types",
  core.validateAttachment({ size: 10, type: "application/x-msdownload" }),
  { ok: false, reason: "type" },
);
equal(
  "rejects missing mime types",
  core.validateAttachment({ size: 10, type: "" }),
  { ok: false, reason: "type" },
);
equal(
  "normalizes mime parameters",
  core.validateAttachment({ size: 10, type: "Image/JPEG; charset=binary" }),
  { ok: true, type: "image/jpeg", image: true, video: false, audio: false },
);
equal(
  "accepts a PDF as a non-image attachment",
  core.validateAttachment({ size: 10, type: "application/pdf" }),
  { ok: true, type: "application/pdf", image: false, video: false, audio: false },
);
equal(
  "accepts docx (long openxml type)",
  core.validateAttachment({
    size: 10,
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }),
  {
    ok: true,
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    image: false,
    video: false,
    audio: false,
  },
);

check("image detection is case-insensitive", core.isImageType("IMAGE/WEBP"));
check("image detection ignores parameters", core.isImageType("image/png;foo=bar"));
check("non-image is not treated as an image", !core.isImageType("application/pdf"));

/* ---------- attachment file names ---------- */
equal(
  "strips path separators and leading dots",
  core.safeAttachmentName("../../etc/passwd"),
  "-..-etc-passwd",
);
equal("strips windows-illegal characters", core.safeAttachmentName('a<b>c:d"e|f?g*h'), "a-b-c-d-e-f-g-h");
equal("falls back for an empty name", core.safeAttachmentName("   "), "file");
equal("falls back for a null name", core.safeAttachmentName(null), "file");
equal("removes leading dots", core.safeAttachmentName("..hidden.txt"), "hidden.txt");
check(
  "limits long names",
  core.safeAttachmentName("a".repeat(400)).length === 140,
);

/* ---------- message text ---------- */
check(
  "clamps message bodies to the schema limit",
  core.clampMessageText("x".repeat(core.MAX_MESSAGE_LENGTH + 500)).length ===
    core.MAX_MESSAGE_LENGTH,
);
equal("handles null message bodies", core.clampMessageText(null), "");

/* ---------- byte formatting ---------- */
equal("formats bytes", core.formatBytes(512), "512 B");
equal("formats kilobytes", core.formatBytes(2048), "2.0 KB");
equal("formats megabytes", core.formatBytes(5 * 1024 * 1024), "5.0 MB");
equal("clamps negative bytes", core.formatBytes(-4), "0 B");

/* ---------- ICE servers ---------- */
const fallback = core.defaultIceServers();
check("fallback ICE config is a single group", fallback.length === 1);
check("fallback ICE config exposes urls array", Array.isArray(fallback[0].urls));
check(
  "fallback ICE entries are all STUN",
  fallback[0].urls.every((url) => /^stun:/i.test(url)),
);

const merged = core.mergeIceServers(
  null,
  [{ urls: "stun:stun.example.org:3478" }],
  [{ urls: ["turn:turn.example.org:3478", "  ", "ftp://bad"] , username: "u", credential: "c" }],
  [{ urls: "stun:stun.example.org:3478" }],
  [{ urls: "turn:turn.example.org:3478", username: "u", credential: "c" }],
);
equal("merges and de-duplicates ICE servers", merged, [
  { urls: ["stun:stun.example.org:3478"] },
  {
    urls: ["turn:turn.example.org:3478"],
    username: "u",
    credential: "c",
  },
]);
check(
  "invalid ICE entries alone fall back to STUN",
  core.mergeIceServers([{ urls: "http://nope" }])[0].urls.every((url) =>
    /^stun:/i.test(url),
  ),
);
check(
  "empty ICE input falls back to STUN",
  JSON.stringify(core.mergeIceServers()) === JSON.stringify(core.defaultIceServers()),
);
check(
  "TURN credentials are preserved verbatim",
  core.mergeIceServers([
    { urls: "turns:turn.example.org:443", username: "169:user", credential: "abc+/=" },
  ])[0].credential === "abc+/=",
);

/* ---------- call quality ---------- */
equal("missing sample is unknown", core.qualityFromSample(null), "unknown");
equal("empty sample is unknown", core.qualityFromSample({}), "unknown");
equal(
  "clean sample is good",
  core.qualityFromSample({ packetsReceived: 1000, packetsLost: 0, rtt: 40, jitter: 0.005 }),
  "good",
);
equal(
  "moderate loss is fair",
  core.qualityFromSample({ packetsReceived: 1000, packetsLost: 40, rtt: 100, jitter: 0.01 }),
  "fair",
);
equal(
  "heavy loss is poor",
  core.qualityFromSample({ packetsReceived: 1000, packetsLost: 300, rtt: 100, jitter: 0.01 }),
  "poor",
);
equal(
  "high latency is poor",
  core.qualityFromSample({ packetsReceived: 1000, packetsLost: 0, rtt: 900, jitter: 0.01 }),
  "poor",
);
equal(
  "high jitter is poor",
  core.qualityFromSample({ packetsReceived: 1000, packetsLost: 0, rtt: 40, jitter: 0.2 }),
  "poor",
);
equal(
  "only-lost sample is still measured",
  core.qualityFromSample({ packetsReceived: 0, packetsLost: 10, rtt: 0, jitter: 0 }),
  "poor",
);

/* ---------- initiator role ---------- */
check("smaller id initiates", core.shouldInitiate("aaa", "bbb"));
check("larger id does not initiate", !core.shouldInitiate("bbb", "aaa"));
check("equal ids never initiate", !core.shouldInitiate("same", "same"));
check("missing ids never initiate", !core.shouldInitiate("", "bbb"));
check("null ids never initiate", !core.shouldInitiate(null, undefined));
check(
  "exactly one side of a pair initiates",
  core.shouldInitiate("a", "b") !== core.shouldInitiate("b", "a"),
);

/* ---------- duration ---------- */
equal("formats seconds", core.formatDuration(5), "00:05");
equal("pads minutes", core.formatDuration(65), "01:05");
equal("formats hours", core.formatDuration(3725), "1:02:05");
equal("clamps negatives", core.formatDuration(-10), "00:00");
equal("handles junk", core.formatDuration("nope"), "00:00");
equal("stops the clock at zero on NaN", core.formatDuration(NaN), "00:00");

/* ---------- unread ---------- */
equal("sums unread counts", core.unreadTotal([{ unread_count: 2 }, { unread_count: 3 }]), 5);
equal("ignores negative unread counts", core.unreadTotal([{ unread_count: -4 }]), 0);
equal("ignores missing unread counts", core.unreadTotal([{}, { unread_count: "3" }]), 3);
equal("handles non-array input", core.unreadTotal(null), 0);
equal("empty conversation list", core.unreadTotal([]), 0);

/* ---------- active call lookup ---------- */
const calls = [
  { id: "c1", team_id: "t1", status: "ended" },
  { id: "c2", team_id: "t1", status: "active" },
  { id: "c3", team_id: "t2", status: "ringing" },
];
equal("finds the live call for a team", core.activeCallForTeam(calls, "t1"), {
  id: "c2",
  team_id: "t1",
  status: "active",
});
equal("finds a ringing call for another team", core.activeCallForTeam(calls, "t2"), {
  id: "c3",
  team_id: "t2",
  status: "ringing",
});
equal("returns null when only ended calls exist", core.activeCallForTeam(calls, "t3"), null);
equal("accepts numeric team ids", core.activeCallForTeam([{ team_id: 7, status: "active" }], 7), {
  team_id: 7,
  status: "active",
});
equal("handles non-array call lists", core.activeCallForTeam(null, "t1"), null);

/* ---------- call support ---------- */
const supported = {
  hasRTCPeerConnection: true,
  hasMediaDevices: true,
  secureContext: true,
};
equal("supports a secure WebRTC browser", core.callSupport(supported), {
  supported: true,
  reason: "",
});
equal("localhost counts as secure", core.callSupport({ ...supported, secureContext: false, hostname: "localhost" }), {
  supported: true,
  reason: "",
});
equal("loopback counts as secure", core.callSupport({ ...supported, secureContext: false, hostname: "127.0.0.1" }), {
  supported: true,
  reason: "",
});
equal("https protocol counts as secure", core.callSupport({ ...supported, secureContext: false, protocol: "https:" }), {
  supported: true,
  reason: "",
});
equal(
  "rejects browsers without WebRTC",
  core.callSupport({ ...supported, hasRTCPeerConnection: false }),
  { supported: false, reason: "webrtc" },
);
equal(
  "rejects environments without getMediaDevices",
  core.callSupport({ ...supported, hasMediaDevices: false }),
  { supported: false, reason: "media" },
);
equal(
  "rejects insecure origins",
  core.callSupport({ ...supported, secureContext: false, protocol: "http:", hostname: "example.com" }),
  { supported: false, reason: "insecure" },
);
equal("handles empty input", core.callSupport(), { supported: false, reason: "webrtc" });

/* ---------- limits ---------- */
check("attachment limit is 20 MB", core.MAX_ATTACHMENT_BYTES === 20 * 1024 * 1024);
check("message limit is 4000 chars", core.MAX_MESSAGE_LENGTH === 4000);
check("call mesh limit is 8", core.MAX_CALL_PARTICIPANTS === 8);

/* ---------- report ---------- */
if (failures.length) {
  console.error(`Team Live unit checks failed (${failures.length}):`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`Team Live unit checks passed: ${passed}`);
