/*
 * Study Zone — Team Live core helpers.
 *
 * These functions are deliberately dependency-free and side-effect-free so the
 * browser, the Android WebView and Node tests all exercise the same rules.
 * Nothing here talks to Supabase or opens a camera/microphone.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StudyZoneTeamLiveCore = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
  const MAX_MESSAGE_LENGTH = 4000;
  const MAX_CALL_PARTICIPANTS = 8;

  const IMAGE_TYPES = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
  ];

  const FILE_TYPES = [
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "application/x-zip-compressed",
    "application/json",
  ];

  const AUDIO_TYPES = [
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
    "audio/aac",
    "audio/x-m4a",
  ];

  const ALLOWED_ATTACHMENT_TYPES = [...IMAGE_TYPES, ...FILE_TYPES, ...AUDIO_TYPES];

  const DEFAULT_STUN = [
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
    "stun:stun.cloudflare.com:3478",
  ];

  function normalizeMime(value) {
    return String(value || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
  }

  function isImageType(value) {
    return IMAGE_TYPES.includes(normalizeMime(value));
  }

  function isAudioType(value) {
    return AUDIO_TYPES.includes(normalizeMime(value));
  }

  function validateAttachment(file) {
    if (!file) return { ok: false, reason: "empty" };
    const size = Number(file.size || 0);
    if (!Number.isFinite(size) || size <= 0) {
      return { ok: false, reason: "empty" };
    }
    if (size > MAX_ATTACHMENT_BYTES) {
      return { ok: false, reason: "too_large" };
    }
    const type = normalizeMime(file.type);
    if (!type || !ALLOWED_ATTACHMENT_TYPES.includes(type)) {
      return { ok: false, reason: "type" };
    }
    return { ok: true, type, image: IMAGE_TYPES.includes(type), audio: AUDIO_TYPES.includes(type) };
  }

  function safeAttachmentName(value) {
    const raw = String(value || "file")
      .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, "-")
      .replace(/\s+/g, " ")
      .trim();
    const cleaned = raw.replace(/^\.+/, "").slice(0, 140);
    return cleaned || "file";
  }

  function formatBytes(value) {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function clampMessageText(value) {
    return String(value || "").slice(0, MAX_MESSAGE_LENGTH);
  }

  function defaultIceServers() {
    return [{ urls: [...DEFAULT_STUN] }];
  }

  function mergeIceServers(...lists) {
    const seen = new Set();
    const result = [];
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (!item) continue;
        const urls = Array.isArray(item.urls) ? item.urls : [item.urls];
        const cleanUrls = urls
          .map((url) => String(url || "").trim())
          .filter((url) => /^(stun|turn|turns):/i.test(url));
        if (!cleanUrls.length) continue;
        const key = JSON.stringify({
          urls: cleanUrls,
          username: item.username || "",
          credential: item.credential || "",
        });
        if (seen.has(key)) continue;
        seen.add(key);
        const entry = { urls: cleanUrls };
        if (item.username) entry.username = String(item.username);
        if (item.credential) entry.credential = String(item.credential);
        result.push(entry);
      }
    }
    return result.length ? result : defaultIceServers();
  }

  // Returns a stable quality label from WebRTC inbound stats. A missing or
  // empty sample is intentionally "unknown" rather than pretending the call is
  // healthy.
  function qualityFromSample(sample) {
    if (!sample || typeof sample !== "object") return "unknown";
    const received = Number(sample.packetsReceived || 0);
    const lost = Number(sample.packetsLost || 0);
    const rtt = Number(sample.rtt || 0);
    const jitter = Number(sample.jitter || 0);
    if (!received && !lost) return "unknown";
    const lossRatio = lost / Math.max(1, received + lost);
    if (lossRatio > 0.08 || rtt > 500 || jitter > 0.09) return "poor";
    if (lossRatio > 0.025 || rtt > 260 || jitter > 0.045) return "fair";
    return "good";
  }

  // Perfect-negotiation role. Exactly one side initiates an offer for each
  // pair, regardless of who pressed the call button.
  function shouldInitiate(myId, remoteId) {
    const mine = String(myId || "");
    const theirs = String(remoteId || "");
    if (!mine || !theirs || mine === theirs) return false;
    return mine < theirs;
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function unreadTotal(conversations) {
    if (!Array.isArray(conversations)) return 0;
    return conversations.reduce(
      (sum, item) => sum + Math.max(0, Number(item?.unread_count) || 0),
      0,
    );
  }

  function activeCallForTeam(calls, teamId) {
    if (!Array.isArray(calls)) return null;
    return (
      calls.find(
        (call) =>
          String(call?.team_id) === String(teamId) &&
          String(call?.status || "") !== "ended",
      ) || null
    );
  }

  function callSupport(env) {
    const source = env || {};
    const secure =
      source.secureContext === true ||
      String(source.protocol || "") === "https:" ||
      String(source.hostname || "") === "localhost" ||
      String(source.hostname || "") === "127.0.0.1";
    if (!source.hasRTCPeerConnection) {
      return { supported: false, reason: "webrtc" };
    }
    if (!source.hasMediaDevices) {
      return { supported: false, reason: "media" };
    }
    if (!secure) {
      return { supported: false, reason: "insecure" };
    }
    return { supported: true, reason: "" };
  }

  return {
    MAX_ATTACHMENT_BYTES,
    MAX_MESSAGE_LENGTH,
    MAX_CALL_PARTICIPANTS,
    IMAGE_TYPES,
    FILE_TYPES,
    AUDIO_TYPES,
    ALLOWED_ATTACHMENT_TYPES,
    DEFAULT_STUN,
    normalizeMime,
    isImageType,
    isAudioType,
    validateAttachment,
    safeAttachmentName,
    formatBytes,
    clampMessageText,
    defaultIceServers,
    mergeIceServers,
    qualityFromSample,
    shouldInitiate,
    formatDuration,
    unreadTotal,
    activeCallForTeam,
    callSupport,
  };
});
