package com.studyzone.app;

import android.content.Intent;

import androidx.annotation.NonNull;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class StudyZoneFirebaseMessagingService extends FirebaseMessagingService {

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Map<String, String> data = remoteMessage.getData();
        String type = data != null ? data.get("type") : null;
        if (isIncomingCallType(type)) {
            handleIncomingCall(remoteMessage, data);
            return;
        }
        // Forward non-call messages to Capacitor Push Notifications plugin.
        try {
            PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
        } catch (Throwable ignored) {
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        try {
            PushNotificationsPlugin.onNewToken(token);
        } catch (Throwable ignored) {
        }
    }

    private boolean isIncomingCallType(String type) {
        if (type == null) return false;
        String t = type.trim().toLowerCase();
        return "incoming_call".equals(t)
                || "team_live_call".equals(t)
                || "call_invite".equals(t)
                || "call".equals(t);
    }

    private void handleIncomingCall(RemoteMessage remoteMessage, Map<String, String> data) {
        if (data == null) return;
        Intent intent = new Intent(this, IncomingCallActivity.class);
        intent.putExtra(CallNotificationHelper.EXTRA_CALL_ID, first(data, "call_id", "callId", "id"));
        intent.putExtra(CallNotificationHelper.EXTRA_CALLER_NAME, first(data, "caller_name", "callerName", "caller", "from_name"));
        intent.putExtra(CallNotificationHelper.EXTRA_CALLER_ID, first(data, "caller_id", "callerId", "from_user_id", "user_id"));
        intent.putExtra(CallNotificationHelper.EXTRA_CALL_TYPE, first(data, "call_type", "callType", "media", "mode"));
        intent.putExtra(CallNotificationHelper.EXTRA_TEAM_NAME, first(data, "team_name", "teamName", "team"));
        intent.putExtra(CallNotificationHelper.EXTRA_CONVERSATION_ID, first(data, "conversation_id", "conversationId"));
        intent.putExtra(CallNotificationHelper.EXTRA_SCOPE, first(data, "scope"));
        intent.putExtra(CallNotificationHelper.EXTRA_AVATAR, first(data, "avatar", "caller_avatar", "callerAvatar"));
        intent.putExtra(CallNotificationHelper.EXTRA_FROM_PUSH, "1");

        String callId = intent.getStringExtra(CallNotificationHelper.EXTRA_CALL_ID);
        if (callId == null || callId.trim().isEmpty()) return;

        String state = first(data, "state", "call_state", "action");
        String stateLower = state == null ? "" : state.trim().toLowerCase();
        if ("ended".equals(stateLower) || "canceled".equals(stateLower) || "cancelled".equals(stateLower)
                || "declined".equals(stateLower) || "accepted".equals(stateLower) || "missed".equals(stateLower)) {
            // The caller ended the call or somebody else accepted it: remove
            // the ringing notification on every device and stop here.
            CallNotificationHelper.cancel(this, callId);
            return;
        }

        if (MainActivity.isInForeground()) {
            // The web UI already shows its own incoming-call sheet. Forward the
            // payload to Capacitor instead of drawing a second native screen.
            try {
                PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
            } catch (Throwable ignored) {
            }
            return;
        }

        CallNotificationHelper.showIncomingCall(this, intent);
    }

    private String first(Map<String, String> data, String... keys) {
        if (data == null || keys == null) return "";
        for (String key : keys) {
            if (key == null) continue;
            String value = data.get(key);
            if (value != null && !value.trim().isEmpty()) return value.trim();
        }
        return "";
    }
}
