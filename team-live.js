/*
 * Study Zone — Team Live.
 *
 * Chat, call orchestration and WebRTC for the Team section. This module is
 * initialized by app.js, which supplies the existing session, Supabase client,
 * team state and UI helpers. It never creates its own Supabase client and never
 * stores secrets.
 *
 * Media never passes through Supabase. Realtime carries SDP/ICE signaling and
 * call status only. TURN credentials are fetched from the `turn-credentials`
 * Edge Function when available; otherwise public STUN is used and the UI says
 * so explicitly.
 */
(function () {
  "use strict";

  const core = window.StudyZoneTeamLiveCore;
  const SIGNED_URL_TTL_MS = 50 * 60 * 1000;
  let deps = null;
  let initialized = false;

  const S = {
    teamId: null,
    sessionUserId: "",
    conversations: [],
    conversationsLoading: false,
    conversationsLoaded: false,
    conversationsSeq: 0,
    conversationsError: "",
    migrationMissing: false,
    activeId: null,
    messages: [],
    messagesLoading: false,
    messagesError: "",
    hasMoreMessages: true,
    loadingOlder: false,
    reads: [],
    reactions: new Map(),
    reactionChannel: null,
    reactionChannelId: null,
    openReactionPickerMessageId: null,
    callInfo: new Map(),
    signed: new Map(),
    signedAt: new Map(),
    convSearch: "",
    search: "",
    draft: "",
    replyTo: null,
    pendingFile: null,
    uploading: false,
    voice: {
      state: "idle", // idle|recording|paused|ready
      recorder: null,
      stream: null,
      chunks: [],
      blob: null,
      url: "",
      startedAt: 0,
      pausedAt: 0,
      pausedTotal: 0,
      timer: 0,
      durationMs: 0,
      mimeType: "",
      error: "",
      previewPlaying: false,
      busy: false,
    },
    chatRenderedFor: null,
    listSignature: "",
    teamChannel: null,
    teamChannelId: null,
    readChannel: null,
    readChannelId: null,
    pollTimer: 0,
    reloadTimer: 0,

    call: null,
    callChatMessages: [],
    callChatRendered: false,
    callChatChannel: null,
    callSheet: null,

    invites: [],
    incomingCallId: null,
    seenInvites: new Set(),
    handledInvites: new Set(),
    missedNotified: new Set(),
    endedCallIds: new Set(),
    endingCallIds: new Set(),
    invitePoll: 0,
    unreadPoll: 0,
    inviteChannel: null,
    inviteCheckBusy: false,
    incomingTimer: 0,
    ringTimer: 0,
    ringContext: null,

    turnConfigured: null,
    turnWarning: "",
    notificationAsked: false,
    pendingTaskId: null,
    pendingConversationId: null,
    pendingDirectUserId: null,
    chatFocus: false,
    destroyed: false,
  };

  // -------------------------------------------------------------------------
  // Small helpers
  // -------------------------------------------------------------------------

  function t(en, ar) {
    return deps ? deps.teamText(en, ar) : en;
  }

  function esc(value) {
    return deps ? deps.escapeHtml(value == null ? "" : String(value)) : String(value == null ? "" : value);
  }

  function sb() {
    return deps ? deps.getSupabase() : null;
  }

  function me() {
    const session = deps ? deps.getSession() : null;
    return session && session.user ? session.user : null;
  }

  function myId() {
    return String(me()?.id || "");
  }

  function lang() {
    return deps ? deps.getLanguage() : "en";
  }

  function locale() {
    return lang() === "ar" ? "ar-EG" : "en";
  }

  function uid() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
    } catch {
      /* ignore */
    }
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function toast(message) {
    if (deps && typeof deps.showToast === "function" && message) {
      deps.showToast(message);
    }
  }

  function notifyError(prefix, error) {
    const message = error && error.message ? error.message : String(error || "");
    console.error(prefix, error);
    toast(`${prefix}${message ? ` ${message}` : ""}`.trim());
  }

  function isMissingRpc(error) {
    if (!error) return false;
    const code = String(error.code || "");
    const message = String(error.message || "");
    return (
      code === "PGRST202" ||
      code === "42883" ||
      code === "42P01" ||
      /could not find the function|function .* does not exist|relation .* does not exist/i.test(message)
    );
  }

  function markCallEnded(callId) {
    const id = String(callId || "");
    if (!id) return;
    S.endedCallIds.add(id);
    S.invites = (S.invites || []).filter((row) => String(row.call_id) !== id);
    if (String(S.incomingCallId || "") === id) setIncomingCall(null);
  }

  function isCallKnownEnded(callId) {
    return S.endedCallIds.has(String(callId || ""));
  }

  function formatTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    try {
      return new Intl.DateTimeFormat(locale(), {
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
    } catch {
      return date.toLocaleTimeString();
    }
  }

  function formatDay(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    if (sameDay) return t("Today", "اليوم");
    const yesterday = new Date(today.getTime() - 86400000);
    if (date.toDateString() === yesterday.toDateString()) {
      return t("Yesterday", "أمس");
    }
    try {
      return new Intl.DateTimeFormat(locale(), {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(date);
    } catch {
      return date.toDateString();
    }
  }

  function shortTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return t("now", "الآن");
    if (diff < 3600000) {
      return t(`${Math.floor(diff / 60000)}m`, `${Math.floor(diff / 60000)} د`);
    }
    if (diff < 86400000) {
      return t(`${Math.floor(diff / 3600000)}h`, `${Math.floor(diff / 3600000)} س`);
    }
    return formatDay(value);
  }

  function teamById(teamId) {
    return (deps ? deps.getTeams() : []).find(
      (team) => String(team.id) === String(teamId),
    ) || null;
  }

  function teamMembersOf(teamId) {
    const rows = (deps ? deps.getTeamMembers() : []).filter(
      (member) => String(member.team_id) === String(teamId),
    );
    const seen = new Set();
    const result = [];
    for (const row of rows) {
      const id = String(row.user_id || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      result.push(id);
    }
    return result;
  }

  function memberName(userId) {
    return deps ? deps.teamMemberName(userId) : String(userId || "");
  }

  function memberAvatar(userId, size = "team-avatar-sm") {
    return deps ? deps.teamAvatar(userId, { size }) : "";
  }

  function conversationTitle(conversation) {
    if (!conversation) return t("Conversation", "محادثة");
    if (conversation.kind === "direct") {
      return memberName(conversation.participant_id);
    }
    if (conversation.kind === "task") {
      return conversation.task_title || conversation.title || t("Task chat", "محادثة المهمة");
    }
    return teamById(conversation.team_id || S.teamId)?.name || t("Team chat", "محادثة الفريق");
  }

  function conversationSubtitle(conversation) {
    if (!conversation) return "";
    if (conversation.kind === "direct") return t("Direct message", "رسالة مباشرة");
    if (conversation.kind === "task") return t("Task discussion", "نقاش المهمة");
    return t("Everyone in this team", "كل أعضاء الفريق");
  }

  function conversationKindLabel(kind) {
    if (kind === "task") return t("Task", "مهمة");
    if (kind === "direct") return t("Direct", "مباشرة");
    return t("Team", "فريق");
  }

  function unreadTotalForTeam() {
    return core ? core.unreadTotal(S.conversations) : 0;
  }

  function normalizeConversationRow(row) {
    if (!row || typeof row !== "object") return row;
    const normalized = { ...row };
    if (!normalized.conversation_id && normalized.id) normalized.conversation_id = normalized.id;
    if (!normalized.id && normalized.conversation_id) normalized.id = normalized.conversation_id;
    const uid = myId();
    if (normalized.kind === "direct" && !normalized.participant_id) {
      if (normalized.participant_a || normalized.participant_b) {
        const a = String(normalized.participant_a || "");
        const b = String(normalized.participant_b || "");
        normalized.participant_id = a && a !== uid ? a : b && b !== uid ? b : a || b || null;
      } else if (normalized.other_user_id || normalized.user_id) {
        const other = String(normalized.other_user_id || normalized.user_id || "");
        if (other && other !== uid) normalized.participant_id = other;
      } else if (normalized.title && /^[0-9a-f-]{36}$/i.test(String(normalized.title))) {
        const maybe = String(normalized.title);
        if (maybe !== uid) normalized.participant_id = maybe;
      }
    }
    return normalized;
  }

  function conversationById(id) {
    const key = String(id || "");
    if (!key) return null;
    return (
      S.conversations.find((row) => String(row.conversation_id || row.id || "") === key) || null
    );
  }

  function activeConversation() {
    return conversationById(S.activeId);
  }

  // -------------------------------------------------------------------------
  // Data access
  // -------------------------------------------------------------------------

  async function rpc(name, args) {
    const client = sb();
    if (!client) throw new Error(t("Supabase is not configured.", "لم يتم إعداد Supabase."));
    const { data, error } = await client.rpc(name, args || {});
    if (error) throw error;
    return data;
  }

  async function loadConversations({ silent = false } = {}) {
    const client = sb();
    const user = me();
    const teamId = S.teamId;
    if (!client || !user || !teamId) return;
    const seq = (S.conversationsSeq = (S.conversationsSeq || 0) + 1);
    S.conversationsLoading = true;
    if (!silent && !S.conversationsLoaded) {
      S.conversationsError = "";
      renderSidebar();
    } else if (S.conversationsError) {
      S.conversationsError = "";
    }
    try {
      const rows = await rpc("team_chat_conversations", { p_team_id: teamId });
      if (seq !== S.conversationsSeq || String(S.teamId) !== String(teamId)) return;
      S.conversations = (Array.isArray(rows) ? rows : []).map(normalizeConversationRow);
      S.migrationMissing = false;
      S.conversationsLoaded = true;
      // Keep active chat open even if the conversation list is temporarily
      // incomplete/mismatched; message loading uses the conversation id directly.
      if (S.activeId && !conversationById(S.activeId)) {
        S.conversations.unshift(
          normalizeConversationRow({
            conversation_id: S.activeId,
            id: S.activeId,
            team_id: teamId,
            kind: S.pendingDirectUserId ? "direct" : "group",
            participant_id: S.pendingDirectUserId || null,
            title: null,
          }),
        );
      }
      updateLiveBadge();
    } catch (error) {
      if (seq !== S.conversationsSeq) return;
      if (isMissingRpc(error)) {
        S.migrationMissing = true;
        S.conversationsError = "";
      } else {
        S.conversationsError = error.message || String(error);
        console.error("Could not load team conversations.", error);
      }
    } finally {
      if (seq === S.conversationsSeq) {
        S.conversationsLoading = false;
        renderSidebar();
        syncChatSurface();
      }
    }
  }

  async function ensureGroupConversation() {
    if (!S.teamId) return null;
    try {
      return await rpc("team_live_ensure_group", { p_team_id: S.teamId });
    } catch (error) {
      if (!isMissingRpc(error)) notifyError(t("Could not open the team chat.", "تعذّر فتح محادثة الفريق."), error);
      return null;
    }
  }

  async function openConversation(id, { scroll = true, focus = true } = {}) {
    if (!id) return;
    if (String(S.activeId || "") !== String(id)) { try { resetVoiceRecording(); } catch {} }
    S.activeId = String(id);
    if (focus) S.chatFocus = true;
    if (!conversationById(S.activeId)) {
      S.conversations.unshift(
        normalizeConversationRow({
          conversation_id: S.activeId,
          id: S.activeId,
          team_id: S.teamId,
          kind: S.pendingDirectUserId ? "direct" : "group",
          participant_id: S.pendingDirectUserId || null,
          title: null,
        }),
      );
    }
    S.chatRenderedFor = null;
    S.search = "";
    S.replyTo = null;
    S.pendingFile = null;
    S.messages = [];
    S.messagesError = "";
    S.hasMoreMessages = true;
    S.loadingOlder = false;
    S.reactions.clear();
    S.openReactionPickerMessageId = null;
    syncChatSurface();
    applyChatFocusState();
    if (scroll) scrollMessages(true);
    await loadMessages(S.activeId);
    await markConversationRead(S.activeId);
    subscribeReadState(S.activeId);
    subscribeReactions(S.activeId);
    const searchInput = document.querySelector('[data-live-input="message-search"]');
    if (searchInput) searchInput.value = "";
  }

  async function loadMessages(conversationId, { silent = false, before = null, appendOlder = false } = {}) {
    const client = sb();
    if (!client || !conversationId) return;
    if (appendOlder) S.loadingOlder = true;
    else S.messagesLoading = true;
    if (!silent && !appendOlder) S.messagesError = "";
    try {
      let query = client
        .from("team_messages")
        .select(
          "id,conversation_id,team_id,sender_id,message_type,body,attachment_path,attachment_name,attachment_type,attachment_size,reply_to_id,call_id,created_at,edited_at,deleted_at,deleted_by",
        )
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(80);
      if (before) query = query.lt("created_at", before);
      const { data, error } = await query;
      if (error) throw error;
      if (String(conversationId) !== String(S.activeId)) return;
      const rows = (data || []).slice().reverse();
      if (appendOlder) {
        const existing = new Set(S.messages.map((m) => String(m.id)));
        const older = rows.filter((m) => !existing.has(String(m.id)));
        S.messages = older.concat(S.messages);
        S.hasMoreMessages = rows.length >= 80;
      } else {
        S.messages = rows;
        S.hasMoreMessages = rows.length >= 80;
      }
      await loadCallInfoForMessages();
      await signAttachments();
      await loadReactionsForMessages(conversationId, rows.map((m) => m.id), { merge: appendOlder });
      renderMessages(appendOlder ? { preserveTop: true } : {});
      if (!appendOlder) scrollMessages(!silent);
    } catch (error) {
      if (isMissingRpc(error)) {
        S.migrationMissing = true;
      } else {
        S.messagesError = error.message || String(error);
        console.error("Could not load team messages.", error);
      }
      renderMessages();
    } finally {
      S.messagesLoading = false;
      S.loadingOlder = false;
    }
  }

  async function loadCallInfoForMessages() {
    const client = sb();
    if (!client) return;
    const ids = [
      ...new Set(
        S.messages
          .map((message) => message.call_id)
          .filter(Boolean)
          .map(String),
      ),
    ];
    if (!ids.length) return;
    try {
      const { data, error } = await client
        .from("team_calls")
        .select("id,status,call_type,scope,ended_reason")
        .in("id", ids);
      if (error) throw error;
      for (const row of data || []) S.callInfo.set(String(row.id), row);
    } catch (error) {
      console.warn("Could not load call status for messages.", error);
    }
  }

  async function signAttachments() {
    const client = sb();
    if (!client) return;
    const paths = [
      ...new Set(
        S.messages
          .map((message) => message.attachment_path)
          .filter(Boolean)
          .filter((path) => {
            const signedAt = S.signedAt.get(path);
            if (!S.signed.has(path)) return true;
            if (!signedAt || Date.now() - signedAt > SIGNED_URL_TTL_MS) {
              S.signed.delete(path);
              S.signedAt.delete(path);
              return true;
            }
            return false;
          }),
      ),
    ];
    if (!paths.length) return;
    try {
      const { data, error } = await client.storage
        .from("team-chat")
        .createSignedUrls(paths, 3600);
      if (error) throw error;
      for (const item of data || []) {
        if (item && item.path && item.signedUrl) {
          S.signed.set(item.path, item.signedUrl);
          S.signedAt.set(item.path, Date.now());
        }
      }
    } catch (error) {
      console.warn("Could not sign team chat attachments.", error);
    }
  }

  async function markConversationRead(conversationId) {
    if (!conversationId) return;
    const last = S.messages[S.messages.length - 1];
    try {
      await rpc("team_chat_mark_read", {
        p_conversation_id: conversationId,
        p_at: new Date().toISOString(),
        p_message_id: last ? last.id : null,
      });
      const row = conversationById(conversationId);
      if (row) row.unread_count = 0;
      updateLiveBadge();
      renderSidebar();
    } catch (error) {
      if (!isMissingRpc(error)) console.warn("Could not mark the conversation read.", error);
    }
  }

  // -------------------------------------------------------------------------
  // Reactions
  // -------------------------------------------------------------------------
  const REACTION_EMOJIS = ["❤️", "😂", "😍", "👍", "👎", "😢", "🔥", "🎉", "🙏", "😮"];

  function normalizeReactionRow(row) {
    if (!row) return null;
    return {
      id: row.id ? String(row.id) : "",
      message_id: String(row.message_id || ""),
      conversation_id: String(row.conversation_id || ""),
      user_id: String(row.user_id || ""),
      emoji: String(row.emoji || ""),
      created_at: row.created_at || null,
    };
  }

  function setReactionsForMessages(messageIds, rows, { replace = true } = {}) {
    const ids = new Set((messageIds || []).map((id) => String(id)));
    if (replace) {
      for (const id of ids) S.reactions.set(id, []);
    }
    for (const raw of rows || []) {
      const row = normalizeReactionRow(raw);
      if (!row || !row.message_id || !row.emoji || !row.user_id) continue;
      if (ids.size && !ids.has(row.message_id)) continue;
      const list = S.reactions.get(row.message_id) || [];
      const exists = list.some(
        (item) => item.user_id === row.user_id && item.emoji === row.emoji,
      );
      if (!exists) list.push(row);
      S.reactions.set(row.message_id, list);
    }
  }

  async function loadReactionsForMessages(conversationId, messageIds, { merge = false } = {}) {
    const client = sb();
    if (!client || !conversationId) return;
    const ids = [...new Set((messageIds || []).filter(Boolean).map(String))];
    if (!ids.length) {
      if (!merge) S.reactions.clear();
      return;
    }
    try {
      const { data, error } = await client
        .from("team_message_reactions")
        .select("id,message_id,conversation_id,user_id,emoji,created_at")
        .eq("conversation_id", conversationId)
        .in("message_id", ids);
      if (error) throw error;
      setReactionsForMessages(ids, data || [], { replace: !merge });
    } catch (error) {
      // Table/migration may not be applied yet; keep chat functional.
      if (!isMissingRpc(error)) console.warn("Could not load reactions.", error);
    }
  }

  function reactionSummary(messageId) {
    const rows = S.reactions.get(String(messageId)) || [];
    const byEmoji = new Map();
    for (const row of rows) {
      const key = row.emoji;
      if (!key) continue;
      if (!byEmoji.has(key)) byEmoji.set(key, { emoji: key, users: [] });
      byEmoji.get(key).users.push(row.user_id);
    }
    return [...byEmoji.values()].sort((a, b) => b.users.length - a.users.length || a.emoji.localeCompare(b.emoji));
  }

  async function toggleReaction(messageId, emoji) {
    const client = sb();
    const user = me();
    const conversationId = S.activeId;
    if (!client || !user || !conversationId || !messageId || !emoji) return;
    const id = String(messageId);
    const rows = S.reactions.get(id) || [];
    const mine = rows.find((row) => row.user_id === String(user.id) && row.emoji === emoji);
    try {
      if (mine) {
        const { error } = await client
          .from("team_message_reactions")
          .delete()
          .eq("message_id", id)
          .eq("user_id", user.id)
          .eq("emoji", emoji);
        if (error) throw error;
        S.reactions.set(
          id,
          rows.filter((row) => !(row.user_id === String(user.id) && row.emoji === emoji)),
        );
      } else {
        const { data, error } = await client
          .from("team_message_reactions")
          .insert({
            message_id: id,
            conversation_id: conversationId,
            user_id: user.id,
            emoji,
          })
          .select("id,message_id,conversation_id,user_id,emoji,created_at")
          .single();
        if (error) throw error;
        const next = rows.slice();
        const normalized = normalizeReactionRow(data);
        if (normalized && !next.some((r) => r.user_id === normalized.user_id && r.emoji === normalized.emoji)) {
          next.push(normalized);
        }
        S.reactions.set(id, next);
      }
      S.openReactionPickerMessageId = null;
      renderMessages();
    } catch (error) {
      notifyError(t("Could not update reaction.", "تعذّر تحديث التفاعل."), error);
    }
  }

  function handleReactionRealtime(payload) {
    const row = normalizeReactionRow(payload?.new || payload?.old);
    if (!row || !row.message_id) return;
    if (S.activeId && row.conversation_id && String(row.conversation_id) !== String(S.activeId)) return;
    const list = (S.reactions.get(row.message_id) || []).slice();
    if (payload.eventType === "DELETE") {
      S.reactions.set(
        row.message_id,
        list.filter((item) => !(item.user_id === row.user_id && item.emoji === row.emoji)),
      );
    } else {
      if (!list.some((item) => item.user_id === row.user_id && item.emoji === row.emoji)) list.push(row);
      S.reactions.set(row.message_id, list);
    }
    // Re-render only if messages for this conversation are shown.
    if (S.messages.some((m) => String(m.id) === row.message_id)) renderMessages();
  }

  function subscribeReactions(conversationId) {
    const client = sb();
    if (!client || !conversationId) return;
    if (S.reactionChannel && String(S.reactionChannelId) === String(conversationId)) return;
    teardownReactionChannel();
    S.reactionChannelId = String(conversationId);
    try {
      S.reactionChannel = client
        .channel(`team-live-reactions-${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "team_message_reactions",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => handleReactionRealtime(payload),
        )
        .subscribe();
    } catch (error) {
      console.warn("Could not subscribe to reactions.", error);
    }
  }

  function teardownReactionChannel() {
    const client = sb();
    if (S.reactionChannel && client) {
      try {
        client.removeChannel(S.reactionChannel);
      } catch {
        /* ignore */
      }
    }
    S.reactionChannel = null;
    S.reactionChannelId = null;
  }

  function memberAvatarSmall(userId) {
    try {
      if (deps && typeof deps.teamAvatar === "function") {
        return deps.teamAvatar(userId, { size: "team-avatar-xxs live-reaction-avatar-el" });
      }
    } catch {
      /* ignore */
    }
    const name = memberName(userId) || "?";
    const initial = esc(String(name).trim().charAt(0).toUpperCase() || "?");
    return `<span class="live-reaction-avatar initial">${initial}</span>`;
  }

  function reactionPickerMarkup(messageId) {
    const open = String(S.openReactionPickerMessageId || "") === String(messageId);
    if (!open) return "";
    const buttons = REACTION_EMOJIS.map(
      (emoji) =>
        `<button type="button" class="live-reaction-emoji-btn" data-live-action="toggle-reaction" data-message-id="${esc(messageId)}" data-emoji="${esc(emoji)}" aria-label="${esc(emoji)}">${esc(emoji)}</button>`,
    ).join("");
    return `<div class="live-reaction-picker" role="dialog" aria-label="${esc(t("Add reaction", "إضافة تفاعل"))}">${buttons}</div>`;
  }

  function messageReactionsMarkup(messageId) {
    const summary = reactionSummary(messageId);
    const picker = reactionPickerMarkup(messageId);
    const chips = summary
      .map((item) => {
        const mine = item.users.includes(myId());
        const avatars = item.users
          .slice(0, 3)
          .map((uid) => memberAvatarSmall(uid))
          .join("");
        return `<button type="button" class="live-reaction-chip ${mine ? "mine" : ""}" data-live-action="toggle-reaction" data-message-id="${esc(messageId)}" data-emoji="${esc(item.emoji)}" title="${esc(String(item.users.length))}">
          <span class="live-reaction-emoji">${esc(item.emoji)}</span>
          <span class="live-reaction-count">${item.users.length}</span>
          <span class="live-reaction-avatars" aria-hidden="true">${avatars}</span>
        </button>`;
      })
      .join("");
    if (!chips && !picker) return "";
    return `<div class="live-reactions-row">${chips}${picker}</div>`;
  }

  async function loadReads(conversationId) {
    const client = sb();
    if (!client || !conversationId) return;
    try {
      const { data, error } = await client
        .from("team_conversation_reads")
        .select("user_id,last_read_at")
        .eq("conversation_id", conversationId);
      if (error) throw error;
      if (String(conversationId) !== String(S.activeId)) return;
      S.reads = data || [];
      renderMessages();
    } catch (error) {
      console.warn("Could not load read receipts.", error);
    }
  }

  // -------------------------------------------------------------------------
  // Realtime for the open team
  // -------------------------------------------------------------------------

  function ensureTeamChannel() {
    const client = sb();
    if (!client || !S.teamId) return;
    if (S.teamChannel && String(S.teamChannelId) === String(S.teamId)) return;
    teardownTeamChannel();
    S.teamChannelId = S.teamId;
    try {
      const channel = client
        .channel(`team-live-team-${S.teamId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "team_messages",
            filter: `team_id=eq.${S.teamId}`,
          },
          (payload) => handleMessageRealtime(payload),
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "team_conversations",
            filter: `team_id=eq.${S.teamId}`,
          },
          () => scheduleConversationReload(),
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("Team live realtime channel unavailable; polling instead.");
          }
        });
      S.teamChannel = channel;
    } catch (error) {
      console.warn("Could not subscribe to team live changes.", error);
    }
    startConversationPolling();
  }

  function teardownTeamChannel() {
    const client = sb();
    if (S.teamChannel && client) {
      try {
        client.removeChannel(S.teamChannel);
      } catch {
        /* ignore */
      }
    }
    S.teamChannel = null;
    S.teamChannelId = null;
    if (S.pollTimer) {
      window.clearInterval(S.pollTimer);
      S.pollTimer = 0;
    }
  }

  function startConversationPolling() {
    if (S.pollTimer) return;
    S.pollTimer = window.setInterval(() => {
      if (document.hidden || !me() || !S.teamId) return;
      void loadConversations({ silent: true });
      if (S.activeId) void loadMessages(S.activeId, { silent: true });
    }, 12000);
  }

  function scheduleConversationReload() {
    if (S.reloadTimer) return;
    S.reloadTimer = window.setTimeout(() => {
      S.reloadTimer = 0;
      void loadConversations({ silent: true });
    }, 350);
  }

  function handleMessageRealtime(payload) {
    const row = payload?.new;
    if (!row || !row.id) return;
    if (row.conversation_id && String(row.conversation_id) === String(S.activeId)) {
      if (payload.eventType === "UPDATE") {
        const index = S.messages.findIndex((message) => String(message.id) === String(row.id));
        if (index >= 0) S.messages[index] = { ...S.messages[index], ...row };
      } else {
        upsertMessage(row);
        if (row.attachment_path) {
          void signAttachments().then(() => renderMessages());
        }
      }
      if (payload.eventType === "INSERT" && String(row.sender_id) !== myId() && !document.hidden) {
        void markConversationRead(S.activeId);
      }
      void loadCallInfoForMessages().then(() => renderMessages());
    }
    scheduleConversationReload();
    if (S.call && String(S.call.conversation_id) === String(row.conversation_id)) {
      upsertCallChatMessage(row);
    }
  }

  function subscribeReadState(conversationId) {
    const client = sb();
    if (!client || !conversationId) return;
    if (S.readChannel && String(S.readChannelId) === String(conversationId)) {
      void loadReads(conversationId);
      return;
    }
    teardownReadChannel();
    S.readChannelId = conversationId;
    try {
      S.readChannel = client
        .channel(`team-live-reads-${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "team_conversation_reads",
            filter: `conversation_id=eq.${conversationId}`,
          },
          () => void loadReads(conversationId),
        )
        .subscribe();
    } catch (error) {
      console.warn("Could not subscribe to read receipts.", error);
    }
    void loadReads(conversationId);
  }

  function teardownReadChannel() {
    const client = sb();
    if (S.readChannel && client) {
      try {
        client.removeChannel(S.readChannel);
      } catch {
        /* ignore */
      }
    }
    S.readChannel = null;
    S.readChannelId = null;
  }

  function upsertMessage(row) {
    if (!row || !row.id) return;
    const index = S.messages.findIndex((message) => String(message.id) === String(row.id));
    if (index >= 0) {
      S.messages[index] = { ...S.messages[index], ...row };
    } else {
      S.messages.push(row);
      S.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }
    renderMessages();
  }

  // -------------------------------------------------------------------------
  // Page markup
  // -------------------------------------------------------------------------

  function teamSwitcherMarkup() {
    const teams = deps.getTeams();
    if (!teams.length) return "";
    return `<div class="live-team-switcher" role="tablist" aria-label="${esc(t("Your teams", "فرقك"))}">${teams
      .map(
        (team) =>
          `<button type="button" class="live-team-chip ${String(team.id) === String(S.teamId) ? "selected" : ""}" data-live-action="switch-team" data-team-id="${esc(team.id)}" role="tab" aria-selected="${String(team.id) === String(S.teamId)}">${esc(team.name)}</button>`,
      )
      .join("")}</div>`;
  }

  function applyChatFocusState() {
    const shell = document.querySelector("[data-live-shell]");
    if (!shell) return;
    const focused = Boolean(S.chatFocus && S.activeId);
    shell.classList.toggle("chat-focus", focused);
    const page = shell.closest(".live-page");
    if (page) page.classList.toggle("chat-focus-mode", focused);
    document.documentElement.classList.toggle("team-live-chat-focus", focused);
    document.body.classList.toggle("team-live-chat-focus", focused);
  }

  function focusChatView() {
    S.chatFocus = true;
    applyChatFocusState();
  }

  function closeChatView() {
    try { resetVoiceRecording(); } catch {}
    S.chatFocus = false;
    S.activeId = null;
    S.chatRenderedFor = null;
    S.pendingDirectUserId = null;
    S.messages = [];
    S.messagesError = "";
    S.reactions.clear();
    S.openReactionPickerMessageId = null;
    teardownReadChannel();
    teardownReactionChannel();
    renderSidebar();
    syncChatSurface();
    applyChatFocusState();
  }

  function renderPage() {
    const user = me();
    const heading = `<div class="live-page-head">
      <div>
        <p class="eyebrow">${esc(t("TEAM LIVE", "الفريق مباشر"))}</p>
        <h1>${esc(t("Chat & live calls", "المحادثة والمكالمات المباشرة"))}</h1>
        <p class="panel-copy">${esc(
          t(
            "Direct and team conversations, task discussions, audio and video calls. Media travels peer to peer; Supabase only carries messages and call signaling.",
            "محادثات مباشرة وللفريق ونقاشات المهام ومكالمات صوتية ومرئية. الوسائط تنتقل مباشرة بين الأجهزة، وSupabase ينقل الرسائل وإشارات المكالمة فقط.",
          ),
        )}</p>
      </div>
      <div class="live-page-actions">
        <button type="button" class="button button-secondary button-small" data-live-action="refresh-live">${esc(t("Refresh", "تحديث"))}</button>
        <button type="button" class="button button-secondary button-small" data-live-action="enable-notifications">${esc(t("Notifications", "الإشعارات"))}</button>
        <button type="button" class="button button-secondary button-small" data-live-action="test-devices">${esc(t("Test mic & camera", "اختبار الميكروفون والكاميرا"))}</button>
        <button type="button" class="button button-primary button-small" data-live-action="open-group-call-sheet">${esc(t("Group call", "مكالمة جماعية"))}</button>
      </div>
    </div>`;

    if (!user) {
      return `<section class="panel live-page">${heading}
        <div class="empty-state"><strong>${esc(t("Sign in to use team chat", "سجّل الدخول لاستخدام محادثة الفريق"))}</strong>
        <p>${esc(t("Team chat and calls are private to your team members.", "محادثة الفريق والمكالمات خاصة بأعضاء فريقك."))}</p>
        <button type="button" class="button button-primary button-small" id="open-auth">${esc(t("Sign in", "تسجيل الدخول"))}</button></div>
      </section>`;
    }

    if (!deps.getTeams().length) {
      return `<section class="panel live-page">${heading}
        <div class="empty-state"><strong>${esc(t("Create or join a team first", "أنشئ فريقًا أو انضم إليه أولًا"))}</strong>
        <p>${esc(t("Team chat and calls live inside a team. Open Teams to create one.", "محادثة الفريق والمكالمات تعمل داخل الفريق. افتح صفحة الفرق لإنشاء فريق."))}</p>
        <a class="button button-primary button-small" href="#teams">${esc(t("Open Teams", "فتح الفرق"))}</a></div>
      </section>`;
    }

    return `<section class="panel live-page ${S.chatFocus && S.activeId ? "chat-focus-mode" : ""}">
      ${heading}
      ${teamSwitcherMarkup()}
      <div class="live-shell ${S.chatFocus && S.activeId ? "chat-focus" : ""}" data-live-shell>
        <aside class="live-sidebar" aria-label="${esc(t("Conversations", "المحادثات"))}">
          <label class="live-search">
            <span aria-hidden="true">⌕</span>
            <input type="search" data-live-input="conversation-search" value="${esc(S.convSearch)}" placeholder="${esc(t("Search people and chats", "ابحث عن أشخاص ومحادثات"))}" autocomplete="off" />
          </label>
          <div class="live-sidebar-list" data-live-list></div>
        </aside>
        <section class="live-chat" data-live-chat aria-live="polite"></section>
      </div>
      <p class="data-caption live-caption">${esc(
        t(
          "Calls use WebRTC. Up to 8 people can join; 4 simultaneous cameras is the practical mesh limit. TURN is required for strict NAT and some mobile networks.",
          "تستخدم المكالمات WebRTC. حتى 8 أشخاص؛ والحد العملي لشبكة متكاملة هو 4 كاميرات متزامنة. يلزم TURN لشبكات NAT الصارمة وبعض شبكات الهاتف.",
        ),
      )}</p>
    </section>`;
  }

  function renderSidebar() {
    const host = document.querySelector("[data-live-list]");
    if (!host) return;
    host.innerHTML = sidebarMarkup();
    const nav = document.getElementById("team-live-count");
    if (nav) {
      const total = unreadTotalForTeam();
      nav.textContent = total > 99 ? "99+" : String(total);
      nav.hidden = total <= 0;
    }
  }

  function sidebarMarkup() {
    if (S.migrationMissing) {
      return `<div class="live-notice"><strong>${esc(t("Team Live database upgrade required", "يلزم تحديث قاعدة بيانات الفريق مباشر"))}</strong><p>${esc(
        t(
          "Apply supabase/migrations/006_team_live_communication.sql in Supabase. Existing teams and tasks are untouched.",
          "طبّق supabase/migrations/006_team_live_communication.sql في Supabase. الفرق والمهام الحالية لن تتأثر.",
        ),
      )}</p></div>`;
    }
    if (S.conversationsLoading && !S.conversationsLoaded && !S.conversations.length) {
      return `<p class="live-loading" role="status">${esc(t("Loading conversations…", "جارٍ تحميل المحادثات…"))}</p>`;
    }
    if (S.conversationsError && !S.conversations.length) {
      return `<div class="live-notice error"><strong>${esc(t("Could not load chat", "تعذّر تحميل المحادثة"))}</strong><p>${esc(S.conversationsError)}</p><button type="button" class="button button-secondary button-small" data-live-action="refresh-live">${esc(t("Try again", "إعادة المحاولة"))}</button></div>`;
    }

    const query = S.convSearch.trim().toLowerCase();
    const matches = (row) =>
      !query || conversationTitle(row).toLowerCase().includes(query);
    const groups = S.conversations.filter((row) => row.kind === "group" && matches(row));
    const tasks = S.conversations.filter((row) => row.kind === "task" && matches(row));
    const directs = S.conversations.filter((row) => row.kind === "direct" && matches(row));

    const directIds = new Set(directs.map((row) => String(row.participant_id)));
    const teammates = teamMembersOf(S.teamId).filter(
      (id) => id !== myId() && !directIds.has(id) && (!query || memberName(id).toLowerCase().includes(query)),
    );

    const section = (label, rows) =>
      rows.length
        ? `<div class="live-section-label">${esc(label)}</div>${rows.map(conversationRowMarkup).join("")}`
        : "";

    const teammateSection = teammates.length
      ? `<div class="live-section-label">${esc(t("Start a direct chat", "ابدأ محادثة مباشرة"))}</div>${teammates
          .map(
            (id) => `<button type="button" class="live-conv-row live-conv-person" data-live-action="open-direct" data-user-id="${esc(id)}">
              ${memberAvatar(id)}
              <span class="live-conv-copy"><strong dir="auto">${esc(memberName(id))}</strong><small>${esc(t("Direct message", "رسالة مباشرة"))}</small></span>
              <span class="live-conv-icon" aria-hidden="true">＋</span>
            </button>`,
          )
          .join("")}`
      : "";

    const body = `${section(t("Team", "الفريق"), groups)}${section(t("Task chats", "محادثات المهام"), tasks)}${section(t("Direct messages", "الرسائل المباشرة"), directs)}${teammateSection}`;

    if (!body) {
      return `<div class="live-empty-list"><p>${esc(t("No conversations match.", "لا توجد محادثات مطابقة."))}</p><button type="button" class="button button-secondary button-small" data-live-action="open-group-chat">${esc(t("Open team chat", "فتح محادثة الفريق"))}</button></div>`;
    }
    return body;
  }

  function conversationRowMarkup(row) {
    const unread = Math.max(0, Number(row.unread_count) || 0);
    const preview = row.last_message_type === "call"
      ? t("Call", "مكالمة")
      : row.last_message_type === "image"
        ? t("Photo", "صورة")
        : row.last_message_type === "file"
          ? t("File", "ملف")
          : row.last_message_body || t("No messages yet", "لا رسائل بعد");
    return `<button type="button" class="live-conv-row ${String(row.conversation_id) === String(S.activeId) ? "active" : ""}" data-live-action="open-conversation" data-conversation-id="${esc(row.conversation_id)}">
      <span class="live-conv-avatar">${
        row.kind === "direct"
          ? memberAvatar(row.participant_id)
          : `<span class="live-conv-badge">${row.kind === "task" ? "✓" : "#"}</span>`
      }</span>
      <span class="live-conv-copy">
        <strong dir="auto">${esc(conversationTitle(row))}</strong>
        <small dir="auto">${esc(String(preview).slice(0, 80))}</small>
      </span>
      <span class="live-conv-meta">
        <time>${esc(shortTime(row.last_message_at || row.updated_at || row.created_at))}</time>
        ${unread ? `<span class="live-unread">${unread > 99 ? "99+" : unread}</span>` : ""}
      </span>
    </button>`;
  }

  function syncChatSurface() {
    const host = document.querySelector("[data-live-chat]");
    if (!host) return;
    const key = S.activeId || "";
    if (host.dataset.liveFor === key && host.childElementCount) {
      return;
    }
    host.innerHTML = chatPanelMarkup();
    host.dataset.liveFor = key;
    S.chatRenderedFor = key;
    if (S.activeId) {
      renderMessages();
      scrollMessages(true);
    }
  }

  function chatPanelMarkup() {
    const conversation =
      activeConversation() ||
      (S.activeId
        ? normalizeConversationRow({
            conversation_id: S.activeId,
            id: S.activeId,
            team_id: S.teamId,
            kind: S.pendingDirectUserId ? "direct" : "group",
            participant_id: S.pendingDirectUserId || null,
            title: null,
          })
        : null);
    if (!S.activeId) {
      return `<div class="live-chat-empty">
        ${S.conversations.length || !S.conversationsLoaded ? "" : ""}
        <div class="live-chat-empty-icon" aria-hidden="true">💬</div>
        <h2>${esc(t("Pick a conversation", "اختر محادثة"))}</h2>
        <p>${esc(t("Open the team chat, a task discussion, or message a teammate directly.", "افتح محادثة الفريق أو نقاش مهمة أو راسل زميلًا مباشرة."))}</p>
        <div class="live-chat-empty-actions">
          <button type="button" class="button button-primary button-small" data-live-action="open-group-chat">${esc(t("Team chat", "محادثة الفريق"))}</button>
          <button type="button" class="button button-secondary button-small" data-live-action="open-group-call-sheet">${esc(t("Start a call", "بدء مكالمة"))}</button>
        </div>
      </div>`;
    }
    const isGroup = conversation.kind !== "direct";
    const task = conversation.task_id
      ? (deps.getTeamTasks ? deps.getTeamTasks() : []).find(
          (item) => String(item.id) === String(conversation.task_id),
        )
      : null;
    const members = teamMembersOf(S.teamId).length;
    return `<header class="live-chat-head">
      <button type="button" class="live-icon-button live-chat-back" data-live-action="back-to-list" title="${esc(t("Back to team members", "الرجوع إلى أعضاء الفريق"))}" aria-label="${esc(t("Back to team members", "الرجوع إلى قائمة أعضاء الفريق"))}">
        <span class="live-back-icon" aria-hidden="true"></span>
      </button>
      <div class="live-chat-person">
        ${
          conversation.kind === "direct"
            ? memberAvatar(conversation.participant_id, "team-avatar")
            : `<span class="live-chat-badge">${conversation.kind === "task" ? "✓" : "#"}</span>`
        }
        <div>
          <h2 dir="auto">${esc(conversationTitle(conversation))}</h2>
          <small dir="auto">${esc(
            conversation.kind === "direct"
              ? conversationSubtitle(conversation)
              : conversation.kind === "task"
                ? `${conversationSubtitle(conversation)}${task ? ` · ${task.status === "completed" ? t("Completed", "مكتملة") : t("Open", "مفتوحة")}` : ""}`
                : t(`${members} members`, `${members} أعضاء`),
          )}</small>
        </div>
      </div>
      <div class="live-chat-actions">
        <button type="button" class="live-icon-button" data-live-action="call-here" data-call-type="audio" title="${esc(t("Audio call", "مكالمة صوتية"))}" aria-label="${esc(t("Audio call", "مكالمة صوتية"))}">☎</button>
        <button type="button" class="live-icon-button" data-live-action="call-here" data-call-type="video" title="${esc(t("Video call", "مكالمة مرئية"))}" aria-label="${esc(t("Video call", "مكالمة مرئية"))}">▣</button>
        ${isGroup ? `<button type="button" class="live-icon-button" data-live-action="open-call-sheet-here" title="${esc(t("Call options", "خيارات المكالمة"))}" aria-label="${esc(t("Call options", "خيارات المكالمة"))}">⋯</button>` : ""}
      </div>
    </header>
    <div class="live-chat-toolbar">
      <label class="live-search live-search-chat">
        <span aria-hidden="true">⌕</span>
        <input type="search" data-live-input="message-search" value="${esc(S.search)}" placeholder="${esc(t("Search in this chat", "ابحث في هذه المحادثة"))}" autocomplete="off" />
      </label>
      ${S.search ? `<button type="button" class="button button-quiet button-small" data-live-action="clear-message-search">${esc(t("Clear", "مسح"))}</button>` : ""}
      <button type="button" class="live-icon-button live-icon-button-small" data-live-action="reload-messages" title="${esc(t("Reload messages", "إعادة تحميل الرسائل"))}" aria-label="${esc(t("Reload messages", "إعادة تحميل الرسائل"))}">↻</button>
    </div>
    <div class="live-messages" data-live-messages role="log" aria-live="polite"></div>
    <div data-live-composer>${composerMarkup()}</div>`;
  }

  function composerMarkup() {
    const reply = S.replyTo;
    const v = S.voice || {};
    const state = v.state || "idle";
    const showVoice = state !== "idle";
    return `<form class="live-composer" data-live-form="composer">
      ${reply ? `<div class="live-reply-banner">
              <div><small>${esc(t("Replying to", "ردًا على"))} ${esc(memberName(reply.sender_id))}</small><p dir="auto">${esc(String(reply.body || "").slice(0, 120) || t("Attachment", "مرفق"))}</p></div>
              <button type="button" class="live-icon-button live-icon-button-small" data-live-action="cancel-reply" aria-label="${esc(t("Cancel reply", "إلغاء الرد"))}">✕</button>
            </div>` : ""}
      ${S.pendingFile ? `<div class="live-attachment-chip">
              <span>${esc(S.pendingFile.name)} • ${esc(core ? core.formatBytes(S.pendingFile.size) : "")}</span>
              <small>${esc(S.pendingFile.type && S.pendingFile.type.startsWith("image/") ? t("Photo", "صورة") : t("File", "ملف"))}</small>
              <button type="button" class="live-icon-button live-icon-button-small" data-live-action="clear-attachment" aria-label="${esc(t("Remove attachment", "إزالة المرفق"))}">✕</button>
            </div>` : ""}
      ${showVoice ? `<div class="live-voice-recorder" data-live-voice-wrap data-state="${esc(state)}" role="status" aria-live="polite">
        <div class="live-voice-recorder-top">
          <div class="live-voice-visual voice-record-visual" data-state="${esc(state)}" aria-hidden="true"><span class="voice-record-pulse"></span><span class="voice-record-core"></span><span class="voice-record-wave"></span></div>
          <div class="live-voice-meta">
            <strong data-live-voice-timer>${esc(formatVoiceClock(state === "ready" ? (v.durationMs || 0) : voiceElapsedMs()))}</strong>
            <small data-live-voice-status>${esc(state === "recording" ? t("Recording...", "جاري التسجيل...") : state === "paused" ? t("Paused", "متوقف مؤقتًا") : state === "ready" ? t("Preview before sending", "معاينة قبل الإرسال") : (v.error || ""))}</small>
          </div>
        </div>
        <div class="live-voice-preview-shell" data-live-voice-preview-shell ${state === "ready" && v.url ? "" : "hidden"}>
          <audio data-live-voice-preview controls preload="metadata"${v.url ? ` src="${esc(v.url)}"` : ""}></audio>
        </div>
        <p class="live-voice-error" data-live-voice-error ${v.error ? "" : "hidden"}>${esc(v.error || "")}</p>
        ${state === "recording" || state === "paused" ? `<p class="live-voice-hint">${esc(t("Recording from your microphone. Stop to preview before sending.", "يتم التسجيل من الميكروفون. أوقف التسجيل للمعاينة قبل الإرسال."))}</p>` : state === "ready" ? `<p class="live-voice-hint">${esc(t("Listen to the preview, then send or delete to re-record.", "استمع للمعاينة ثم أرسل أو احذف لإعادة التسجيل."))}</p>` : ""}
        <div class="live-voice-controls">
          <button type="button" class="button button-secondary button-small" data-live-action="voice-pause" ${state === "recording" || state === "paused" ? "" : "hidden"}>${state === "paused" ? esc(t("Resume", "استكمال")) : esc(t("Pause", "إيقاف مؤقت"))}</button>
          <button type="button" class="button button-secondary button-small" data-live-action="voice-stop" ${state === "recording" || state === "paused" ? "" : "hidden"}>${esc(t("Stop", "إيقاف"))}</button>
          <button type="button" class="button button-ghost button-small" data-live-action="voice-preview-toggle" ${state === "ready" ? "" : "hidden"}>${esc(t("Preview", "معاينة"))}</button>
          <button type="button" class="button button-ghost button-small" data-live-action="voice-discard" ${state === "ready" ? "" : "hidden"}>${esc(t("Delete", "حذف"))}</button>
          <button type="button" class="button button-ghost button-small" data-live-action="voice-cancel" ${state === "recording" || state === "paused" ? "" : "hidden"}>${esc(t("Cancel", "إلغاء"))}</button>
          <button type="button" class="button button-primary button-small" data-live-action="voice-send" ${state === "ready" ? "" : "hidden"}>${S.uploading ? esc(t("Sending...", "جارٍ الإرسال...")) : esc(t("Send voice", "إرسال الصوت"))}</button>
        </div>
      </div>` : ""}
      <div class="live-composer-row"${showVoice ? ' hidden' : ''}>
        <button type="button" class="live-icon-button" data-live-action="pick-attachment" title="${esc(t("Attach a photo or file", "إرفاق صورة أو ملف"))}" aria-label="${esc(t("Attach a photo or file", "إرفاق صورة أو ملف"))}">📎</button>
        <button type="button" class="live-icon-button" data-live-action="voice-start" title="${esc(t("Record voice message", "تسجيل رسالة صوتية"))}" aria-label="${esc(t("Record voice message", "تسجيل رسالة صوتية"))}">🎙</button>
        <textarea name="body" rows="1" maxlength="${core ? core.MAX_MESSAGE_LENGTH : 4000}" data-live-input="draft" placeholder="${esc(t("Write a message…", "اكتب رسالة…"))}" autocomplete="off">${esc(S.draft)}</textarea>
        <button type="submit" class="button button-primary button-small live-send" ${S.uploading ? "disabled" : ""}>${S.uploading ? esc(t("Sending…", "جارٍ الإرسال…")) : esc(t("Send", "إرسال"))}</button>
      </div>
      <input type="file" data-live-input="attachment" accept="${esc(core ? core.ALLOWED_ATTACHMENT_TYPES.join(",") : "image/*")}" hidden />
      <p class="live-composer-hint">${esc(t("Enter sends • Shift+Enter adds a line • up to 20 MB", "Enter للإرسال • Shift+Enter لسطر جديد • حتى 20 MB"))}</p>
    </form>`;
  }
  function refreshComposer() {
    const host = document.querySelector("[data-live-composer]");
    if (!host) return;
    host.innerHTML = composerMarkup();
    const textarea = host.querySelector('[data-live-input="draft"]');
    if (textarea) {
      textarea.value = S.draft;
      autoGrow(textarea);
      textarea.focus();
    }
  }

  function descriptionJson(description) {
    if (!description) return null;
    return { type: description.type, sdp: description.sdp };
  }

  function candidateJson(candidate) {
    if (!candidate) return null;
    return {
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
      usernameFragment: candidate.usernameFragment,
    };
  }

  function autoGrow(textarea) {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(140, textarea.scrollHeight)}px`;
  }

  function messageById(id) {
    return S.messages.find((message) => String(message.id) === String(id)) || null;
  }

  function filteredMessages() {
    const query = S.search.trim().toLowerCase();
    if (!query) return S.messages;
    return S.messages.filter((message) => {
      const haystack = `${message.body || ""} ${message.attachment_name || ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  function readStateFor(message) {
    if (!message || String(message.sender_id) !== myId()) return { text: "", state: "", label: "" };
    const others = S.reads.filter((row) => String(row.user_id) !== myId());
    if (!others.length) return { text: "✓", state: "sent", label: t("Sent", "أُرسلت") };
    const readBy = others.filter(
      (row) => new Date(row.last_read_at).getTime() >= new Date(message.created_at).getTime(),
    ).length;
    if (!readBy) return { text: "✓✓", state: "delivered", label: t("Delivered to chat", "تم التسليم") };
    const conversation = activeConversation();
    if (conversation?.kind === "direct") return { text: "✓✓", state: "read", label: t("Read", "قُرئت") };
    return { text: "✓✓", state: "read", label: t(`Read by ${readBy}`, `قرأها ${readBy}`) };
  }

  function initLiveAudioPlayers(root = document) {
    const scope = root && root.querySelectorAll ? root : document;
    const fmt = (sec) => { const total = Math.max(0, Math.floor(Number(sec) || 0)); const m = Math.floor(total / 60), ss = total % 60; return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0'); };
    scope.querySelectorAll('.sz-audio-player').forEach((player) => {
      if (player.dataset.liveEnhanced === '1') return;
      const audio = player.querySelector('audio');
      const toggle = player.querySelector('[data-audio-action="toggle"]');
      const wave = player.querySelector('.sz-audio-wave');
      const progress = player.querySelector('.sz-audio-wave-progress');
      const cur = player.querySelector('[data-audio-current]');
      const tot = player.querySelector('[data-audio-total]');
      if (!audio || !toggle || !wave) return;
      player.dataset.liveEnhanced = '1';
      const setProgress = () => {
        const dur = isFinite(audio.duration) ? audio.duration : 0;
        const pct = dur ? Math.min(100, (audio.currentTime / dur) * 100) : 0;
        if (progress) progress.style.width = pct + '%';
        wave.style.setProperty('--progress', pct + '%');
        if (cur) cur.textContent = fmt(audio.currentTime);
        if (tot) tot.textContent = fmt(dur || Number(player.dataset.duration || 0));
      };
      const setPlaying = (playing) => { player.classList.toggle('is-playing', playing); toggle.textContent = playing ? '❚❚' : '▶'; toggle.setAttribute('aria-label', playing ? 'Pause' : 'Play'); };
      toggle.addEventListener('click', () => {
        if (audio.paused) {
          document.querySelectorAll('.sz-audio-player audio').forEach((a) => { if (a !== audio) { try { a.pause(); } catch {} } });
          void audio.play().catch(() => {});
        } else { audio.pause(); }
      });
      audio.addEventListener('play', () => { document.querySelectorAll('.sz-audio-player').forEach((p) => { if (p !== player) p.classList.remove('is-playing'); }); setPlaying(true); });
      audio.addEventListener('pause', () => setPlaying(false));
      audio.addEventListener('ended', () => { audio.currentTime = 0; setPlaying(false); setProgress(); });
      audio.addEventListener('timeupdate', setProgress);
      audio.addEventListener('loadedmetadata', setProgress);
      audio.addEventListener('durationchange', setProgress);
      const seek = (clientX) => { const rect = wave.getBoundingClientRect(); const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width))); if (isFinite(audio.duration)) audio.currentTime = ratio * audio.duration; };
      wave.addEventListener('click', (e) => seek(e.clientX));
      wave.addEventListener('keydown', (e) => { if (!isFinite(audio.duration)) return; if (e.key === 'ArrowLeft') { audio.currentTime = Math.max(0, audio.currentTime - 5); e.preventDefault(); } if (e.key === 'ArrowRight') { audio.currentTime = Math.min(audio.duration, audio.currentTime + 5); e.preventDefault(); } });
      setProgress(); setPlaying(!audio.paused);
    });
  }

  function audioPlayerMarkup(message, signedUrl) {
    const dur = Math.max(0, Number(message.body) || 0);
    const bars = Array.from({ length: 40 }, (_, i) => '<span style="--h:' + (20 + ((i * 7) % 55)) + '%"></span>').join('');
    if (!signedUrl) {
      return '<div class="live-voice-bubble"><div class="live-voice-loading">' + esc(t('Preparing voice message...', 'جارٍ تجهيز الرسالة الصوتية...')) + '</div></div>';
    }
    const durLabel = core ? core.formatDuration(dur) : formatVoiceClock(dur * 1000);
    return '<div class="live-voice-bubble">' +
      '<div class="sz-audio-player live-sz-audio-player" data-duration="' + dur + '">' +
        '<audio preload="metadata" src="' + esc(signedUrl) + '"></audio>' +
        '<div class="sz-audio-top">' +
          '<button type="button" class="sz-audio-play" data-audio-action="toggle" aria-label="Play">▶</button>' +
          '<div class="sz-audio-wave" role="slider" tabindex="0" aria-label="' + esc(t('Seek', 'تقديم/تأخير')) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
            '<div class="sz-audio-wave-bars">' + bars + '</div>' +
            '<div class="sz-audio-wave-progress" style="--progress:0%"></div>' +
          '</div>' +
          '<div class="sz-audio-time"><span data-audio-current>00:00</span><span class="sz-audio-sep">/</span><span data-audio-total>' + esc(durLabel) + '</span></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function messageMarkup(message, groupedMessage) {
    const mine = String(message.sender_id) === myId();
    const deleted = Boolean(message.deleted_at);
    const type = message.message_type || 'text';
    if (type === 'system') { return '<div class="live-message-system"><span>' + esc(message.body || '') + '</span></div>'; }
    if (type === 'call') {
      const info = message.call_id ? S.callInfo.get(String(message.call_id)) : null;
      const live = info && info.status !== 'ended';
      const icon = info?.call_type === 'audio' ? '📞' : '🎥';
      const label = live ? t('Join the call', 'انضم إلى المكالمة') : info?.ended_reason === 'declined' ? t('Call declined', 'رُفضت المكالمة') : info?.ended_reason === 'missed' ? t('Missed call', 'مكالمة فائتة') : t('Call ended', 'انتهت المكالمة');
      return '<div class="live-message live-message-call ' + (mine ? 'mine' : '') + '">' +
        '<div class="live-message-avatar">' + memberAvatar(message.sender_id) + '</div>' +
        '<div class="live-message-body">' +
          '<div class="live-message-meta"><strong dir="auto">' + esc(memberName(message.sender_id)) + '</strong><time>' + esc(formatTime(message.created_at)) + '</time></div>' +
          '<div class="live-call-message-card"><span class="live-call-message-icon" aria-hidden="true">' + icon + '</span><div><strong>' + esc(message.body || t('Call', 'مكالمة')) + '</strong><small>' + esc(label) + '</small></div>' + (live && message.call_id ? '<button type="button" class="button button-primary button-small" data-live-action="join-call" data-call-id="' + esc(message.call_id) + '">' + esc(t('Join', 'انضمام')) + '</button>' : '') + '</div>' +
        '</div></div>';
    }
    const reply = message.reply_to_id ? messageById(message.reply_to_id) : null;
    const signed = message.attachment_path ? S.signed.get(message.attachment_path) : '';
    const isAudio = type === 'audio';
    const image = type === 'image' && signed;
    let content = '';
    if (deleted) {
      content = '<p class="live-deleted">' + esc(t('This message was deleted', 'تم حذف هذه الرسالة')) + '</p>';
    } else if (isAudio) {
      content = audioPlayerMarkup(message, signed);
    } else {
      const textBody = message.body ? '<p class="live-message-text" dir="auto">' + esc(message.body) + '</p>' : '';
      const attachment = message.attachment_path ? ('<div class="live-attachment ' + (image ? 'image' : '') + '">' + (image
        ? '<button type="button" class="live-attachment-image" data-live-action="open-attachment" data-url="' + esc(signed) + '"><img src="' + esc(signed) + '" alt="' + esc(message.attachment_name || t('Photo', 'صورة')) + '" loading="lazy" /></button>'
        : '<button type="button" class="live-attachment-file" data-live-action="open-attachment" data-url="' + esc(signed) + '"><span aria-hidden="true">' + (type === 'image' ? '🖼' : '📎') + '</span><span><strong dir="auto">' + esc(message.attachment_name || t('Attachment', 'مرفق')) + '</strong><small>' + esc(core ? core.formatBytes(message.attachment_size) : '') + (signed ? '' : ' • ' + t('Preparing link…', 'جارٍ تجهيز الرابط…')) + '</small></span></button>'
      ) + '</div>') : '';
      content = textBody + attachment;
    }
    const canDelete = !deleted && (mine || deps.teamCanManageTeam(teamById(S.teamId)));
    const replyPreview = reply ? (String(reply.message_type) === 'audio' ? t('Voice message', 'رسالة صوتية') : (String(reply.body || reply.attachment_name || '').slice(0, 120) || t('Attachment', 'مرفق'))) : '';
    const rs = readStateFor(message);
    return '<div class="live-message ' + (mine ? 'mine ' : '') + (groupedMessage ? 'grouped ' : '') + (isAudio ? 'live-message-audio ' : '') + '" data-message-id="' + esc(message.id) + '">' +
      '<div class="live-message-avatar">' + memberAvatar(message.sender_id) + '</div>' +
      '<div class="live-message-body">' +
        '<div class="live-message-meta"><strong dir="auto">' + esc(memberName(message.sender_id)) + '</strong><time>' + esc(formatTime(message.created_at)) + '</time>' + (rs.text ? '<span class="live-read-state state-' + esc(rs.state) + '" title="' + esc(rs.label || rs.text) + '" aria-label="' + esc(rs.label || rs.text) + '">' + esc(rs.text) + '</span>' : '') + '</div>' +
        (reply ? '<div class="live-reply-quote"><strong>' + esc(memberName(reply.sender_id)) + '</strong><span dir="auto">' + esc(replyPreview) + '</span></div>' : '') +
        content +
        (!deleted ? messageReactionsMarkup(message.id) : '') +
        (!deleted ? '<div class="live-message-actions">' +
          '<button type="button" class="live-icon-button live-icon-button-small" data-live-action="open-reaction-picker" data-message-id="' + esc(message.id) + '" title="' + esc(t('React', 'تفاعل')) + '" aria-label="' + esc(t('Add reaction', 'إضافة تفاعل')) + '">😊</button>' +
          '<button type="button" class="live-icon-button live-icon-button-small" data-live-action="reply-message" data-message-id="' + esc(message.id) + '" title="' + esc(t('Reply', 'رد')) + '" aria-label="' + esc(t('Reply', 'رد')) + '">↩</button>' +
          '<button type="button" class="live-icon-button live-icon-button-small" data-live-action="copy-message" data-message-id="' + esc(message.id) + '" title="' + esc(t('Copy', 'نسخ')) + '" aria-label="' + esc(t('Copy', 'نسخ')) + '">⧉</button>' +
          (canDelete ? '<button type="button" class="live-icon-button live-icon-button-small danger" data-live-action="delete-message" data-message-id="' + esc(message.id) + '" title="' + esc(t('Delete', 'حذف')) + '" aria-label="' + esc(t('Delete', 'حذف')) + '">✕</button>' : '') +
        '</div>' : '') +
      '</div></div>';
  }

  function renderMessages(opts = {}) {
    const host = document.querySelector("[data-live-messages]");
    if (!host) return;
    if (S.messagesError) {
      host.innerHTML = `<div class="live-notice error"><strong>${esc(t("Could not load messages", "تعذّر تحميل الرسائل"))}</strong><p>${esc(S.messagesError)}</p></div>`;
      return;
    }
    if (S.messagesLoading && !S.messages.length) {
      host.innerHTML = `<p class="live-loading" role="status">${esc(t("Loading messages…", "جارٍ تحميل الرسائل…"))}</p>`;
      return;
    }
    const rows = filteredMessages();
    if (!rows.length) {
      host.innerHTML = `<div class="live-chat-empty-inline"><strong>${esc(
        S.search ? t("No matches", "لا نتائج") : t("No messages yet", "لا رسائل بعد"),
      )}</strong><p>${esc(
        S.search
          ? t("Try a different word.", "جرّب كلمة أخرى.")
          : t("Say hello or share the first update.", "ابدأ بتحية أو شارك أول تحديث."),
      )}</p></div>`;
      return;
    }

    const prevHeight = host.scrollHeight;
    const prevTop = host.scrollTop;
    const prevNearBottom = prevHeight - prevTop - host.clientHeight < 160;
    const canLoadOlder = !S.search && S.hasMoreMessages && rows.length >= 40;
    let lastDay = "";
    let lastSender = "";
    const loadOlderHtml = canLoadOlder
      ? `<div class="live-load-older-wrap"><button type="button" class="button button-secondary button-small" data-live-action="load-older-messages" ${S.loadingOlder ? "disabled" : ""}>${esc(S.loadingOlder ? t("Loading…", "جارٍ التحميل…") : t("Load older messages", "تحميل رسائل أقدم"))}</button></div>`
      : "";
    const html = loadOlderHtml + rows
      .map((message) => {
        const day = formatDay(message.created_at);
        const dayHeader = day !== lastDay ? `<div class="live-day-separator"><span>${esc(day)}</span></div>` : "";
        if (day !== lastDay) lastDay = day;
        const grouped = String(message.sender_id) === lastSender && message.message_type !== "call";
        lastSender = String(message.sender_id || "");
        return `${dayHeader}${messageMarkup(message, grouped)}`;
      })
      .join("");
    host.innerHTML = html;
    if (opts.preserveTop) {
      host.scrollTop = Math.max(0, host.scrollHeight - prevHeight + prevTop);
    } else if (prevNearBottom) {
      host.scrollTop = host.scrollHeight;
    } else {
      host.scrollTop = prevTop;
    }
    try { initLiveAudioPlayers(host); } catch {}
  }

  function scrollMessages(force) {
    const host = document.querySelector("[data-live-messages]");
    if (!host) return;
    const nearBottom = host.scrollHeight - host.scrollTop - host.clientHeight < 160;
    if (force || nearBottom) host.scrollTop = host.scrollHeight;
  }

  function updateLiveBadge() {
    const nav = document.getElementById("team-live-count");
    const total = unreadTotalForTeam();
    if (nav) {
      nav.textContent = total > 99 ? "99+" : String(total);
      nav.hidden = total <= 0;
    }
    const entry = document.querySelector("[data-live-entry-unread]");
    if (entry) {
      entry.hidden = total <= 0;
      entry.textContent = `${total > 99 ? "99+" : total} ${t("unread", "غير مقروءة")}`;
    }
  }

  // -------------------------------------------------------------------------
  // Voice message recording (chat composer)
  // -------------------------------------------------------------------------

  function formatVoiceClock(ms) {
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function voiceElapsedMs() {
    const v = S.voice;
    if (!v) return 0;
    if (v.state === "recording" && v.startedAt) {
      return Date.now() - v.startedAt - (v.pausedTotal || 0);
    }
    if (v.state === "paused" && v.pausedAt && v.startedAt) {
      return v.pausedAt - v.startedAt - (v.pausedTotal || 0);
    }
    return v.durationMs || 0;
  }

  function stopVoiceTimer() {
    if (S.voice?.timer) {
      window.clearInterval(S.voice.timer);
      S.voice.timer = 0;
    }
  }

  function startVoiceTimer() {
    stopVoiceTimer();
    if (!S.voice) return;
    S.voice.timer = window.setInterval(() => {
      updateVoiceComposerUi();
      if (S.voice.state === "recording" && voiceElapsedMs() >= 10 * 60 * 1000) {
        void stopVoiceRecording();
      }
    }, 250);
  }

  function releaseVoiceStream() {
    const v = S.voice;
    if (!v) return;
    if (v.stream) {
      v.stream.getTracks().forEach((track) => { try { track.stop(); } catch {} });
    }
    v.stream = null;
  }

  function clearVoicePreviewUrl() {
    const v = S.voice;
    if (v?.url) { try { URL.revokeObjectURL(v.url); } catch {} }
    if (v) v.url = "";
  }

  function resetVoiceRecording({ keepError = false } = {}) {
    const v = S.voice;
    if (!v) return;
    stopVoiceTimer();
    if (v.recorder) {
      try { if (v.recorder.state !== "inactive") v.recorder.stop(); } catch {}
    }
    releaseVoiceStream();
    clearVoicePreviewUrl();
    v.state = "idle";
    v.recorder = null;
    v.chunks = [];
    v.blob = null;
    v.startedAt = 0;
    v.pausedAt = 0;
    v.pausedTotal = 0;
    v.durationMs = 0;
    v.mimeType = "";
    v.previewPlaying = false;
    v.busy = false;
    if (!keepError) v.error = "";
    const preview = document.querySelector('[data-live-voice-preview]');
    if (preview) { try { preview.pause(); preview.src = ""; } catch {} }
    updateVoiceComposerUi();
  }

  async function ensureMicrophonePermission() {
    try {
      const plugin = window.Capacitor?.Plugins?.StudyZonePermissions;
      if (plugin && typeof plugin.requestMicrophone === "function") {
        const res = await plugin.requestMicrophone();
        if (res && (res.granted === false || res.state === "denied" || res.blocked || res.permanentlyDenied)) {
          return { ok: false, blocked: Boolean(res.blocked || res.permanentlyDenied), message: t("Microphone permission is blocked. Enable it in app settings.", "تم حظر إذن الميكروفون. فعّله من إعدادات التطبيق.") };
        }
      } else if (plugin && typeof plugin.checkMicrophone === "function") {
        const res = await plugin.checkMicrophone();
        if (res && (res.blocked || res.permanentlyDenied)) {
          return { ok: false, blocked: true, message: t("Microphone permission is blocked. Enable it in app settings.", "تم حظر إذن الميكروفون. فعّله من إعدادات التطبيق.") };
        }
      }
    } catch { /* fall back to getUserMedia */ }
    return { ok: true };
  }

  function preferredVoiceMime() {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg", "audio/mpeg"];
    if (!window.MediaRecorder || typeof MediaRecorder.isTypeSupported !== "function") return "";
    for (const t of types) { try { if (MediaRecorder.isTypeSupported(t)) return t; } catch {} }
    return "";
  }

  async function startVoiceRecording() {
    const v = S.voice;
    if (!v || S.uploading || v.busy) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      v.error = t("Audio recording is not supported on this device/browser.", "تسجيل الصوت غير مدعوم على هذا الجهاز/المتصفح.");
      updateVoiceComposerUi();
      return;
    }
    const perm = await ensureMicrophonePermission();
    if (!perm.ok) {
      v.error = perm.message;
      updateVoiceComposerUi();
      if (perm.blocked) { try { await window.Capacitor?.Plugins?.StudyZonePermissions?.openAppSettings?.(); } catch {} }
      return;
    }
    resetVoiceRecording();
    v.busy = true; v.error = "";
    updateVoiceComposerUi();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!document.querySelector('[data-live-composer]')) { stream.getTracks().forEach(t=>{try{t.stop()}catch{}}); v.busy=false; return; }
      v.stream = stream;
      const mimeType = preferredVoiceMime();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      v.recorder = recorder;
      v.mimeType = recorder.mimeType || mimeType || "audio/webm";
      v.chunks = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) v.chunks.push(e.data); };
      recorder.onstop = () => {
        stopVoiceTimer();
        releaseVoiceStream();
        try {
          const blob = new Blob(v.chunks || [], { type: v.mimeType || "audio/webm" });
          if (!blob.size) {
            resetVoiceRecording({ keepError: true });
            v.error = t("No audio was recorded.", "لم يتم تسجيل أي صوت.");
            updateVoiceComposerUi();
            return;
          }
          v.blob = blob;
          v.durationMs = Math.max(0, Math.round(voiceElapsedMs()));
          clearVoicePreviewUrl();
          v.url = URL.createObjectURL(blob);
          v.state = "ready";
        } catch {
          resetVoiceRecording({ keepError: true });
          v.error = t("Could not prepare the recording.", "تعذر تجهيز التسجيل.");
        }
        v.busy = false;
        updateVoiceComposerUi();
      };
      recorder.onerror = () => {
        v.error = t("Recording failed. Please try again.", "فشل التسجيل. يرجى المحاولة مرة أخرى.");
        resetVoiceRecording({ keepError: true });
      };
      recorder.start(250);
      v.startedAt = Date.now();
      v.pausedTotal = 0;
      v.pausedAt = 0;
      v.state = "recording";
      v.busy = false;
      startVoiceTimer();
      updateVoiceComposerUi();
    } catch (error) {
      v.busy = false;
      const name = String(error?.name || "");
      v.error = (name === "NotAllowedError" || name === "SecurityError")
        ? t("Microphone access was denied.", "تم رفض الوصول إلى الميكروفون.")
        : t("Could not start recording.", "تعذر بدء التسجيل.");
      releaseVoiceStream();
      v.state = "idle";
      updateVoiceComposerUi();
    }
  }

  function pauseVoiceRecording() {
    const v = S.voice; if (!v?.recorder) return;
    try {
      if (v.state === "recording" && v.recorder.state === "recording") {
        v.pausedAt = Date.now(); v.recorder.pause(); v.state = "paused";
      } else if (v.state === "paused" && v.recorder.state === "paused") {
        v.pausedTotal += Date.now() - (v.pausedAt || Date.now()); v.pausedAt = 0; v.recorder.resume(); v.state = "recording";
      }
    } catch {}
    updateVoiceComposerUi();
  }

  async function stopVoiceRecording() {
    const v = S.voice; if (!v?.recorder) return;
    try { if (v.recorder.state !== "inactive") v.recorder.stop(); } catch { resetVoiceRecording(); }
  }

  function toggleVoicePreviewPlayback() {
    const audio = document.querySelector('[data-live-voice-preview]');
    if (!audio || !S.voice?.url) return;
    if (audio.paused) { void audio.play().catch(() => {}); } else { audio.pause(); }
  }

  function voiceExtensionFromMime(mime) {
    const m = String(mime || "").split(";")[0].trim().toLowerCase();
    if (m === "audio/mp4" || m === "audio/x-m4a" || m === "audio/aac") return "m4a";
    if (m === "audio/ogg") return "ogg";
    if (m === "audio/mpeg") return "mp3";
    if (m === "audio/wav") return "wav";
    return "webm";
  }

  async function sendVoiceMessage() {
    const user = me();
    const conversationId = S.activeId;
    const client = sb();
    const v = S.voice;
    if (!user || !client || !conversationId || S.uploading || !v?.blob || v.state !== "ready") return;
    S.uploading = true;
    updateVoiceComposerUi();
    try {
      const ext = voiceExtensionFromMime(v.mimeType || v.blob.type);
      const safeName = `voice-message-${Date.now()}.${ext}`;
      const path = `${conversationId}/${uid()}-${safeName}`;
      const contentType = core ? core.normalizeMime(v.mimeType || v.blob.type || "audio/webm") : (v.mimeType || "audio/webm");
      const { error: uploadError } = await client.storage
        .from("team-chat")
        .upload(path, v.blob, { contentType, upsert: false, cacheControl: "3600" });
      if (uploadError) throw uploadError;

      const durationSeconds = Math.max(0, Math.round((v.durationMs || voiceElapsedMs()) / 1000));
      const row = {
        conversation_id: conversationId,
        message_type: "audio",
        body: String(durationSeconds), // duration in seconds (compatible with existing schema)
        reply_to_id: S.replyTo ? S.replyTo.id : null,
        attachment_path: path,
        attachment_name: safeName,
        attachment_type: contentType,
        attachment_size: v.blob.size,
      };
      const { data, error } = await client
        .from("team_messages")
        .insert(row)
        .select(
          "id,conversation_id,team_id,sender_id,message_type,body,attachment_path,attachment_name,attachment_type,attachment_size,reply_to_id,call_id,created_at,edited_at,deleted_at,deleted_by",
        )
        .single();
      if (error) throw error;
      resetVoiceRecording();
      S.replyTo = null;
      if (data) upsertMessage(data);
      await signAttachments();
      await markConversationRead(conversationId);
      renderMessages();
      scrollMessages(true);
      toast(t("Voice message sent.", "تم إرسال الرسالة الصوتية."));
    } catch (error) {
      notifyError(t("Could not send the voice message.", "تعذر إرسال الرسالة الصوتية."), error);
    } finally {
      S.uploading = false;
      updateVoiceComposerUi();
    }
  }

  function updateVoiceComposerUi() {
    const host = document.querySelector('[data-live-voice-wrap]');
    if (!host) return;
    const v = S.voice;
    const state = v?.state || "idle";
    const ms = state === "ready" ? (v.durationMs || 0) : voiceElapsedMs();
    const timerEl = host.querySelector('[data-live-voice-timer]');
    if (timerEl) timerEl.textContent = formatVoiceClock(ms);
    const statusEl = host.querySelector('[data-live-voice-status]');
    if (statusEl) {
      statusEl.textContent =
        state === "recording" ? t("Recording...", "جاري التسجيل...")
        : state === "paused" ? t("Paused", "متوقف مؤقتًا")
        : state === "ready" ? t("Preview before sending", "معاينة قبل الإرسال")
        : v?.error ? v.error : "";
    }
    const previewShell = host.querySelector('[data-live-voice-preview-shell]');
    if (previewShell) previewShell.hidden = !(state === "ready" && v.url);
    const preview = host.querySelector('[data-live-voice-preview]');
    if (preview && state === "ready" && v.url && preview.src !== v.url) preview.src = v.url;
    host.dataset.state = state;
    host.querySelectorAll('[data-live-action]').forEach((btn) => {
      const action = btn.getAttribute('data-live-action');
      const show = (
        (action === 'voice-start' && (state === 'idle')) ||
        (action === 'voice-pause' && (state === 'recording' || state === 'paused')) ||
        (action === 'voice-stop' && (state === 'recording' || state === 'paused')) ||
        (action === 'voice-cancel' && (state === 'recording' || state === 'paused' || state === 'ready')) ||
        (action === 'voice-preview-toggle' && state === 'ready') ||
        (action === 'voice-send' && state === 'ready') ||
        (action === 'voice-discard' && state === 'ready')
      );
      btn.hidden = !show;
      if (action === 'voice-pause') btn.textContent = state === 'paused' ? t('Resume', 'استكمال') : t('Pause', 'إيقاف مؤقت');
      if (action === 'voice-preview-toggle' && preview) btn.textContent = preview.paused ? t('Preview', 'معاينة') : t('Pause preview', 'إيقاف المعاينة');
      btn.disabled = Boolean(S.uploading || v.busy);
    });
    const errEl = host.querySelector('[data-live-voice-error]');
    if (errEl) { errEl.textContent = v?.error || ""; errEl.hidden = !v?.error; }
  }

  // -------------------------------------------------------------------------
  // Composer, attachments and message actions
  // -------------------------------------------------------------------------

  function pickAttachment() {
    const input = document.querySelector('[data-live-input="attachment"]');
    if (input) input.click();
  }

  function handleAttachmentChange(input) {
    const file = input.files && input.files[0];
    input.value = "";
    if (!file) return;
    const validation = core ? core.validateAttachment(file) : { ok: true };
    if (!validation.ok) {
      const reason =
        validation.reason === "too_large"
          ? t("That file is larger than 20 MB.", "هذا الملف أكبر من 20 م.ب.")
          : validation.reason === "type"
            ? t("That file type is not supported.", "نوع هذا الملف غير مدعوم.")
            : t("Choose a different file.", "اختر ملفًا آخر.");
      toast(reason);
      return;
    }
    S.pendingFile = file;
    refreshComposer();
  }

  async function sendMessage() {
    const user = me();
    const conversationId = S.activeId;
    const client = sb();
    if (!user || !client || !conversationId || S.uploading) return;
    const text = String(S.draft || "").trim();
    const file = S.pendingFile;
    if (!text && !file) return;
    if (text.length > (core ? core.MAX_MESSAGE_LENGTH : 4000)) {
      toast(t("That message is too long.", "هذه الرسالة طويلة جدًا."));
      return;
    }

    S.uploading = true;
    refreshComposer();
    let attachment = null;
    try {
      if (file) {
        const validation = core ? core.validateAttachment(file) : { ok: true, type: file.type };
        if (!validation.ok) throw new Error(t("That attachment is not allowed.", "هذا المرفق غير مسموح."));
        const safeName = core ? core.safeAttachmentName(file.name) : String(file.name || "file");
        const path = `${conversationId}/${uid()}-${safeName}`;
        const { error: uploadError } = await client.storage
          .from("team-chat")
          .upload(path, file, {
            contentType: validation.type || file.type || "application/octet-stream",
            upsert: false,
            cacheControl: "3600",
          });
        if (uploadError) throw uploadError;
        attachment = {
          attachment_path: path,
          attachment_name: safeName,
          attachment_type: validation.type || file.type || "",
          attachment_size: file.size,
        };
      }

      const isAudio = file && core && core.isAudioType && core.isAudioType(attachment.attachment_type);
      const row = {
        conversation_id: conversationId,
        message_type: file
          ? core && core.isImageType(attachment.attachment_type)
            ? "image"
            : isAudio
              ? "audio"
              : "file"
          : "text",
        body: text || (isAudio ? null : null),
        body: text || null,
        reply_to_id: S.replyTo ? S.replyTo.id : null,
        ...(attachment || {}),
      };
      const { data, error } = await client
        .from("team_messages")
        .insert(row)
        .select(
          "id,conversation_id,team_id,sender_id,message_type,body,attachment_path,attachment_name,attachment_type,attachment_size,reply_to_id,call_id,created_at,edited_at,deleted_at,deleted_by",
        )
        .single();
      if (error) throw error;
      S.draft = "";
      S.replyTo = null;
      S.pendingFile = null;
      if (data) upsertMessage(data);
      if (attachment) await signAttachments();
      await markConversationRead(conversationId);
      renderMessages();
      scrollMessages(true);
    } catch (error) {
      notifyError(t("Could not send the message.", "تعذّر إرسال الرسالة."), error);
    } finally {
      S.uploading = false;
      refreshComposer();
    }
  }

  async function deleteMessage(messageId) {
    const message = messageById(messageId);
    if (!message) return;
    if (!window.confirm(t("Delete this message for everyone in this chat?", "حذف هذه الرسالة للجميع في هذه المحادثة؟"))) return;
    try {
      const { error } = await sb()
        .from("team_messages")
        .update({ deleted_at: new Date().toISOString(), body: null })
        .eq("id", messageId);
      if (error) throw error;
      // Best-effort storage cleanup for attachments (requires storage delete policy/permission).
      if (message.attachment_path) {
        try {
          await sb().storage.from("team-chat").remove([message.attachment_path]);
          S.signed.delete(message.attachment_path);
          S.signedAt.delete(message.attachment_path);
        } catch (storageError) {
          console.warn("Attachment storage cleanup failed (message soft-deleted).", storageError);
        }
      }
      message.deleted_at = new Date().toISOString();
      message.body = null;
      renderMessages();
      toast(t("Message deleted.", "تم حذف الرسالة."));
    } catch (error) {
      notifyError(t("Could not delete the message.", "تعذّر حذف الرسالة."), error);
    }
  }

  async function copyMessage(messageId) {
    const message = messageById(messageId);
    if (!message || message.deleted_at) return;
    const text = String(message.body || message.attachment_name || "").trim();
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast(t("Copied.", "تم النسخ."));
    } catch (error) {
      console.warn("Copy failed.", error);
      toast(t("Could not copy.", "تعذّر النسخ."));
    }
  }

  async function loadOlderMessages() {
    if (!S.activeId || S.loadingOlder || S.messagesLoading || !S.hasMoreMessages || S.search) return;
    const oldest = S.messages[0];
    if (!oldest || !oldest.created_at) return;
    await loadMessages(S.activeId, { silent: true, before: oldest.created_at, appendOlder: true });
  }

  function openAttachment(url) {
    if (!url) {
      toast(t("The attachment link is still being prepared.", "رابط المرفق قيد التجهيز."));
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function replyToMessage(messageId) {
    const message = messageById(messageId);
    if (!message) return;
    S.replyTo = message;
    refreshComposer();
    document.querySelector('[data-live-input="draft"]')?.focus();
  }

  // -------------------------------------------------------------------------
  // Opening conversations
  // -------------------------------------------------------------------------

  async function openGroupChat() {
    const conversationId = await ensureGroupConversation();
    if (!conversationId) return;
    if (!conversationById(conversationId)) await loadConversations({ silent: true });
    await openConversation(conversationId);
    renderSidebar();
  }

  async function openDirect(userId) {
    if (!S.teamId || !userId) return;
    const otherUserId = String(userId);
    S.pendingDirectUserId = otherUserId;
    console.info("[team-live] openDirect click", {
      teamId: S.teamId,
      otherUserId,
      page: deps.getCurrentPage ? deps.getCurrentPage() : undefined,
    });
    try {
      const rpcResult = await rpc("team_live_open_direct", {
        p_team_id: S.teamId,
        p_other_user_id: otherUserId,
      });
      const conversationId = String(
        (rpcResult && typeof rpcResult === "object" && (rpcResult.id || rpcResult.conversation_id)) ||
          rpcResult ||
          "",
      );
      console.info("[team-live] openDirect rpc result", {
        teamId: S.teamId,
        otherUserId,
        rpcResult,
        conversationId,
      });
      if (!conversationId) {
        throw new Error(t("No conversation ID was returned.", "لم يتم إرجاع معرّف محادثة."));
      }
      // Ensure the chat surface is ready and visible before/while loading.
      if (deps.getCurrentPage && deps.getCurrentPage() !== "team-live") {
        deps.navigate("team-live");
      }
      await loadConversations({ silent: true });
      await openConversation(conversationId);
      renderSidebar();
      syncChatSurface();
      // Defensive: force a rerender if the conversation panel stayed hidden.
      const chatHost = document.querySelector("[data-live-chat]");
      if (chatHost && !chatHost.querySelector(".live-chat-head") && S.activeId) {
        S.chatRenderedFor = null;
        syncChatSurface();
      }
      console.info("[team-live] openDirect completed", {
        conversationId,
        activeId: S.activeId,
        found: Boolean(conversationById(conversationId)),
      });
    } catch (error) {
      console.error("[team-live] openDirect failed", {
        teamId: S.teamId,
        otherUserId,
        error,
      });
      notifyError(t("Could not open the direct chat.", "تعذّر فتح المحادثة المباشرة."), error);
    } finally {
      // Keep pending id only if active conversation is that direct chat.
      if (!S.activeId || (activeConversation() && activeConversation().kind !== "direct")) {
        S.pendingDirectUserId = null;
      }
    }
  }

  async function openTaskConversation(taskId) {
    if (!S.teamId || !taskId) return;
    try {
      const conversationId = await rpc("team_live_open_task_conversation", {
        p_team_id: S.teamId,
        p_task_id: taskId,
      });
      S.pendingTaskId = null;
      await loadConversations({ silent: true });
      await openConversation(conversationId);
      renderSidebar();
    } catch (error) {
      notifyError(t("Could not open the task chat.", "تعذّر فتح محادثة المهمة."), error);
    }
  }

  // -------------------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------------------

  async function enableNotifications() {
    if (!("Notification" in window)) {
      toast(t("This browser does not support notifications.", "هذا المتصفح لا يدعم الإشعارات."));
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      S.notificationAsked = true;
      if (permission === "granted") {
        toast(t("Call notifications are enabled.", "تم تفعيل إشعارات المكالمات."));
      } else {
        toast(
          t(
            "Notifications were not enabled. You can change this in browser settings.",
            "لم يتم تفعيل الإشعارات. يمكنك تغيير ذلك من إعدادات المتصفح.",
          ),
        );
      }
    } catch (error) {
      notifyError(t("Could not request notification permission.", "تعذّر طلب إذن الإشعارات."), error);
    }
  }

  async function testDevices() {
    const support = callSupportStatus();
    if (!support.supported) {
      toast(supportMessage(support.reason));
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      const audio = stream.getAudioTracks().length;
      const video = stream.getVideoTracks().length;
      toast(
        t(
          `Devices are ready: ${audio} microphone, ${video} camera.`,
          `الأجهزة جاهزة: ${audio} ميكروفون، ${video} كاميرا.`,
        ),
      );
    } catch (error) {
      toast(error.message || mediaErrorMessage(error));
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
    }
  }

  function notifyIncoming(invite) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    if (!document.hidden) return;
    try {
      const notification = new Notification(t("Incoming call", "مكالمة واردة"), {
        body: `${memberName(invite.caller_id)} · ${invite.team_name || ""}`,
        tag: `studyzone-call-${invite.call_id}`,
        silent: false,
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.warn("Could not show the incoming call notification.", error);
    }
  }

  function playRing() {
    stopRing();
    if (S.ringContext) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const context = new Ctx();
      S.ringContext = context;
      if (context.state === "suspended") void context.resume().catch(() => {});
      const beep = () => {
        try {
          const now = context.currentTime;
          [0, 0.35].forEach((offset, index) => {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = "sine";
            oscillator.frequency.value = index ? 560 : 480;
            gain.gain.setValueAtTime(0.0001, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.06, now + offset + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.28);
            oscillator.connect(gain).connect(context.destination);
            oscillator.start(now + offset);
            oscillator.stop(now + offset + 0.3);
          });
        } catch {
          /* ignore */
        }
      };
      beep();
      S.ringTimer = window.setInterval(beep, 1600);
    } catch (error) {
      console.warn("Could not play the ring tone.", error);
    }
  }

  function stopRing() {
    if (S.ringTimer) {
      window.clearInterval(S.ringTimer);
      S.ringTimer = 0;
    }
    if (S.ringContext) {
      try {
        void S.ringContext.close();
      } catch {
        /* ignore */
      }
      S.ringContext = null;
    }
  }

  // -------------------------------------------------------------------------
  // Action router (continued below with call actions)
  // -------------------------------------------------------------------------

  function handleAction(action, target) {
    switch (action) {
      case "refresh-live":
        S.conversationsLoaded = false;
        void loadConversations();
        if (S.activeId) void loadMessages(S.activeId);
        void checkInvites();
        return;
      case "switch-team":
        deps.setSelectedTeamId(target.dataset.teamId);
        S.teamId = null;
        S.activeId = null;
        S.chatRenderedFor = null;
        S.conversationsSeq += 1;
        teardownTeamChannel();
        deps.scheduleRender();
        return;
      case "open-conversation":
        void openConversation(target.dataset.conversationId);
        return;
      case "open-group-chat":
        void openGroupChat();
        return;
      case "open-direct":
        void openDirect(target.dataset.userId);
        return;
      case "reload-messages":
        if (S.activeId) void loadMessages(S.activeId);
        return;
      case "clear-message-search":
        S.search = "";
        {
          const input = document.querySelector('[data-live-input="message-search"]');
          if (input) input.value = "";
        }
        renderMessages();
        return;
      case "cancel-reply":
        S.replyTo = null;
        refreshComposer();
        return;
      case "clear-attachment":
        S.pendingFile = null;
        refreshComposer();
        return;
      case "pick-attachment":
        pickAttachment();
        return;
      case "voice-start":
        void startVoiceRecording();
        return;
      case "voice-pause":
        pauseVoiceRecording();
        return;
      case "voice-stop":
        void stopVoiceRecording();
        return;
      case "voice-cancel":
        resetVoiceRecording();
        return;
      case "voice-discard":
        resetVoiceRecording();
        return;
      case "voice-preview-toggle":
        toggleVoicePreviewPlayback();
        return;
      case "voice-send":
        void sendVoiceMessage();
        return;
      case "back-to-list":
        closeChatView();
        return;
      case "open-reaction-picker": {
        const id = String(target.dataset.messageId || "");
        S.openReactionPickerMessageId = S.openReactionPickerMessageId === id ? null : id;
        renderMessages();
        return;
      }
      case "toggle-reaction":
        void toggleReaction(target.dataset.messageId, target.dataset.emoji);
        return;
      case "reply-message":
        replyToMessage(target.dataset.messageId);
        return;
      case "copy-message":
        void copyMessage(target.dataset.messageId);
        return;
      case "delete-message":
        void deleteMessage(target.dataset.messageId);
        return;
      case "load-older-messages":
        void loadOlderMessages();
        return;
      case "open-attachment":
        openAttachment(target.dataset.url);
        return;
      case "enable-notifications":
        void enableNotifications();
        return;
      case "test-devices":
        void testDevices();
        return;
      case "open-group-call-sheet":
        openCallSheet({ scope: "group" });
        return;
      case "open-call-sheet-here":
        openCallSheet({ scope: "group", conversationId: S.activeId });
        return;
      case "call-here":
        void startCallHere(target.dataset.callType || "video");
        return;
      case "task-chat":
        navigateToTaskChat(target.dataset.taskId, target.dataset.teamId);
        return;
      case "task-call": {
        adoptTeam(target.dataset.teamId);
        openCallSheet({
          scope: "group",
          taskId: target.dataset.taskId,
          title: target.dataset.taskTitle || "",
        });
        return;
      }
      case "call-member":
        void startDirectCall(target.dataset.userId, target.dataset.callType || "video");
        return;
      case "invite-accept":
        void respondToInvite(target.dataset.callId, true);
        return;
      case "invite-decline":
        void respondToInvite(target.dataset.callId, false);
        return;
      case "join-call":
        void joinExistingCall(target.dataset.callId);
        return;
      case "close-sheet":
        if (deps) deps.closeModal(document.getElementById("team-live-modal"));
        return;
      case "confirm-start-call":
        void startCallFromSheet();
        return;
      case "confirm-invite-members":
        void inviteMembersFromSheet();
        return;
      case "toggle-mute":
        toggleMute();
        return;
      case "toggle-camera":
        void toggleCamera();
        return;
      case "switch-camera":
        void switchCamera();
        return;
      case "toggle-screen-share":
        void toggleScreenShare();
        return;
      case "toggle-call-chat":
        toggleCallChat();
        return;
      case "toggle-call-minimize":
        toggleCallMinimize();
        return;
      case "open-add-member":
        openAddMemberSheet();
        return;
      case "end-call":
        void endCall();
        return;
      case "leave-call":
        // Leaving the screen must not end the call for everyone.
        void leaveCall({ silent: false, reason: "leave" });
        return;
      case "close-call":
        // Closing the call UI locally must not end the call for everyone.
        void leaveCall({ silent: true, reason: "close" });
        return;
      case "call-chat-send":
        void sendCallChat();
        return;
      default:
        return;
    }
  }

  function navigateToTaskChat(taskId, teamId) {
    adoptTeam(teamId);
    S.pendingTaskId = taskId;
    deps.navigate("team-live");
  }

  // Keeps the Team Live state aligned with the team selected elsewhere in the
  // app (task detail, Teams page) before opening a chat or starting a call.
  function adoptTeam(teamId) {
    if (!teamId) return;
    if (String(teamId) !== String(deps.getSelectedTeamId())) {
      deps.setSelectedTeamId(teamId);
    }
    if (String(S.teamId) === String(teamId)) return;
    teardownTeamChannel();
    teardownReadChannel();
    teardownReactionChannel();
    S.teamId = String(teamId);
    S.activeId = null;
    S.chatRenderedFor = null;
    S.messages = [];
    S.conversations = [];
    S.conversationsSeq += 1;
    S.conversationsLoaded = false;
    S.migrationMissing = false;
  }

  // -------------------------------------------------------------------------
  // Lifecycle hooks used by app.js
  // -------------------------------------------------------------------------

  function taskActions(task, team) {
    if (!task || !team) return "";
    return `<button class="button button-secondary button-small" type="button" data-live-action="task-chat" data-task-id="${esc(task.id)}" data-team-id="${esc(team.id)}">${esc(t("Task chat", "محادثة المهمة"))}</button>
      <button class="button button-secondary button-small" type="button" data-live-action="task-call" data-task-id="${esc(task.id)}" data-team-id="${esc(team.id)}" data-task-title="${esc(task.title || "")}">${esc(t("Meet about task", "اجتماع عن المهمة"))}</button>`;
  }

  function teamPanel(team) {
    if (!team) return "";
    if (
      !S.call &&
      String(S.teamId) !== String(team.id) &&
      !S.conversationsLoading
    ) {
      teardownTeamChannel();
      teardownReadChannel();
      teardownReactionChannel();
      S.teamId = String(team.id);
      S.conversationsLoaded = false;
      S.activeId = null;
      S.chatRenderedFor = null;
      void loadConversations({ silent: true });
    }
    const count = unreadTotalForTeam();
    return `<section class="panel live-entry-panel">
      <div class="live-entry-copy">
        <p class="eyebrow">${esc(t("TEAM LIVE", "الفريق مباشر"))}</p>
        <h2>${esc(t("Chat & calls", "المحادثة والمكالمات"))}</h2>
        <p class="panel-copy">${esc(
          t(
            "Talk with your team, discuss a task, or start an audio or video call.",
            "تحدّث مع فريقك أو ناقش مهمة أو ابدأ مكالمة صوتية أو مرئية.",
          ),
        )}</p>
      </div>
      <div class="live-entry-actions">
        <span class="live-entry-unread" data-live-entry-unread ${count ? "" : "hidden"}>${count > 99 ? "99+" : count} ${esc(t("unread", "غير مقروءة"))}</span>
        <a class="button button-primary button-small" href="#team-live">${esc(t("Open team chat", "فتح محادثة الفريق"))}</a>
        <button type="button" class="button button-secondary button-small" data-live-action="open-group-call-sheet">${esc(t("Start a call", "بدء مكالمة"))}</button>
      </div>
    </section>`;
  }

  function init(nextDeps) {
    if (initialized) return;
    deps = nextDeps || {};
    initialized = true;
    S.destroyed = false;

    if (!document.getElementById("team-live-modal")) {
      const modal = document.createElement("div");
      modal.className = "modal-backdrop";
      modal.id = "team-live-modal";
      modal.hidden = true;
      document.body.appendChild(modal);
    }
    if (!document.getElementById("team-live-call-root")) {
      const root = document.createElement("div");
      root.id = "team-live-call-root";
      document.body.appendChild(root);
    }
    if (!document.getElementById("team-live-incoming-root")) {
      const root = document.createElement("div");
      root.id = "team-live-incoming-root";
      document.body.appendChild(root);
    }

    document.addEventListener("click", (event) => {
      const target = event.target.closest("[data-live-action]");
      if (!target) return;
      const action = target.dataset.liveAction;
      if (!action) return;
      event.preventDefault();
      try {
        handleAction(action, target, event);
      } catch (error) {
        notifyError(t("Team Live action failed.", "فشل إجراء الفريق مباشر."), error);
      }
    });

    // Single tap on the call surface (video area) toggles the control bar.
    // Buttons, inputs, chat panel and video tiles keep their own behaviour.
    document.addEventListener("click", (event) => {
      const overlay = event.target && event.target.closest
        ? event.target.closest(".live-call-overlay")
        : null;
      if (!overlay) return;
      const interactive = event.target && event.target.closest
        ? event.target.closest(
            "button, a, input, textarea, select, .live-call-head, .live-call-chat, .live-tile, .live-turn-warning, .live-incoming",
          )
        : null;
      if (interactive) return;
      if (event.target.closest("[data-live-action]")) return;
      // Tapping the call surface toggles between full screen and minimized.
      // The minimized state is flipped by toggleCallMinimize itself.
      toggleCallMinimize();
    });

    document.addEventListener("input", (event) => {
      const input = event.target.closest("[data-live-input]");
      if (!input) return;
      const name = input.dataset.liveInput;
      if (name === "draft") {
        S.draft = input.value;
        autoGrow(input);
      } else if (name === "conversation-search") {
        S.convSearch = input.value;
        renderSidebar();
      } else if (name === "message-search") {
        S.search = input.value;
        renderMessages();
      } else if (name === "call-chat") {
        S.callChatDraft = input.value;
      }
    });

    document.addEventListener("change", (event) => {
      const input = event.target.closest("[data-live-input]");
      if (!input) return;
      if (input.dataset.liveInput === "attachment") handleAttachmentChange(input);
    });

    document.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-live-form]");
      if (!form) return;
      event.preventDefault();
      const kind = form.dataset.liveForm;
      if (kind === "composer") void sendMessage();
      else if (kind === "call-chat") void sendCallChat();
      else if (kind === "start-call") void startCallFromSheet();
      else if (kind === "invite-call-members") void inviteMembersFromSheet();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      const target = event.target;
      if (target.matches && target.matches('[data-live-input="draft"]')) {
        event.preventDefault();
        void sendMessage();
      } else if (target.matches && target.matches('[data-live-input="call-chat"]')) {
        event.preventDefault();
        void sendCallChat();
      }
    });

    window.addEventListener("beforeunload", () => {
      // Leaving the page/app must not end the call for everyone.
      if (S.call) void leaveCall({ silent: true, unload: true, reason: "beforeunload" });
    });
    window.addEventListener("pagehide", () => {
      if (S.call) void leaveCall({ silent: true, unload: true, reason: "pagehide" });
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) return;
      if (S.activeId) void loadMessages(S.activeId, { silent: true });
      if (S.activeId && S.messages.some((message) => message.attachment_path)) {
        void signAttachments().then(() => renderMessages());
      }
      void checkInvites();
    });

    if (window.visualViewport) {
      const keepComposerVisible = () => {
        const active = document.activeElement;
        if (active && active.matches && active.matches('[data-live-input="draft"]')) {
          window.requestAnimationFrame(() => {
            try { active.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch {}
          });
        }
      };
      window.visualViewport.addEventListener("resize", keepComposerVisible);
      window.visualViewport.addEventListener("scroll", keepComposerVisible);
    }

    window.addEventListener("studyzone:incoming-call-action", (event) => {
      const detail = event?.detail || window.__studyZonePendingCallAction;
      if (!detail) return;
      window.__studyZonePendingCallAction = null;
      void handleNativeCallAction(detail);
    });
    if (window.__studyZonePendingCallAction) {
      const pending = window.__studyZonePendingCallAction;
      window.__studyZonePendingCallAction = null;
      window.setTimeout(() => void handleNativeCallAction(pending), 900);
    }

    startInviteWatcher();
  }

  function shutdown() {
    S.destroyed = true;
    try { resetVoiceRecording(); } catch {}
    teardownTeamChannel();
    teardownReadChannel();
    teardownReactionChannel();
    stopInviteWatcher();
    stopRing();
    // Module shutdown/unmount must not end the call for everyone.
    if (S.call) void leaveCall({ silent: true, reason: "shutdown" });
    S.teamId = null;
    S.activeId = null;
    S.conversations = [];
    S.messages = [];
    S.chatRenderedFor = null;
    const incoming = document.getElementById("team-live-incoming-root");
    if (incoming) incoming.innerHTML = "";
    const callRoot = document.getElementById("team-live-call-root");
    if (callRoot) callRoot.innerHTML = "";
  }

  function syncSession(nextSession) {
    const userId = nextSession && nextSession.user ? String(nextSession.user.id) : "";
    if (userId) {
      const switched = String(S.sessionUserId || "") !== userId;
      S.sessionUserId = userId;
      S.destroyed = false;
      if (switched) {
        S.seenInvites.clear();
        S.handledInvites.clear();
        S.missedNotified.clear();
        startInviteWatcher();
      } else if (!S.invitePoll) {
        startInviteWatcher();
      }
      ensureInviteChannel();
      void checkInvites();
      if (window.__studyZonePendingCallAction) {
        const pending = window.__studyZonePendingCallAction;
        window.__studyZonePendingCallAction = null;
        window.setTimeout(() => void handleNativeCallAction(pending), 600);
      }
      if (S.teamChannel && sb()) {
        const current = deps.getSelectedTeamId();
        if (String(current) !== String(S.teamChannelId)) {
          teardownTeamChannel();
          S.teamId = null;
        }
      }
    } else {
      S.sessionUserId = "";
      shutdown();
    }
  }

  function mount() {
    if (!initialized) return;
    const user = me();
    if (!user) return;
    if (!deps.getTeams().length) {
      void deps.loadTeams?.();
      return;
    }
    const teamId = deps.getSelectedTeamId();
    if (!teamId) return;
    const changed = String(S.teamId) !== String(teamId);
    if (changed) {
      teardownTeamChannel();
      teardownReadChannel();
      teardownReactionChannel();
      S.teamId = teamId;
      S.activeId = null;
      S.chatRenderedFor = null;
      S.messages = [];
      S.conversations = [];
      S.conversationsSeq += 1;
      S.conversationsLoaded = false;
      S.migrationMissing = false;
    }
    renderSidebar();
    syncChatSurface();
    if (changed || !S.conversationsLoaded) {
      void loadConversations().then(async () => {
        if (S.pendingTaskId) {
          await openTaskConversation(S.pendingTaskId);
          S.pendingTaskId = null;
        } else if (S.pendingConversationId) {
          await openConversation(S.pendingConversationId);
          S.pendingConversationId = null;
        }
      });
    } else if (S.pendingTaskId) {
      void openTaskConversation(S.pendingTaskId).then(() => {
        S.pendingTaskId = null;
      });
    }
    ensureTeamChannel();
    void checkInvites();
  }

  // -------------------------------------------------------------------------
  // Call sheet
  // -------------------------------------------------------------------------

  function sheetMembers({ taskId } = {}) {
    const teamId = S.teamId || (deps ? deps.getSelectedTeamId() : null);
    let ids = teamMembersOf(teamId).filter((id) => id !== myId());
    if (taskId) {
      const taskIds = (deps.getTaskParticipantIds?.(taskId) || []).map(String);
      const task = (deps.getTeamTasks?.() || []).find(
        (item) => String(item.id) === String(taskId),
      );
      if (task?.created_by && String(task.created_by) !== myId()) taskIds.push(String(task.created_by));
      const filtered = ids.filter((id) => !taskIds.length || taskIds.includes(id));
      if (filtered.length) ids = filtered;
    }
    return ids;
  }

  function memberCheckboxMarkup(id, checked) {
    return `<label class="live-member-option">
      <input type="checkbox" name="invitee" value="${esc(id)}" ${checked ? "checked" : ""} />
      ${memberAvatar(id, "team-avatar-xs")}
      <span dir="auto">${esc(memberName(id))}</span>
    </label>`;
  }

  function openCallSheet(options = {}) {
    if (S.call) {
      toast(t("You are already in a call.", "أنت بالفعل في مكالمة."));
      return;
    }
    const teamId = S.teamId || deps.getSelectedTeamId();
    if (!teamId) return;
    const scope = options.scope === "direct" ? "direct" : "group";
    const members = sheetMembers({ taskId: options.taskId });
    if (!members.length) {
      toast(
        t(
          "Invite a teammate before starting a call.",
          "ادعُ زميلًا قبل بدء المكالمة.",
        ),
      );
      return;
    }
    const checked = new Set(members.slice(0, 7));
    const title = options.title || "";
    const modal = document.getElementById("team-live-modal");
    if (!modal) return;
    modal.innerHTML = `<section class="modal live-sheet" role="dialog" aria-modal="true" aria-labelledby="live-sheet-title">
      <button class="modal-close" type="button" data-live-action="close-sheet" aria-label="${esc(t("Close", "إغلاق"))}">×</button>
      <p class="eyebrow">${esc(t("START A CALL", "بدء مكالمة"))}</p>
      <h2 id="live-sheet-title">${esc(title || t("Call your team", "اتصل بفريقك"))}</h2>
      <p class="modal-subtitle">${esc(
        t(
          "Choose who should ring. Up to 7 teammates plus you; 4 simultaneous cameras is the practical limit.",
          "اختر من يجب أن يرن هاتفه. حتى 7 زملاء بالإضافة إليك؛ والحد العملي هو 4 كاميرات متزامنة.",
        ),
      )}</p>
      <form data-live-form="start-call">
        <input type="hidden" name="scope" value="${esc(scope)}" />
        <input type="hidden" name="task_id" value="${esc(options.taskId || "")}" />
        <input type="hidden" name="conversation_id" value="${esc(options.conversationId || "")}" />
        <input type="hidden" name="title" value="${esc(title)}" />
        <fieldset class="live-call-type">
          <legend>${esc(t("Call type", "نوع المكالمة"))}</legend>
          <label><input type="radio" name="call_type" value="video" checked /> ${esc(t("Video", "مرئية"))}</label>
          <label><input type="radio" name="call_type" value="audio" /> ${esc(t("Audio", "صوتية"))}</label>
        </fieldset>
        <div class="live-member-picker">${members
          .map((id) => memberCheckboxMarkup(id, checked.has(id)))
          .join("")}</div>
        <p class="data-caption">${esc(
          t(
            "Microphone and camera are only requested after you press Start.",
            "لا يُطلب الميكروفون أو الكاميرا إلا بعد الضغط على بدء.",
          ),
        )}</p>
        <div class="modal-actions">
          <button type="button" class="button button-secondary" data-live-action="close-sheet">${esc(t("Cancel", "إلغاء"))}</button>
          <button type="submit" class="button button-primary">${esc(t("Start call", "بدء المكالمة"))}</button>
        </div>
      </form>
    </section>`;
    deps.openModal(modal);
  }

  async function startCallFromSheet() {
    const form = document.querySelector('#team-live-modal [data-live-form="start-call"]');
    if (!form) return;
    const data = new FormData(form);
    const inviteeIds = Array.from(form.querySelectorAll('input[name="invitee"]:checked')).map(
      (input) => String(input.value),
    );
    const callType = String(data.get("call_type") || "video") === "audio" ? "audio" : "video";
    const scope = String(data.get("scope") || "group") === "direct" ? "direct" : "group";
    if (!inviteeIds.length) {
      toast(t("Choose at least one teammate.", "اختر زميلًا واحدًا على الأقل."));
      return;
    }
    if (inviteeIds.length > 7) {
      toast(t("Choose at most 7 teammates.", "اختر 7 زملاء كحد أقصى."));
      return;
    }
    deps.closeModal(document.getElementById("team-live-modal"));
    await startCall({
      callType,
      scope,
      inviteeIds,
      taskId: String(data.get("task_id") || "") || null,
      conversationId: String(data.get("conversation_id") || "") || null,
      title: String(data.get("title") || "") || null,
    });
  }

  // -------------------------------------------------------------------------
  // Media and ICE
  // -------------------------------------------------------------------------

  function mediaErrorMessage(error) {
    const name = String(error?.name || "");
    if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
      return t(
        "Microphone or camera permission was blocked. Allow it in your browser or app settings and try again.",
        "تم حظر إذن الميكروفون أو الكاميرا. اسمح به من إعدادات المتصفح أو التطبيق ثم حاول مرة أخرى.",
      );
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") {
      return t(
        "No usable microphone or camera was found on this device.",
        "لم يتم العثور على ميكروفون أو كاميرا صالحة على هذا الجهاز.",
      );
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return t(
        "Another app may be using the microphone or camera. Close it and try again.",
        "قد يستخدم تطبيق آخر الميكروفون أو الكاميرا. أغلقه ثم حاول مرة أخرى.",
      );
    }
    return t("Could not start the microphone or camera.", "تعذّر تشغيل الميكروفون أو الكاميرا.");
  }

  async function acquireMedia(callType, facing = "user") {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(t("This device does not expose camera or microphone access.", "هذا الجهاز لا يتيح الوصول إلى الكاميرا أو الميكروفون."));
    }
    const wantVideo = callType === "video";
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: wantVideo
          ? {
              facingMode: facing || "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : false,
      });
    } catch (error) {
      const blocked = ["NotAllowedError", "SecurityError", "PermissionDeniedError"].includes(
        String(error?.name || ""),
      );
      if (wantVideo && !blocked) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          toast(
            t(
              "The camera is unavailable, so the call started with audio only.",
              "الكاميرا غير متاحة، لذلك بدأت المكالمة بالصوت فقط.",
            ),
          );
        } catch (audioError) {
          throw new Error(mediaErrorMessage(audioError));
        }
      } else {
        throw new Error(mediaErrorMessage(error));
      }
    }
    const audioTrack = stream.getAudioTracks()[0] || null;
    if (!audioTrack) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error(t("No microphone is available.", "لا يوجد ميكروفون متاح."));
    }
    const videoTrack = stream.getVideoTracks()[0] || null;
    return { stream, audioTrack, videoTrack };
  }

  function withTimeout(promise, ms) {
    let timer = 0;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]).finally(() => {
      if (timer) window.clearTimeout(timer);
    });
  }

  async function getIceServers() {
    const base = core ? core.defaultIceServers() : [{ urls: ["stun:stun.l.google.com:19302"] }];
    const client = sb();
    if (!client || !client.functions || typeof client.functions.invoke !== "function") {
      S.turnConfigured = false;
      S.turnWarning = t(
        "TURN is not configured. Calls may fail on strict networks.",
        "لم يتم إعداد TURN. قد تفشل المكالمات على الشبكات الصارمة.",
      );
      return { iceServers: base, configured: false, warning: S.turnWarning };
    }
    try {
      const response = await withTimeout(
        client.functions.invoke("turn-credentials", { body: { purpose: "team-call" } }),
        7000,
      );
      const data = response?.data;
      if (!response?.error && data && Array.isArray(data.iceServers)) {
        S.turnConfigured = data.configured !== false;
        S.turnWarning = data.warning || "";
        return {
          iceServers: core ? core.mergeIceServers(data.iceServers, base) : data.iceServers,
          configured: S.turnConfigured,
          warning: S.turnWarning,
        };
      }
    } catch (error) {
      console.warn("TURN credential function is unavailable.", error);
    }
    S.turnConfigured = false;
    S.turnWarning = t(
      "TURN is not configured. Calls may fail on strict NAT or mobile networks.",
      "لم يتم إعداد TURN. قد تفشل المكالمات على شبكات NAT الصارمة أو شبكات الهاتف.",
    );
    return { iceServers: base, configured: false, warning: S.turnWarning };
  }

  function callSupportStatus() {
    return core
      ? core.callSupport({
          hasRTCPeerConnection: Boolean(window.RTCPeerConnection),
          hasMediaDevices: Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
          secureContext: Boolean(window.isSecureContext),
          protocol: window.location.protocol,
          hostname: window.location.hostname,
        })
      : { supported: Boolean(window.RTCPeerConnection), reason: "" };
  }

  function supportMessage(reason) {
    if (reason === "insecure") {
      return t(
        "Calls need HTTPS (or the Android app). Open Study Zone over a secure connection.",
        "تحتاج المكالمات إلى HTTPS (أو تطبيق أندرويد). افتح Study Zone عبر اتصال آمن.",
      );
    }
    if (reason === "media") {
      return t("This browser does not expose microphone or camera access.", "هذا المتصفح لا يتيح الوصول إلى الميكروفون أو الكاميرا.");
    }
    return t("This browser does not support WebRTC calls.", "هذا المتصفح لا يدعم مكالمات WebRTC.");
  }

  // -------------------------------------------------------------------------
  // Starting and joining calls
  // -------------------------------------------------------------------------

  async function findLiveCalls() {
    const client = sb();
    if (!client || !S.teamId) return [];
    try {
      const { data, error } = await client
        .from("team_calls")
        .select("id,status,call_type,scope,created_by,conversation_id,title,created_at")
        .eq("team_id", S.teamId)
        .in("status", ["ringing", "active"])
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    } catch (error) {
      if (!isMissingRpc(error)) console.warn("Could not check for live calls.", error);
      return [];
    }
  }

  async function loadCallRow(callId) {
    const client = sb();
    if (!client || !callId) return null;
    const { data, error } = await client
      .from("team_calls")
      .select("*")
      .eq("id", callId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function loadCallParticipants(callId) {
    const client = sb();
    if (!client || !callId) return [];
    const { data, error } = await client
      .from("team_call_participants")
      .select(
        "call_id,user_id,role,invite_status,mic_on,camera_on,screen_sharing,joined_at,left_at,last_seen_at,connection_state",
      )
      .eq("call_id", callId);
    if (error) throw error;
    return data || [];
  }

  async function ensureNoDuplicateCall() {
    const live = await findLiveCalls();
    if (!live.length) return true;
    const existing = live[0];
    const join = window.confirm(
      t(
        "A call is already in progress in this team. Join it instead of starting another one?",
        "هناك مكالمة جارية بالفعل في هذا الفريق. هل تريد الانضمام إليها بدل بدء مكالمة أخرى؟",
      ),
    );
    if (join) await joinExistingCall(existing.id);
    return false;
  }

  async function sendCallPush(callId, extra = {}) {
    const client = sb();
    if (!client || !callId || !client.functions || typeof client.functions.invoke !== "function") return;
    try {
      await client.functions.invoke("team-live-call-push", {
        body: { call_id: String(callId), ...extra },
      });
    } catch (error) {
      console.warn("Could not dispatch call push notification.", error);
    }
  }

  async function startCall({ callType = "video", scope = "group", inviteeIds = [], taskId = null, conversationId = null, title = null }) {
    const client = sb();
    const user = me();
    if (!client || !user) {
      toast(t("Sign in to start a call.", "سجّل الدخول لبدء مكالمة."));
      return;
    }
    if (S.call) {
      toast(t("You are already in a call.", "أنت بالفعل في مكالمة."));
      return;
    }
    const support = callSupportStatus();
    if (!support.supported) {
      toast(supportMessage(support.reason));
      return;
    }
    if (!S.teamId) return;
    if (!(await ensureNoDuplicateCall())) return;
    if (scope === "direct" && inviteeIds.length !== 1) {
      toast(t("Choose one teammate for a direct call.", "اختر زميلًا واحدًا للمكالمة المباشرة."));
      return;
    }
    if (scope === "group" && !inviteeIds.length) {
      toast(t("Choose at least one teammate.", "اختر زميلًا واحدًا على الأقل."));
      return;
    }

    let media;
    try {
      media = await acquireMedia(callType);
    } catch (error) {
      toast(error.message || mediaErrorMessage(error));
      return;
    }

    let callId;
    try {
      const ice = await getIceServers();
      callId = await rpc("team_live_start_call", {
        p_team_id: S.teamId,
        p_call_type: callType,
        p_scope: scope,
        p_invitee_ids: inviteeIds,
        p_invite_all: false,
        p_task_id: taskId || null,
        p_title: title || null,
        p_conversation_id: conversationId || null,
      });
      const row = await loadCallRow(callId);
      if (!row) throw new Error(t("The call could not be created.", "تعذّر إنشاء المكالمة."));
      console.info('[team-live][call]', { event: 'start', callId: String(callId), status: row?.status, type: callType, scope });
      setupCall(row, media, ice);
      void sendCallPush(callId, { call_type: callType, scope, title: title || null });
      toast(
        scope === "direct"
          ? t("Calling…", "جارٍ الاتصال…")
          : t("Call started. Waiting for teammates.", "بدأت المكالمة. في انتظار الزملاء."),
      );
    } catch (error) {
      media.stream.getTracks().forEach((track) => track.stop());
      if (callId) {
        void rpc("team_live_end_call", { p_call_id: callId }).catch(() => {
          void rpc("team_live_leave_call", { p_call_id: callId }).catch(() => {});
        });
        markCallEnded(callId);
      }
      if (isMissingRpc(error)) {
        S.migrationMissing = true;
        renderSidebar();
        toast(
          t(
            "Apply supabase/migrations/006_team_live_communication.sql to enable calls.",
            "طبّق supabase/migrations/006_team_live_communication.sql لتفعيل المكالمات.",
          ),
        );
      } else {
        notifyError(t("Could not start the call.", "تعذّر بدء المكالمة."), error);
      }
    }
  }

  async function startDirectCall(userId, callType = "video") {
    if (!userId || String(userId) === myId()) return;
    if (!S.teamId) return;
    if (!teamMembersOf(S.teamId).includes(String(userId))) {
      toast(t("That person is not in this team.", "هذا الشخص ليس في هذا الفريق."));
      return;
    }
    await startCall({
      callType,
      scope: "direct",
      inviteeIds: [String(userId)],
      conversationId: null,
    });
  }

  async function startCallHere(callType) {
    const conversation = activeConversation();
    if (!conversation) {
      openCallSheet({ scope: "group" });
      return;
    }
    if (conversation.kind === "direct") {
      await startCall({
        callType,
        scope: "direct",
        inviteeIds: [String(conversation.participant_id)],
        conversationId: conversation.conversation_id,
      });
      return;
    }
    const members = sheetMembers({ taskId: conversation.task_id });
    if (members.length && members.length <= 7) {
      await startCall({
        callType,
        scope: "group",
        inviteeIds: members,
        taskId: conversation.task_id || null,
        conversationId: conversation.conversation_id,
        title: conversation.kind === "task" ? conversation.task_title || conversation.title : null,
      });
      return;
    }
    openCallSheet({
      scope: "group",
      conversationId: conversation.conversation_id,
      taskId: conversation.task_id || null,
      title: conversation.kind === "task" ? conversation.task_title || conversation.title : "",
    });
  }

  async function joinExistingCall(callId) {
    const id = String(callId || "");
    if (!id) return;
    if (isCallKnownEnded(id)) {
      toast(t("This call has ended.", "انتهت هذه المكالمة."));
      return;
    }
    if (S.call) {
      if (String(S.call.id) === String(callId)) return;
      toast(t("Finish the current call first.", "أنهِ المكالمة الحالية أولًا."));
      return;
    }
    const support = callSupportStatus();
    if (!support.supported) {
      toast(supportMessage(support.reason));
      return;
    }
    let media;
    try {
      const row = await loadCallRow(id);
      console.info('[team-live][call]', { event: 'join-check', callId: id, status: row?.status });
      if (!row) throw new Error(t("Call not found.", "لم يتم العثور على المكالمة."));
      if (String(row.status) === "ended") {
        markCallEnded(id);
        toast(t("This call has ended.", "انتهت هذه المكالمة."));
        return;
      }
      media = await acquireMedia(row.call_type);
      await rpc("team_live_join_call", { p_call_id: id });
      const fresh = await loadCallRow(id);
      if (!fresh || String(fresh.status) === "ended") {
        if (fresh || id) markCallEnded(id);
        media.stream.getTracks().forEach((track) => track.stop());
        toast(t("This call has ended.", "انتهت هذه المكالمة."));
        return;
      }
      const ice = await getIceServers();
      setIncomingCall(null);
      setupCall(fresh, media, ice);
    } catch (error) {
      media?.stream.getTracks().forEach((track) => track.stop());
      notifyError(t("Could not join the call.", "تعذّر الانضمام إلى المكالمة."), error);
    }
  }

  // -------------------------------------------------------------------------
  // Call state
  // -------------------------------------------------------------------------

  function setupCall(row, media, ice) {
    const client = sb();
    if (!client) return;
    console.info('[team-live][call]', { event: 'setup', callId: String(row?.id||''), status: row?.status });
    teardownCall();
    S.call = {
      ...row,
      iceServers: ice.iceServers,
      turnConfigured: ice.configured,
      turnWarning: ice.warning,
      audioTrack: media.audioTrack,
      videoTrack: media.videoTrack,
      localStream: media.stream,
      peers: new Map(),
      seenSignals: new Set(),
      lastSignalId: 0,
      participants: [],
      open: true,
      minimized: false,
      chatOpen: false,
      muted: false,
      cameraOn: Boolean(media.videoTrack),
      screenStream: null,
      screenSharing: false,
      facing: "user",
      connectedIds: new Set(),
      quality: "unknown",
      stageSignature: "",
      noAnswerTimer: 0,
      timer: 0,
      statsTimer: 0,
      signalPoll: 0,
      participantsPoll: 0,
      heartbeat: 0,
      statsBusy: false,
      ending: false,
      channels: [],
      audioCtx: null,
      analyser: null,
      analyserData: null,
  };
    S.callChatMessages = [];
    S.callChatDraft = "";
    document.body.classList.add("live-call-active");

    ensureSelfParticipant();
    openCallUi();
    startCallTimers();
    subscribeCallSignals();
    subscribeCallParticipants();
    subscribeCallChat();
    startLocalMeter();
    void refreshParticipants();
    void loadCallChat();
  }

  function ensureSelfParticipant() {
    const call = S.call;
    if (!call) return;
    const id = myId();
    let row = call.participants.find((item) => String(item.user_id) === id);
    if (!row) {
      row = {
        call_id: call.id,
        user_id: id,
        role: "host",
        invite_status: "accepted",
        mic_on: true,
        camera_on: Boolean(call.cameraOn),
        screen_sharing: false,
        joined_at: new Date().toISOString(),
        left_at: null,
      };
      call.participants.push(row);
    }
    return row;
  }

  function acceptedParticipants() {
    const call = S.call;
    if (!call) return [];
    const rows = call.participants.filter(
      (row) => row.invite_status === "accepted" && !row.left_at,
    );
    const self = ensureSelfParticipant();
    if (self) self.mic_on = !call.muted;
    if (self) self.camera_on = Boolean(call.cameraOn);
    if (self) self.screen_sharing = Boolean(call.screenSharing);
    if (!rows.some((row) => String(row.user_id) === myId()) && self) rows.unshift(self);
    return rows;
  }

  async function refreshParticipants() {
    const call = S.call;
    if (!call) return;
    try {
      const rows = await loadCallParticipants(call.id);
      if (!S.call || String(S.call.id) !== String(call.id)) return;
      call.participants = rows;
      ensureSelfParticipant();
      const accepted = acceptedParticipants();
      const signature = accepted.map((row) => String(row.user_id)).sort().join(",");
      if (signature !== call.stageSignature) {
        call.stageSignature = signature;
        renderCallStage();
      } else {
        updateTileFlags();
      }
      const activeIds = new Set(accepted.map((row) => String(row.user_id)));
      for (const id of activeIds) {
        if (id !== myId()) ensurePeer(id);
      }
      for (const id of Array.from(call.peers.keys())) {
        if (!activeIds.has(String(id))) closePeer(id);
      }
      if (accepted.some((row) => String(row.user_id) !== myId())) {
        if (call.noAnswerTimer) {
          window.clearTimeout(call.noAnswerTimer);
          call.noAnswerTimer = 0;
        }
      }
      updateCallHeader();
    } catch (error) {
      console.warn("Could not refresh call participants.", error);
    }
  }

  // -------------------------------------------------------------------------
  // Peer connections and signaling
  // -------------------------------------------------------------------------

  function ensurePeer(remoteId) {
    const call = S.call;
    if (!call || !remoteId || String(remoteId) === myId()) return null;
    const id = String(remoteId);
    if (call.peers.has(id)) return call.peers.get(id);
    let pc;
    try {
      pc = new RTCPeerConnection({
        iceServers: call.iceServers,
        iceCandidatePoolSize: 4,
        bundlePolicy: "max-bundle",
      });
    } catch (error) {
      console.error("Could not create a peer connection.", error);
      return null;
    }
    const peer = {
      uid: id,
      pc,
      polite: core ? !core.shouldInitiate(myId(), id) : myId() > id,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
      suppressNegotiation: false,
      pendingCandidates: [],
      remoteStream: new MediaStream(),
      audioSender: null,
      videoSender: null,
      quality: "unknown",
      restarts: 0,
      reconnectTimer: 0,
      connected: false,
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void sendSignal("ice", candidateJson(event.candidate), id);
      }
    };
    pc.ontrack = (event) => {
      const stream = event.streams && event.streams[0];
      if (stream) {
        for (const track of stream.getTracks()) {
          if (!peer.remoteStream.getTracks().some((item) => item.id === track.id)) {
            peer.remoteStream.addTrack(track);
          }
        }
      } else if (event.track) {
        peer.remoteStream.addTrack(event.track);
      }
      attachRemoteStream(id, peer.remoteStream);
    };
    pc.onnegotiationneeded = async () => {
      if (!S.call || S.call !== call || peer.suppressNegotiation) return;
      if (pc.signalingState !== "stable") return;
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        await sendSignal("offer", descriptionJson(pc.localDescription), id);
      } catch (error) {
        console.warn("Could not create a WebRTC offer.", error);
      } finally {
        peer.makingOffer = false;
      }
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        peer.connected = true;
        peer.restarts = 0;
        call.connectedIds.add(id);
        updateCallHeader();
        renderCallStage();
      } else if (state === "failed") {
        peer.connected = false;
        call.connectedIds.delete(id);
        peer.restarts += 1;
        if (peer.restarts <= 3) {
          try {
            pc.restartIce();
          } catch {
            /* ignore */
          }
        } else {
          closePeer(id);
          renderCallStage();
        }
      } else if (state === "disconnected") {
        if (peer.reconnectTimer) window.clearTimeout(peer.reconnectTimer);
        peer.reconnectTimer = window.setTimeout(() => {
          if (S.call === call && pc.connectionState === "disconnected") {
            try {
              pc.restartIce();
            } catch {
              /* ignore */
            }
          }
        }, 6000);
      } else if (state === "closed") {
        peer.connected = false;
        call.connectedIds.delete(id);
      }
      updateCallHeader();
    };

    try {
      if (call.audioTrack) {
        peer.audioSender = pc.addTrack(call.audioTrack, call.localStream);
      }
      if (call.videoTrack) {
        peer.videoSender = pc.addTrack(call.videoTrack, call.localStream);
      }
      if (call.screenStream) {
        const screenTrack = call.screenStream.getVideoTracks()[0];
        if (screenTrack) {
          if (peer.videoSender) awaitReplace(peer.videoSender, screenTrack);
          else peer.videoSender = pc.addTrack(screenTrack, call.localStream);
        }
      }
    } catch (error) {
      console.warn("Could not attach local media to the peer.", error);
    }

    call.peers.set(id, peer);
    return peer;
  }

  function awaitReplace(sender, track) {
    try {
      const result = sender.replaceTrack(track);
      if (result && typeof result.catch === "function") result.catch(() => {});
    } catch {
      /* ignore */
    }
  }

  async function replaceVideoForAll(track) {
    const call = S.call;
    if (!call) return;
    for (const peer of call.peers.values()) {
      if (peer.videoSender) {
        try {
          await peer.videoSender.replaceTrack(track);
        } catch (error) {
          console.warn("Could not replace the outgoing video track.", error);
        }
      } else if (track) {
        try {
          peer.videoSender = peer.pc.addTrack(track, call.localStream);
        } catch (error) {
          console.warn("Could not add the outgoing video track.", error);
        }
      }
    }
  }

  function closePeer(remoteId) {
    const call = S.call;
    if (!call) return;
    const peer = call.peers.get(String(remoteId));
    if (!peer) return;
    if (peer.reconnectTimer) window.clearTimeout(peer.reconnectTimer);
    try {
      peer.pc.onicecandidate = null;
      peer.pc.ontrack = null;
      peer.pc.onnegotiationneeded = null;
      peer.pc.onconnectionstatechange = null;
      peer.pc.close();
    } catch {
      /* ignore */
    }
    call.peers.delete(String(remoteId));
    call.connectedIds.delete(String(remoteId));
    updateCallHeader();
  }

  async function sendSignal(type, payload, toUserId) {
    const call = S.call;
    const client = sb();
    if (!call || !client) return;
    try {
      const { error } = await client.from("team_call_signals").insert({
        call_id: call.id,
        from_user_id: myId(),
        to_user_id: toUserId || null,
        signal_type: type,
        payload: payload || {},
      });
      if (error) console.warn("Could not send a call signal.", error);
    } catch (error) {
      console.warn("Could not send a call signal.", error);
    }
  }

  async function flushCandidates(peer) {
    if (!peer || !peer.pc.remoteDescription) return;
    while (peer.pendingCandidates.length) {
      const candidate = peer.pendingCandidates.shift();
      try {
        await peer.pc.addIceCandidate(candidate);
      } catch (error) {
        if (!peer.ignoreOffer) console.warn("Could not apply an ICE candidate.", error);
      }
    }
  }

  async function processSignal(row) {
    const call = S.call;
    if (!call || !row || row.id == null) return;
    const signalId = String(row.id);
    if (call.seenSignals.has(signalId)) return;
    call.seenSignals.add(signalId);
    const from = String(row.from_user_id || "");
    if (!from || from === myId()) return;
    if (row.to_user_id && String(row.to_user_id) !== myId()) return;
    if (row.signal_type === "bye") {
      closePeer(from);
      return;
    }
    const peer = ensurePeer(from);
    if (!peer) return;
    if (row.signal_type === "ice") {
      let candidate = row.payload;
      if (candidate && candidate.candidate && typeof candidate.candidate === "object") {
        candidate = candidate.candidate;
      }
      if (!candidate || !candidate.candidate) return;
      if (peer.pc.remoteDescription && peer.pc.remoteDescription.type) {
        try {
          await peer.pc.addIceCandidate(candidate);
        } catch (error) {
          if (!peer.ignoreOffer) console.warn("Could not add an ICE candidate.", error);
        }
      } else {
        peer.pendingCandidates.push(candidate);
      }
      return;
    }
    if (row.signal_type === "offer" || row.signal_type === "answer") {
      const description = row.payload && row.payload.type ? row.payload : row.payload?.description;
      if (!description || !description.type) return;
      if (description.type === "offer") peer.suppressNegotiation = true;
      const pc = peer.pc;
      const readyForOffer =
        !peer.makingOffer &&
        (pc.signalingState === "stable" || peer.isSettingRemoteAnswerPending);
      const offerCollision = description.type === "offer" && !readyForOffer;
      peer.ignoreOffer = !peer.polite && offerCollision;
      if (peer.ignoreOffer) {
        peer.suppressNegotiation = false;
        return;
      }
      peer.isSettingRemoteAnswerPending = description.type === "answer";
      try {
        await pc.setRemoteDescription(description);
        peer.isSettingRemoteAnswerPending = false;
        if (description.type === "offer") {
          await pc.setLocalDescription();
          await sendSignal("answer", descriptionJson(pc.localDescription), from);
          peer.suppressNegotiation = false;
        }
        await flushCandidates(peer);
      } catch (error) {
        peer.suppressNegotiation = false;
        console.warn("Could not apply a call description.", error);
      }
      return;
    }
    if (row.signal_type === "restart") {
      try {
        peer.pc.restartIce();
      } catch {
        /* ignore */
      }
    }
  }

  async function fetchSignals() {
    const call = S.call;
    const client = sb();
    if (!call || !client) return;
    try {
      let query = client
        .from("team_call_signals")
        .select("id,from_user_id,to_user_id,signal_type,payload")
        .eq("call_id", call.id)
        .order("id", { ascending: true })
        .limit(200);
      if (call.lastSignalId) query = query.gt("id", call.lastSignalId);
      const { data, error } = await query;
      if (error) throw error;
      for (const row of data || []) {
        call.lastSignalId = Math.max(call.lastSignalId, Number(row.id) || 0);
        await processSignal(row);
      }
    } catch (error) {
      if (!isMissingRpc(error)) console.warn("Could not fetch call signals.", error);
    }
  }

  function subscribeCallSignals() {
    const call = S.call;
    const client = sb();
    if (!call || !client) return;
    void fetchSignals();
    try {
      const channel = client
        .channel(`team-live-signals-${call.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "team_call_signals",
            filter: `call_id=eq.${call.id}`,
          },
          (payload) => {
            if (payload?.new) void processSignal(payload.new);
          },
        )
        .subscribe();
      call.channels.push(channel);
    } catch (error) {
      console.warn("Could not subscribe to call signals.", error);
    }
  }

  function subscribeCallParticipants() {
    const call = S.call;
    const client = sb();
    if (!call || !client) return;
    try {
      const channel = client
        .channel(`team-live-call-${call.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "team_call_participants",
            filter: `call_id=eq.${call.id}`,
          },
          () => void refreshParticipants(),
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "team_calls",
            filter: `id=eq.${call.id}`,
          },
          (payload) => {
            if (payload?.new?.status === "ended" && S.call && String(S.call.id) === String(call.id)) {
              console.info('[team-live][call]', { event: 'remote-ended', callId: String(call.id), status: payload?.new?.status });
              markCallEnded(call.id);
              teardownCall();
              updateLiveBadge();
              toast(t("Call ended for everyone.", "انتهت المكالمة للجميع."));
              void loadConversations();
            }
          },
        )
        .subscribe();
      call.channels.push(channel);
    } catch (error) {
      console.warn("Could not subscribe to call status.", error);
    }
  }

  function subscribeCallChat() {
    const call = S.call;
    const client = sb();
    if (!call || !client || !call.conversation_id) return;
    try {
      const channel = client
        .channel(`team-live-call-chat-${call.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "team_messages",
            filter: `conversation_id=eq.${call.conversation_id}`,
          },
          (payload) => {
            if (payload?.new) upsertCallChatMessage(payload.new);
          },
        )
        .subscribe();
      call.channels.push(channel);
    } catch (error) {
      console.warn("Could not subscribe to the in-call chat.", error);
    }
  }

  // -------------------------------------------------------------------------
  // Call timers, stats, quality and speaking
  // -------------------------------------------------------------------------

  function startCallTimers() {
    const call = S.call;
    if (!call) return;
    call.timer = window.setInterval(updateCallTimer, 1000);
    call.statsTimer = window.setInterval(() => void collectCallStats(), 2500);
    call.signalPoll = window.setInterval(() => void fetchSignals(), 4000);
    call.participantsPoll = window.setInterval(() => {
      if (!document.hidden) void refreshParticipants();
    }, 6000);
    call.heartbeat = window.setInterval(() => {
      if (!S.call) return;
      const callId = S.call.id;
      sb()
        ?.from("team_call_participants")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("call_id", callId)
        .eq("user_id", myId())
        .then(() => {})
        .catch(() => {});
      void rpc("team_live_prune_signals", { p_call_id: callId }).catch(() => {});
    }, 20000);
    if (String(call.scope) === "direct") {
      call.noAnswerTimer = window.setTimeout(() => {
        if (!S.call || String(S.call.id) !== String(call.id)) return;
        const answered = S.call.participants.some((row) => String(row.user_id) !== myId() && row.invite_status === "accepted" && !row.left_at);
        if (answered) return;
        toast(t("No answer.", "لا يوجد رد."));
        void endCall({ force: true, silent: false, source: "timeout" });
      }, 45000);
    }
  }

  function updateCallTimer() {
    const call = S.call;
    if (!call) return;
    const host = document.querySelector("[data-live-timer]");
    if (!host) return;
    const start = call.connected_at
      ? new Date(call.connected_at).getTime()
      : call.connectedIds.size
        ? Date.now()
        : 0;
    const seconds = start ? Math.max(0, (Date.now() - start) / 1000) : 0;
    host.textContent = core ? core.formatDuration(seconds) : `${Math.floor(seconds)}s`;
  }

  function localAudioLevel() {
    const call = S.call;
    if (!call || !call.analyser || call.muted) return 0;
    try {
      call.analyser.getByteTimeDomainData(call.analyserData);
      let sum = 0;
      for (const value of call.analyserData) {
        const normalized = (value - 128) / 128;
        sum += normalized * normalized;
      }
      return Math.sqrt(sum / call.analyserData.length);
    } catch {
      return 0;
    }
  }

  function startLocalMeter() {
    const call = S.call;
    if (!call || !call.audioTrack) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const context = new Ctx();
      const source = context.createMediaStreamSource(new MediaStream([call.audioTrack]));
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      call.audioCtx = context;
      call.analyser = analyser;
      call.analyserData = new Uint8Array(analyser.fftSize);
      if (context.state === "suspended") void context.resume().catch(() => {});
    } catch (error) {
      console.warn("Could not start the local audio meter.", error);
    }
  }

  function setTileSpeaking(userId, speaking) {
    const tile = document.querySelector(
      `[data-live-tile="${String(userId).replace(/"/g, "")}"]`,
    );
    if (tile) tile.classList.toggle("speaking", Boolean(speaking));
  }

  async function collectCallStats() {
    const call = S.call;
    if (!call || call.statsBusy) return;
    call.statsBusy = true;
    try {
      let worst = "unknown";
      const order = { unknown: 0, good: 1, fair: 2, poor: 3 };
      setTileSpeaking(myId(), localAudioLevel() > 0.045);
      for (const [id, peer] of call.peers) {
        let sample = null;
        let audioLevel = 0;
        let rtt = 0;
        try {
          const stats = await peer.pc.getStats();
          stats.forEach((report) => {
            if (report.type === "inbound-rtp" && !report.isRemote) {
              const kind = report.kind || report.mediaType;
              if (kind === "video" && !sample) sample = report;
              if (kind === "audio") {
                audioLevel = Math.max(audioLevel, Number(report.audioLevel || 0));
              }
            }
            if (report.type === "candidate-pair" && (report.state === "succeeded" || report.nominated)) {
              rtt = Math.max(rtt, Number(report.currentRoundTripTime || 0));
            }
          });
          if (!sample) {
            stats.forEach((report) => {
              if (!sample && report.type === "inbound-rtp" && !report.isRemote) sample = report;
            });
          }
        } catch {
          /* ignore */
        }
        const quality = core
          ? core.qualityFromSample(
              sample
                ? {
                    packetsReceived: sample.packetsReceived,
                    packetsLost: sample.packetsLost,
                    jitter: sample.jitter,
                    rtt: rtt * 1000,
                  }
                : null,
            )
          : "unknown";
        peer.quality = quality;
        if (order[quality] > order[worst]) worst = quality;
        const row = call.participants.find((item) => String(item.user_id) === String(id));
        setTileSpeaking(id, audioLevel > 0.02 && row?.mic_on !== false);
      }
      call.quality = worst;
      updateCallHeader();
    } finally {
      call.statsBusy = false;
    }
  }

  function qualityLabel(quality) {
    if (quality === "good") return t("Good", "جيدة");
    if (quality === "fair") return t("Fair", "متوسطة");
    if (quality === "poor") return t("Poor", "ضعيفة");
    return t("Checking…", "جارٍ الفحص…");
  }

  function callStatusLabel() {
    const call = S.call;
    if (!call) return t("Ended", "انتهت");
    if (call.connectedIds.size > 0) return t("Connected", "متصل");
    const others = call.participants.filter(
      (row) => String(row.user_id) !== myId() && row.invite_status === "accepted" && !row.left_at,
    );
    if (call.status === "active" || others.length) return t("Connecting…", "جارٍ الاتصال…");
    return t("Ringing…", "يرن…");
  }

  function updateCallHeader() {
    const call = S.call;
    if (!call) return;
    const status = document.querySelector("[data-live-call-status]");
    if (status) status.textContent = callStatusLabel();
    const quality = document.querySelector("[data-live-quality]");
    if (quality) {
      quality.textContent =
        call.connectedIds.size > 0
          ? `${t("Quality", "الجودة")}: ${qualityLabel(call.quality)}`
          : "";
    }
    updateCallControls();
  }

  // -------------------------------------------------------------------------
  // Call UI
  // -------------------------------------------------------------------------

  function callTitle() {
    const call = S.call;
    if (!call) return t("Call", "مكالمة");
    if (call.title) return call.title;
    const conversation = conversationById(call.conversation_id);
    if (conversation) return conversationTitle(conversation);
    return teamById(call.team_id)?.name || t("Team call", "مكالمة الفريق");
  }

  function openCallUi() {
    const root = document.getElementById("team-live-call-root");
    if (!root || !S.call) return;
    root.innerHTML = callOverlayMarkup();
    renderCallStage();
    renderCallChat();
    updateCallHeader();
    updateCallTimer();
  }

  function callOverlayMarkup() {
    const call = S.call;
    if (!call) return "";
    const group = call.scope !== "direct";
    return `<div class="live-call-overlay ${call.minimized ? "minimized" : ""}" role="dialog" aria-label="${esc(callTitle())}">
      <header class="live-call-head">
        <div class="live-call-meta">
          <span class="live-call-pulse" aria-hidden="true"></span>
          <div>
            <strong data-live-call-title dir="auto">${esc(callTitle())}</strong>
            <small><span data-live-call-status>${esc(callStatusLabel())}</span> · <span data-live-timer>00:00</span><span class="live-quality" data-live-quality></span></small>
          </div>
        </div>
        <div class="live-call-head-actions">
          <button type="button" class="live-icon-button" data-live-action="toggle-call-minimize" aria-label="${esc(t("Minimize call", "تصغير المكالمة"))}" title="${esc(t("Minimize", "تصغير"))}">▁</button>
          <button type="button" class="live-icon-button danger" data-live-action="end-call" aria-label="${esc(t("End call", "إنهاء المكالمة"))}" title="${esc(t("End call", "إنهاء المكالمة"))}">×</button>
        </div>
      </header>
      <div class="live-call-body">
        <div class="live-video-grid" data-live-grid></div>
        <aside class="live-call-chat ${call.chatOpen ? "open" : ""}" data-live-call-chat>
          <header>
            <strong>${esc(t("In-call chat", "محادثة أثناء المكالمة"))}</strong>
            <button type="button" class="live-icon-button live-icon-button-small" data-live-action="toggle-call-chat" aria-label="${esc(t("Close chat", "إغلاق المحادثة"))}">×</button>
          </header>
          <div class="live-call-messages" data-live-call-messages></div>
          <form class="live-call-chat-form" data-live-form="call-chat">
            <input type="text" name="body" maxlength="1000" data-live-input="call-chat" value="${esc(S.callChatDraft || "")}" placeholder="${esc(t("Message the call…", "راسل المكالمة…"))}" autocomplete="off" />
            <button type="submit" class="button button-primary button-small">${esc(t("Send", "إرسال"))}</button>
          </form>
        </aside>
      </div>
      <footer class="live-call-controls">
        <button type="button" class="live-control" data-live-action="toggle-mute" data-live-mute aria-pressed="${call.muted}" title="${esc(t("Mute", "كتم"))}"><span>${call.muted ? "🔇" : "🎙"}</span><small>${esc(call.muted ? t("Unmute", "إلغاء الكتم") : t("Mute", "كتم"))}</small></button>
        <button type="button" class="live-control" data-live-action="toggle-camera" data-live-camera aria-pressed="${call.cameraOn}" title="${esc(t("Camera", "الكاميرا"))}"><span>${call.cameraOn ? "▣" : "▢"}</span><small>${esc(call.cameraOn ? t("Camera off", "إيقاف الكاميرا") : t("Camera on", "تشغيل الكاميرا"))}</small></button>
        <button type="button" class="live-control" data-live-action="switch-camera" data-live-switch title="${esc(t("Switch camera", "تبديل الكاميرا"))}"><span>⇄</span><small>${esc(t("Flip", "تبديل"))}</small></button>
        <button type="button" class="live-control" data-live-action="toggle-screen-share" data-live-screen aria-pressed="${call.screenSharing}" title="${esc(t("Share screen", "مشاركة الشاشة"))}"><span>▤</span><small>${esc(call.screenSharing ? t("Stop share", "إيقاف المشاركة") : t("Share", "مشاركة"))}</small></button>
        ${group ? `<button type="button" class="live-control" data-live-action="open-add-member" title="${esc(t("Add member", "إضافة عضو"))}"><span>＋</span><small>${esc(t("Add", "إضافة"))}</small></button>` : ""}
        <button type="button" class="live-control" data-live-action="toggle-call-chat" data-live-chat-toggle aria-pressed="${call.chatOpen}" title="${esc(t("Chat", "المحادثة"))}"><span>💬</span><small>${esc(t("Chat", "المحادثة"))}</small></button>
        <button type="button" class="live-control danger" data-live-action="end-call" title="${esc(t("End call", "إنهاء المكالمة"))}"><span>☎</span><small>${esc(t("End", "إنهاء"))}</small></button>
      </footer>
      ${
        call.turnConfigured === false
          ? `<p class="live-turn-warning">${esc(
              call.turnWarning ||
                t(
                  "TURN is not configured. Calls may fail on strict NAT or mobile networks.",
                  "لم يتم إعداد TURN. قد تفشل المكالمات على شبكات NAT الصارمة أو شبكات الهاتف.",
                ),
            )}</p>`
          : ""
      }
    </div>`;
  }

  function tileMarkup(row, opts = {}) {
    const call = S.call;
    const id = String(row.user_id);
    const self = id === myId();
    const name = `${memberName(id)}${self ? ` ${t("(you)", "(أنت)")}` : ""}`;
    const cameraOff = !row.camera_on && call.call_type === "video";
    const isAudio = call.call_type === "audio";
    const speaking = Boolean(call.speakingIds?.has(id));
    const mirrorSelf = self && !isAudio && !call.screenSharing && call.facing !== "environment" && call.cameraOn;
    const classes = [
      "live-tile",
      self ? "self-tile" : "remote-tile",
      cameraOff ? "camera-off" : "",
      isAudio ? "audio-tile" : "",
      mirrorSelf ? "mirror-self" : "",
      opts.main ? "main-tile" : "",
      opts.pip ? "pip-tile" : "",
      speaking ? "speaking" : "",
    ].filter(Boolean).join(" ");
    return `<div class="${classes}" data-live-tile="${esc(id)}" data-self="${self ? "1" : "0"}">
      <video autoplay playsinline ${self ? "muted" : ""}></video>
      <div class="live-tile-avatar">${memberAvatar(id, "team-avatar")}</div>
      <span class="live-tile-name" dir="auto">${esc(name)}</span>
      <span class="live-tile-mic" data-live-tile-mic>${row.mic_on === false ? "🔇" : ""}</span>
      ${row.screen_sharing ? `<span class="live-tile-share">${esc(t("Screen", "الشاشة"))}</span>` : ""}
    </div>`;
  }

  function renderCallStage() {
    const call = S.call;
    const host = document.querySelector("[data-live-grid]");
    if (!call || !host) return;
    const rows = acceptedParticipants()
      .slice()
      .sort((a, b) => (String(a.user_id) === myId() ? 1 : 0) - (String(b.user_id) === myId() ? 1 : 0));
    const isAudio = call.call_type === "audio";
    const focusLayout = !isAudio && rows.length === 2;
    host.className = `live-video-grid count-${Math.min(rows.length, 6)} ${isAudio ? "audio-only" : ""} ${focusLayout ? "focus-layout" : ""}`;
    if (focusLayout) {
      const remote = rows.find((r) => String(r.user_id) !== myId()) || rows[0];
      const self = rows.find((r) => String(r.user_id) === myId()) || rows[1];
      host.innerHTML = [tileMarkup(remote, { main: true }), tileMarkup(self, { pip: true })].join("");
    } else {
      host.innerHTML = rows.map((row) => tileMarkup(row)).join("");
    }
    attachTileStreams();
    initPipDrag(host);
    updateCallHeader();
  }

  function attachTileStreams() {
    const call = S.call;
    if (!call) return;
    const localVideo = document.querySelector(`[data-live-tile="${myId()}"] video`);
    if (localVideo) {
      localVideo.srcObject = call.localStream;
      localVideo.muted = true;
    }
    for (const [id, peer] of call.peers) {
      attachRemoteStream(id, peer.remoteStream);
    }
  }

  function initPipDrag(host) {
    if (!host) return;
    const pip = host.querySelector(".pip-tile");
    if (!pip || pip.dataset.pipDragReady === "1") return;
    pip.dataset.pipDragReady = "1";
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;
    const onDown = (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const rect = pip.getBoundingClientRect();
      const hostRect = host.getBoundingClientRect();
      dragging = true;
      pip.setPointerCapture?.(event.pointerId);
      startX = event.clientX;
      startY = event.clientY;
      originLeft = rect.left - hostRect.left;
      originTop = rect.top - hostRect.top;
      pip.style.right = "auto";
      pip.style.bottom = "auto";
      pip.style.left = `${originLeft}px`;
      pip.style.top = `${originTop}px`;
      event.preventDefault();
    };
    const onMove = (event) => {
      if (!dragging) return;
      const hostRect = host.getBoundingClientRect();
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const maxLeft = Math.max(8, hostRect.width - pip.offsetWidth - 8);
      const maxTop = Math.max(8, hostRect.height - pip.offsetHeight - 8);
      const left = Math.min(maxLeft, Math.max(8, originLeft + dx));
      const top = Math.min(maxTop, Math.max(8, originTop + dy));
      pip.style.left = `${left}px`;
      pip.style.top = `${top}px`;
    };
    const onUp = (event) => {
      if (!dragging) return;
      dragging = false;
      try { pip.releasePointerCapture?.(event.pointerId); } catch {}
    };
    pip.addEventListener("pointerdown", onDown);
    pip.addEventListener("pointermove", onMove);
    pip.addEventListener("pointerup", onUp);
    pip.addEventListener("pointercancel", onUp);
  }

  function attachRemoteStream(userId, stream) {
    const video = document.querySelector(`[data-live-tile="${String(userId)}"] video`);
    if (video && stream) {
      if (video.srcObject !== stream) video.srcObject = stream;
    } else if (S.call) {
      renderCallStage();
      const retry = document.querySelector(`[data-live-tile="${String(userId)}"] video`);
      if (retry && stream) retry.srcObject = stream;
    }
  }

  function updateTileFlags() {
    const call = S.call;
    if (!call) return;
    for (const row of acceptedParticipants()) {
      const id = String(row.user_id);
      const tile = document.querySelector(`[data-live-tile="${id}"]`);
      if (!tile) continue;
      const self = id === myId();
      const isAudio = call.call_type === "audio";
      tile.classList.toggle("camera-off", !row.camera_on && call.call_type === "video");
      tile.classList.toggle("mirror-self", self && !isAudio && !call.screenSharing && call.facing !== "environment" && call.cameraOn);
      const mic = tile.querySelector("[data-live-tile-mic]");
      if (mic) mic.textContent = row.mic_on === false ? "🔇" : "";
    }
  }

  function updateCallControls() {
    const call = S.call;
    if (!call) return;
    const mute = document.querySelector("[data-live-mute]");
    if (mute) {
      mute.classList.toggle("active", call.muted);
      mute.setAttribute("aria-pressed", String(call.muted));
      mute.querySelector("span").textContent = call.muted ? "🔇" : "🎙";
      mute.querySelector("small").textContent = call.muted ? t("Unmute", "إلغاء الكتم") : t("Mute", "كتم");
    }
    const camera = document.querySelector("[data-live-camera]");
    if (camera) {
      camera.classList.toggle("active", !call.cameraOn);
      camera.setAttribute("aria-pressed", String(call.cameraOn));
      camera.querySelector("span").textContent = call.cameraOn ? "▣" : "▢";
      camera.querySelector("small").textContent = call.cameraOn
        ? t("Camera off", "إيقاف الكاميرا")
        : t("Camera on", "تشغيل الكاميرا");
    }
    const screen = document.querySelector("[data-live-screen]");
    if (screen) {
      screen.classList.toggle("active", Boolean(call.screenSharing));
      screen.setAttribute("aria-pressed", String(Boolean(call.screenSharing)));
      screen.querySelector("small").textContent = call.screenSharing
        ? t("Stop share", "إيقاف المشاركة")
        : t("Share", "مشاركة");
    }
    const chat = document.querySelector("[data-live-chat-toggle]");
    if (chat) chat.classList.toggle("active", Boolean(call.chatOpen));
    const overlay = document.querySelector(".live-call-overlay");
    if (overlay) overlay.classList.toggle("minimized", Boolean(call.minimized));
    const chatPanel = document.querySelector("[data-live-call-chat]");
    if (chatPanel) chatPanel.classList.toggle("open", Boolean(call.chatOpen));
  }

  // -------------------------------------------------------------------------
  // In-call chat
  // -------------------------------------------------------------------------

  async function loadCallChat() {
    const call = S.call;
    const client = sb();
    if (!call || !client || !call.conversation_id) return;
    try {
      const { data, error } = await client
        .from("team_messages")
        .select("id,conversation_id,sender_id,message_type,body,call_id,created_at,deleted_at")
        .eq("conversation_id", call.conversation_id)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      if (!S.call || String(S.call.id) !== String(call.id)) return;
      S.callChatMessages = (data || []).reverse();
      renderCallChat();
    } catch (error) {
      console.warn("Could not load the in-call chat.", error);
    }
  }

  function upsertCallChatMessage(row) {
    if (!row || !row.id) return;
    const index = S.callChatMessages.findIndex((message) => String(message.id) === String(row.id));
    if (index >= 0) S.callChatMessages[index] = { ...S.callChatMessages[index], ...row };
    else S.callChatMessages.push(row);
    S.callChatMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    renderCallChat();
  }

  function renderCallChat() {
    const host = document.querySelector("[data-live-call-messages]");
    if (!host || !S.call) return;
    if (!S.callChatMessages.length) {
      host.innerHTML = `<p class="live-call-chat-empty">${esc(t("Messages sent here appear only in this conversation.", "الرسائل هنا تظهر في هذه المحادثة فقط."))}</p>`;
      return;
    }
    host.innerHTML = S.callChatMessages
      .filter((message) => message.message_type === "text" || message.message_type === "image" || message.message_type === "file")
      .slice(-80)
      .map((message) => {
        const mine = String(message.sender_id) === myId();
        return `<div class="live-call-msg ${mine ? "mine" : ""}">
          <strong dir="auto">${esc(memberName(message.sender_id))}</strong>
          <p dir="auto">${message.deleted_at ? esc(t("Message deleted", "تم حذف الرسالة")) : esc(message.body || t("Attachment", "مرفق"))}</p>
          <time>${esc(formatTime(message.created_at))}</time>
        </div>`;
      })
      .join("");
    host.scrollTop = host.scrollHeight;
  }

  async function sendCallChat() {
    const call = S.call;
    const client = sb();
    if (!call || !client) return;
    const input = document.querySelector('[data-live-input="call-chat"]');
    const body = String((input ? input.value : S.callChatDraft) || "").trim().slice(0, 1000);
    if (!body) return;
    S.callChatDraft = "";
    if (input) input.value = "";
    try {
      const { data, error } = await client
        .from("team_messages")
        .insert({
          conversation_id: call.conversation_id,
          message_type: "text",
          body,
        })
        .select("id,conversation_id,sender_id,message_type,body,call_id,created_at,deleted_at")
        .single();
      if (error) throw error;
      if (data) upsertCallChatMessage(data);
      if (S.activeId && String(S.activeId) === String(call.conversation_id)) {
        upsertMessage(data);
      }
    } catch (error) {
      notifyError(t("Could not send the call message.", "تعذّر إرسال رسالة المكالمة."), error);
    }
  }

  // -------------------------------------------------------------------------
  // Controls
  // -------------------------------------------------------------------------

  async function updateSelfParticipant(patch) {
    const call = S.call;
    if (!call) return;
    try {
      await sb()
        .from("team_call_participants")
        .update(patch)
        .eq("call_id", call.id)
        .eq("user_id", myId());
    } catch (error) {
      console.warn("Could not update the participant state.", error);
    }
  }

  function toggleMute() {
    const call = S.call;
    if (!call || !call.audioTrack) return;
    call.muted = !call.muted;
    call.audioTrack.enabled = !call.muted;
    updateCallControls();
    updateTileFlags();
    setTileSpeaking(myId(), false);
    void updateSelfParticipant({ mic_on: !call.muted });
  }

  async function toggleCamera() {
    const call = S.call;
    if (!call) return;
    if (call.videoTrack) {
      call.videoTrack.stop();
      call.localStream.removeTrack(call.videoTrack);
      call.videoTrack = null;
      call.cameraOn = false;
      await replaceVideoForAll(null);
      renderCallStage();
      updateCallControls();
      void updateSelfParticipant({ camera_on: false });
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: call.facing || "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      const track = media.getVideoTracks()[0];
      if (!track) throw new Error(t("No camera is available.", "لا توجد كاميرا متاحة."));
      call.videoTrack = track;
      call.localStream.addTrack(track);
      call.cameraOn = true;
      await replaceVideoForAll(track);
      track.addEventListener("ended", () => {
        if (S.call === call && call.videoTrack === track) {
          call.videoTrack = null;
          call.cameraOn = false;
          updateCallControls();
          renderCallStage();
        }
      });
      renderCallStage();
      updateCallControls();
      void updateSelfParticipant({ camera_on: true });
    } catch (error) {
      toast(mediaErrorMessage(error));
    }
  }

  async function switchCamera() {
    const call = S.call;
    if (!call || !call.cameraOn || !call.videoTrack) {
      toast(t("Turn the camera on first.", "شغّل الكاميرا أولًا."));
      return;
    }
    const next = call.facing === "user" ? "environment" : "user";
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: next, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const track = media.getVideoTracks()[0];
      if (!track) throw new Error(t("No other camera is available.", "لا توجد كاميرا أخرى متاحة."));
      const old = call.videoTrack;
      call.videoTrack = track;
      call.facing = next;
      call.localStream.removeTrack(old);
      old.stop();
      call.localStream.addTrack(track);
      await replaceVideoForAll(track);
      renderCallStage();
      toast(t("Camera switched.", "تم تبديل الكاميرا."));
    } catch (error) {
      toast(mediaErrorMessage(error));
    }
  }

  async function toggleScreenShare() {
    const call = S.call;
    if (!call) return;
    if (call.screenStream) {
      stopScreenShare();
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      toast(t("Screen sharing is not available in this browser.", "مشاركة الشاشة غير متاحة في هذا المتصفح."));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error("no-track");
      call.screenStream = stream;
      call.screenSharing = true;
      await replaceVideoForAll(track);
      track.addEventListener("ended", () => stopScreenShare());
      renderCallStage();
      updateCallControls();
      void updateSelfParticipant({ screen_sharing: true });
    } catch (error) {
      if (String(error?.name || "") !== "NotAllowedError") {
        toast(t("Could not start screen sharing.", "تعذّر بدء مشاركة الشاشة."));
      }
    }
  }

  function stopScreenShare() {
    const call = S.call;
    if (!call || !call.screenStream) return;
    const stream = call.screenStream;
    call.screenStream = null;
    call.screenSharing = false;
    stream.getTracks().forEach((track) => track.stop());
    const cameraTrack = call.cameraOn ? call.videoTrack : null;
    void replaceVideoForAll(cameraTrack);
    renderCallStage();
    updateCallControls();
    void updateSelfParticipant({ screen_sharing: false });
  }

  function toggleCallChat() {
    const call = S.call;
    if (!call) return;
    call.chatOpen = !call.chatOpen;
    updateCallControls();
    renderCallChat();
  }

  function toggleCallMinimize() {
    const call = S.call;
    if (!call) return;
    call.minimized = !call.minimized;
    updateCallControls();
  }

  function openAddMemberSheet() {
    const call = S.call;
    if (!call || call.scope !== "group") return;
    const existing = new Set(call.participants.map((row) => String(row.user_id)));
    const candidates = teamMembersOf(call.team_id).filter(
      (id) => id !== myId() && !existing.has(id),
    );
    if (!candidates.length) {
      toast(t("Everyone in this team is already invited.", "كل أعضاء الفريق مدعوون بالفعل."));
      return;
    }
    const modal = document.getElementById("team-live-modal");
    if (!modal) return;
    modal.innerHTML = `<section class="modal live-sheet" role="dialog" aria-modal="true" aria-labelledby="live-add-title">
      <button class="modal-close" type="button" data-live-action="close-sheet" aria-label="${esc(t("Close", "إغلاق"))}">×</button>
      <p class="eyebrow">${esc(t("ADD TO CALL", "إضافة إلى المكالمة"))}</p>
      <h2 id="live-add-title">${esc(t("Invite more teammates", "دعوة المزيد من الزملاء"))}</h2>
      <form data-live-form="invite-call-members">
        <div class="live-member-picker">${candidates
          .map((id) => memberCheckboxMarkup(id, true))
          .join("")}</div>
        <div class="modal-actions">
          <button type="button" class="button button-secondary" data-live-action="close-sheet">${esc(t("Cancel", "إلغاء"))}</button>
          <button type="submit" class="button button-primary">${esc(t("Add to call", "إضافة إلى المكالمة"))}</button>
        </div>
      </form>
    </section>`;
    deps.openModal(modal);
  }

  async function inviteMembersFromSheet() {
    const call = S.call;
    const form = document.querySelector('#team-live-modal [data-live-form="invite-call-members"]');
    if (!call || !form) return;
    const ids = Array.from(form.querySelectorAll('input[name="invitee"]:checked')).map((input) =>
      String(input.value),
    );
    if (!ids.length) {
      toast(t("Choose at least one teammate.", "اختر زميلًا واحدًا على الأقل."));
      return;
    }
    const accepted = call.participants.filter(
      (row) => row.invite_status === "accepted" && !row.left_at,
    ).length;
    if (accepted + ids.length > 8) {
      toast(t("This call supports up to 8 participants.", "تدعم هذه المكالمة حتى 8 مشاركين."));
      return;
    }
    deps.closeModal(document.getElementById("team-live-modal"));
    try {
      await rpc("team_live_invite_call", { p_call_id: call.id, p_user_ids: ids });
      void sendCallPush(call.id, { call_type: call.call_type || "audio", scope: call.scope || "group" });
      toast(t("Invitation sent.", "تم إرسال الدعوة."));
      void refreshParticipants();
    } catch (error) {
      notifyError(t("Could not add the members.", "تعذّر إضافة الأعضاء."), error);
    }
  }

  // -------------------------------------------------------------------------
  // Ending calls and cleanup
  // -------------------------------------------------------------------------

  async function endCall(options = {}) {
    const { force = false, silent = false, source = "user" } = options || {};
    const call = S.call;
    if (!call) return;
    const id = String(call.id);
    if (call.ending || S.endingCallIds.has(id)) return;
    call.ending = true;
    S.endingCallIds.add(id);
    updateCallControlsState();
    if (!force && source === "user") {
      const confirmed = window.confirm(t("End the call for everyone?", "إنهاء المكالمة للجميع؟"));
      if (!confirmed) { call.ending = false; S.endingCallIds.delete(id); updateCallControlsState(); return; }
    }
    try {
      console.info('[team-live][call]', { event: 'end-request', callId: id, source });
      await rpc("team_live_end_call", { p_call_id: id });
      markCallEnded(id);
      teardownCall();
      updateLiveBadge();
      if (!silent) toast(t("Call ended.", "انتهت المكالمة."));
      void loadConversations();
      void checkInvites();
    } catch (error) {
      const fresh = await loadCallRow(id).catch(() => null);
      if (!fresh || String(fresh.status) === "ended") {
        markCallEnded(id); teardownCall(); updateLiveBadge();
        if (!silent) toast(t("Call ended.", "انتهت المكالمة."));
        void loadConversations(); void checkInvites();
      } else {
        if (S.call && String(S.call.id) === id) { S.call.ending = false; updateCallControlsState(); }
        notifyError(t("Could not end the call. Please try again.", "تعذر إنهاء المكالمة. يرجى المحاولة مرة أخرى."), error);
      }
    } finally { S.endingCallIds.delete(id); }
  }

  async function leaveCall({ silent = false, unload = false, reason = "left" } = {}) {
    const call = S.call;
    if (!call) return;
    const id = String(call.id);
    // Local disconnect/cleanup for this participant only. Do NOT end the call for everyone
    // on navigation/unmount/unload unless the user explicitly pressed "End call".
    if (unload) {
      try { void rpc("team_live_leave_call", { p_call_id: id }).catch(() => {}); } catch {}
      teardownCall({ skipServerPrune: true });
      return;
    }
    try {
      await rpc("team_live_leave_call", { p_call_id: id });
    } catch (error) {
      if (!silent) console.warn("Could not leave the call cleanly.", error);
    } finally {
      teardownCall();
    }
    if (!silent) toast(t("You left the call.", "غادرت المكالمة."));
  }

  function updateCallControlsState() {
    const call = S.call;
    const ending = Boolean(call && call.ending);
    const root = document.getElementById("team-live-call-root");
    if (!root) return;
    root.querySelectorAll('[data-live-action="end-call"], [data-live-action="leave-call"], [data-live-action="close-call"]').forEach((el) => {
      if ("disabled" in el) el.disabled = ending;
      el.setAttribute("aria-disabled", ending ? "true" : "false");
    });
  }

  function teardownCall({ skipServerPrune = false } = {}) {
    const call = S.call;
    if (!call) return;
    S.call = null;

    // Stop timers and polling immediately.
    if (call.timer) window.clearInterval(call.timer);
    if (call.statsTimer) window.clearInterval(call.statsTimer);
    if (call.signalPoll) window.clearInterval(call.signalPoll);
    if (call.participantsPoll) window.clearInterval(call.participantsPoll);
    if (call.heartbeat) window.clearInterval(call.heartbeat);
    if (call.noAnswerTimer) window.clearTimeout(call.noAnswerTimer);

    // Stop local media (mic/camera/screen) and release devices.
    try {
      if (call.screenStream) {
        call.screenStream.getTracks().forEach((track) => {
          try { track.stop(); } catch { /* ignore */ }
        });
      }
      if (call.localStream) {
        call.localStream.getTracks().forEach((track) => {
          try { track.stop(); } catch { /* ignore */ }
        });
      }
      if (call.audioTrack) { try { call.audioTrack.stop(); } catch { /* ignore */ } }
      if (call.videoTrack) { try { call.videoTrack.stop(); } catch { /* ignore */ } }
    } catch {
      /* ignore */
    }

    // Close all peer connections and pending candidates.
    if (call.peers) {
      for (const peer of call.peers.values()) {
        if (peer.reconnectTimer) window.clearTimeout(peer.reconnectTimer);
        try {
          if (peer.pendingCandidates) peer.pendingCandidates.length = 0;
          peer.pc.onicecandidate = null;
          peer.pc.ontrack = null;
          peer.pc.onnegotiationneeded = null;
          peer.pc.onconnectionstatechange = null;
          peer.pc.oniceconnectionstatechange = null;
          peer.pc.close();
        } catch {
          /* ignore */
        }
      }
      call.peers.clear();
    }
    if (call.connectedIds) call.connectedIds.clear();
    if (call.seenSignals) call.seenSignals.clear();

    // Remove Realtime subscriptions for call status, participants, signals and in-call chat.
    if (call.channels && call.channels.length) {
      for (const channel of call.channels) {
        try {
          sb()?.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
      call.channels = [];
    }

    if (call.audioCtx) {
      try {
        void call.audioCtx.close();
      } catch {
        /* ignore */
      }
    }
    call.analyser = null;
    call.analyserData = null;
    call.localStream = null;
    call.screenStream = null;
    call.audioTrack = null;
    call.videoTrack = null;

    if (!skipServerPrune) {
      void rpc("team_live_prune_signals", { p_call_id: call.id }).catch(() => {});
    }

    document.body.classList.remove("live-call-active");
    const root = document.getElementById("team-live-call-root");
    if (root) root.innerHTML = "";
    S.callChatMessages = [];
    S.callChatDraft = "";
    S.callChatRendered = false;
    updateLiveBadge();
  }

  // -------------------------------------------------------------------------
  // Incoming invitations
  // -------------------------------------------------------------------------

  function ensureInviteChannel() {
    const client = sb();
    const user = me();
    if (!client || !user) return;
    if (S.inviteChannel) return;
    try {
      S.inviteChannel = client
        .channel(`team-live-invites-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "team_call_participants",
            filter: `user_id=eq.${user.id}`,
          },
          () => void checkInvites(),
        )
        .subscribe();
    } catch (error) {
      console.warn("Could not subscribe to incoming call invitations.", error);
    }
  }

  function startInviteWatcher() {
    stopInviteWatcher();
    S.invitePoll = window.setInterval(() => void checkInvites(), 10000);
    S.unreadPoll = window.setInterval(() => {
      if (document.hidden || !me() || S.call) return;
      const teamId = deps?.getSelectedTeamId?.();
      if (!teamId) return;
      if (String(S.teamId) === String(teamId) && S.conversationsLoaded) {
        updateLiveBadge();
        return;
      }
      adoptTeam(teamId);
      void loadConversations({ silent: true });
    }, 45000);
    window.setTimeout(() => void checkInvites(), 1200);
  }

  function stopInviteWatcher() {
    if (S.invitePoll) {
      window.clearInterval(S.invitePoll);
      S.invitePoll = 0;
    }
    if (S.unreadPoll) {
      window.clearInterval(S.unreadPoll);
      S.unreadPoll = 0;
    }
    if (S.inviteChannel) {
      try {
        sb()?.removeChannel(S.inviteChannel);
      } catch {
        /* ignore */
      }
      S.inviteChannel = null;
    }
    stopRing();
    S.invites = [];
    setIncomingCall(null);
  }

  function currentInvite() {
    if (!S.incomingCallId) return null;
    return S.invites.find((row) => String(row.call_id) === String(S.incomingCallId)) || null;
  }

  function setIncomingCall(callId) {
    S.incomingCallId = callId ? String(callId) : null;
    if (S.incomingTimer) {
      window.clearTimeout(S.incomingTimer);
      S.incomingTimer = 0;
    }
    if (S.incomingCallId) {
      const id = S.incomingCallId;
      S.incomingTimer = window.setTimeout(() => {
        if (String(S.incomingCallId || "") !== id) return;
        if (S.handledInvites.has(id)) return;
        S.handledInvites.add(id);
        S.missedNotified.add(id);
        stopRing();
        setIncomingCall(null);
        toast(t("Missed call.", "مكالمة فائتة."));
        void rpc("team_live_respond_call", { p_call_id: id, p_accept: false }).catch(() => {});
      }, 55000);
    }
    renderIncoming();
  }

  async function checkInvites() {
    const user = me();
    const client = sb();
    if (!user || !client || S.inviteCheckBusy) return;
    ensureInviteChannel();
    S.inviteCheckBusy = true;
    try {
      const rows = await rpc("team_live_pending_invites", {});
      const list = Array.isArray(rows) ? rows : [];
      S.invites = list;
      const fresh = new Set(list.map((row) => String(row.call_id)));

      if (S.call) {
        for (const invite of list) {
          const id = String(invite.call_id);
          if (String(S.call.id) === id) continue;
          if (S.handledInvites.has(id)) continue;
          S.handledInvites.add(id);
          S.seenInvites.add(id);
          void rpc("team_live_respond_call", { p_call_id: id, p_accept: false }).catch(() => {});
        }
        if (S.incomingCallId) setIncomingCall(null);
        stopRing();
        return;
      }

      if (S.incomingCallId && !fresh.has(String(S.incomingCallId))) {
        const id = String(S.incomingCallId);
        if (!S.handledInvites.has(id) && !S.missedNotified.has(id)) {
          S.missedNotified.add(id);
          toast(t("Missed call.", "مكالمة فائتة."));
        }
        stopRing();
        setIncomingCall(null);
      }

      if (!S.incomingCallId) {
        const candidate = list.find((invite) => {
          const id = String(invite.call_id);
          if (S.seenInvites.has(id) || S.handledInvites.has(id)) return false;
          const age = Date.now() - new Date(invite.created_at).getTime();
          return Number.isFinite(age) && age < 60000;
        });
        if (candidate) {
          S.seenInvites.add(String(candidate.call_id));
          setIncomingCall(candidate.call_id);
          playRing();
          notifyIncoming(candidate);
        }
      }
      renderIncoming();
    } catch (error) {
      if (isMissingRpc(error)) {
        S.migrationMissing = true;
        renderSidebar();
      } else if (navigator.onLine) {
        console.warn("Could not check incoming calls.", error);
      }
    } finally {
      S.inviteCheckBusy = false;
    }
  }

  function renderIncoming() {
    const root = document.getElementById("team-live-incoming-root");
    if (!root) return;
    const invite = currentInvite();
    if (!invite || S.call) {
      root.innerHTML = "";
      return;
    }
    root.innerHTML = `<div class="live-incoming" role="dialog" aria-modal="true" aria-label="${esc(t("Incoming call", "مكالمة واردة"))}">
      <div class="live-incoming-card">
        <div class="live-ring" aria-hidden="true"><span></span><span></span></div>
        <p class="eyebrow">${esc(
          invite.call_type === "audio" ? t("INCOMING AUDIO CALL", "مكالمة صوتية واردة") : t("INCOMING VIDEO CALL", "مكالمة مرئية واردة"),
        )}</p>
        <div class="live-incoming-avatar">${memberAvatar(invite.caller_id, "team-avatar")}</div>
        <h2 dir="auto">${esc(memberName(invite.caller_id))}</h2>
        <p dir="auto">${esc(
          [invite.team_name, invite.title].filter(Boolean).join(" · ") || t("Your team is calling", "فريقك يتصل"),
        )}</p>
        <div class="live-incoming-actions">
          <button type="button" class="button button-secondary live-decline" data-live-action="invite-decline" data-call-id="${esc(invite.call_id)}">${esc(t("Decline", "رفض"))}</button>
          <button type="button" class="button button-primary live-accept" data-live-action="invite-accept" data-call-id="${esc(invite.call_id)}">${esc(t("Accept", "قبول"))}</button>
        </div>
        <p class="live-incoming-hint">${esc(
          t(
            "Accepting asks for microphone access. Camera is requested for video calls.",
            "سيُطلب الميكروفون عند القبول، والكاميرا للمكالمات المرئية.",
          ),
        )}</p>
      </div>
    </div>`;
  }

  async function respondToInvite(callId, accept) {
    const id = String(callId || "");
    if (!id) return;
    if (isCallKnownEnded(id)) {
      if (!accept) return;
      toast(t("This call has ended.", "انتهت هذه المكالمة."));
      return;
    }
    const invite =
      S.invites.find((row) => String(row.call_id) === id) || {
        call_id: id,
        call_type: "video",
        caller_id: null,
      };
    S.handledInvites.add(id);
    S.seenInvites.add(id);
    if (String(S.incomingCallId) === id) {
      stopRing();
      setIncomingCall(null);
    }
    if (!accept) {
      try {
        await rpc("team_live_respond_call", { p_call_id: id, p_accept: false });
        toast(t("Call declined.", "تم رفض المكالمة."));
      } catch (error) {
        console.warn("Could not decline the call.", error);
      }
      return;
    }
    if (S.call) {
      try {
        await rpc("team_live_respond_call", { p_call_id: id, p_accept: false });
      } catch {
        /* ignore */
      }
      return;
    }
    const support = callSupportStatus();
    if (!support.supported) {
      toast(supportMessage(support.reason));
      return;
    }
    let media;
    try {
      media = await acquireMedia(invite.call_type || "video");
    } catch (error) {
      toast(error.message || mediaErrorMessage(error));
      try {
        await rpc("team_live_respond_call", { p_call_id: id, p_accept: false });
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      await rpc("team_live_respond_call", { p_call_id: id, p_accept: true });
      const row = await loadCallRow(id);
      if (!row || String(row.status) === "ended") {
        markCallEnded(id);
        media.stream.getTracks().forEach((track) => track.stop());
        toast(t("This call has ended.", "انتهت هذه المكالمة."));
        return;
      }
      const ice = await getIceServers();
      setupCall(row, media, ice);
    } catch (error) {
      media.stream.getTracks().forEach((track) => track.stop());
      notifyError(t("Could not join the call.", "تعذّر الانضمام إلى المكالمة."), error);
    }
  }

  async function handleNativeCallAction(detail) {
    if (!detail) return;
    const action = String(detail.action || "").toLowerCase();
    const callId = String(detail.callId || detail.call_id || detail.payload?.callId || "");
    if (action === "refresh") {
      void checkInvites();
      return;
    }
    if (!callId) return;
    if (isCallKnownEnded(callId) && action !== "decline" && action !== "refresh") {
      toast(t("This call has ended.", "انتهت هذه المكالمة."));
      return;
    }
    try {
      if (action === "decline") {
        await respondToInvite(callId, false);
        return;
      }
      if (action === "accept" || action === "join") {
        // If we have a pending invite in memory, respond through the normal flow.
        // Otherwise join directly (common when the app was backgrounded/killed).
        const invite = S.invites.find((row) => String(row.call_id) === callId);
        if (invite) {
          await respondToInvite(callId, true);
        } else {
          await joinExistingCall(callId);
        }
      }
    } catch (error) {
      console.warn("Native call action failed.", error);
    }
  }

  window.StudyZoneTeamLive = {
    init,
    shutdown,
    syncSession,
    mount,
    renderPage,
    taskActions,
    teamPanel,
    openTaskConversation: (taskId, teamId) => {
      if (teamId) deps.setSelectedTeamId(teamId);
      S.pendingTaskId = taskId;
      deps.navigate("team-live");
    },
    openDirect: (userId, teamId) => {
      if (teamId) deps.setSelectedTeamId(teamId);
      deps.navigate("team-live");
      window.setTimeout(() => void openDirect(userId), 120);
    },
    openConversationById: (conversationId) => {
      deps.navigate("team-live");
      window.setTimeout(() => void openConversation(conversationId), 80);
    },
    closeChatView,
    handleBack: () => {
      if (S.chatFocus && S.activeId) {
        closeChatView();
        return true;
      }
      return false;
    },
    openCallSheet: (options) => openCallSheet(options || {}),
    startDirectCall,
    joinCall: (callId) => joinExistingCall(callId),
    declineCall: (callId) => respondToInvite(callId, false),
    acceptCall: (callId) => respondToInvite(callId, true),
    handleNativeCallAction,
    unreadForTeam: () => unreadTotalForTeam(),
    __state: S,
  };
})();
