package com.studyzone.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;

public final class CallNotificationHelper {
    public static final String CHANNEL_ID = "studyzone_incoming_calls_v1";
    public static final String ACTION_ACCEPT = "com.studyzone.app.action.CALL_ACCEPT";
    public static final String ACTION_DECLINE = "com.studyzone.app.action.CALL_DECLINE";
    public static final String ACTION_DISMISS = "com.studyzone.app.action.CALL_DISMISS";
    public static final String EXTRA_CALL_ID = "call_id";
    public static final String EXTRA_CALLER_NAME = "caller_name";
    public static final String EXTRA_CALLER_ID = "caller_id";
    public static final String EXTRA_CALL_TYPE = "call_type";
    public static final String EXTRA_TEAM_NAME = "team_name";
    public static final String EXTRA_CONVERSATION_ID = "conversation_id";
    public static final String EXTRA_SCOPE = "scope";
    public static final String EXTRA_AVATAR = "avatar";
    public static final String EXTRA_FROM_PUSH = "from_push";
    public static final String PREFS = "studyzone_call_actions";
    public static final String KEY_PENDING_ACTION = "pending_action";
    public static final String KEY_PENDING_CALL_ID = "pending_call_id";
    public static final String KEY_PENDING_PAYLOAD = "pending_payload";

    private CallNotificationHelper() {}

    public static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel existing = manager.getNotificationChannel(CHANNEL_ID);
        if (existing != null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.call_channel_name),
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(context.getString(R.string.call_channel_description));
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.enableVibration(true);
        channel.enableLights(true);
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        channel.setSound(sound, attrs);
        manager.createNotificationChannel(channel);
    }

    public static int notificationId(String callId) {
        if (callId == null) return 910001;
        int hash = Math.abs(callId.hashCode());
        return 910000 + (hash % 90000);
    }

    public static void showIncomingCall(Context context, Intent data) {
        ensureChannel(context);
        String callId = safe(data.getStringExtra(EXTRA_CALL_ID));
        if (callId.isEmpty()) return;
        String caller = safe(data.getStringExtra(EXTRA_CALLER_NAME));
        if (caller.isEmpty()) caller = context.getString(R.string.app_name);
        String team = safe(data.getStringExtra(EXTRA_TEAM_NAME));
        String type = safe(data.getStringExtra(EXTRA_CALL_TYPE));
        boolean video = "video".equalsIgnoreCase(type);
        String title = video ? context.getString(R.string.incoming_video_call) : context.getString(R.string.incoming_audio_call);
        String subtitle = !team.isEmpty() ? team : context.getString(R.string.title_activity_main);

        Intent fullScreen = new Intent(context, IncomingCallActivity.class);
        copyExtras(data, fullScreen);
        fullScreen.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent fullScreenPi = PendingIntent.getActivity(
                context,
                notificationId(callId) + 1,
                fullScreen,
                pendingFlags(PendingIntent.FLAG_UPDATE_CURRENT)
        );

        Intent openIntent = new Intent(context, MainActivity.class);
        copyExtras(data, openIntent);
        openIntent.putExtra("page", "team-live");
        openIntent.setAction(ACTION_ACCEPT + ":" + callId);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPi = PendingIntent.getActivity(
                context,
                notificationId(callId) + 2,
                openIntent,
                pendingFlags(PendingIntent.FLAG_UPDATE_CURRENT)
        );

        PendingIntent acceptPi = actionIntent(context, ACTION_ACCEPT, data, 10);
        PendingIntent declinePi = actionIntent(context, ACTION_DECLINE, data, 20);

        Person callerPerson = new Person.Builder().setName(caller).setImportant(true).build();
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_studyzone)
                .setContentTitle(title)
                .setContentText(caller + (team.isEmpty() ? "" : " · " + team))
                .setSubText(subtitle)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setTimeoutAfter(55000)
                .setOnlyAlertOnce(false)
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE))
                .setVibrate(new long[]{0, 500, 300, 500, 300, 500})
                .setFullScreenIntent(fullScreenPi, true)
                .setContentIntent(openPi)
                .addAction(R.drawable.ic_call_decline, context.getString(R.string.decline_call), declinePi)
                .addAction(R.drawable.ic_call_accept, context.getString(R.string.accept_call), acceptPi);

        try {
            NotificationCompat.CallStyle style = NotificationCompat.CallStyle.forIncomingCall(
                    callerPerson, declinePi, acceptPi
            );
            style.setIsVideo(video);
            builder.setStyle(style);
        } catch (Throwable ignored) {
            // Fallback for older compat behavior.
        }

        Notification notification = builder.build();
        notification.flags |= Notification.FLAG_INSISTENT;
        try {
            NotificationManagerCompat.from(context).notify(notificationId(callId), notification);
        } catch (SecurityException ignored) {
            // POST_NOTIFICATIONS not granted.
        }
    }

    public static void cancel(Context context, String callId) {
        NotificationManagerCompat.from(context).cancel(notificationId(callId));
    }

    public static void cancelAll(Context context) {
        NotificationManagerCompat.from(context).cancelAll();
    }

    public static void savePendingAction(Context context, String action, String callId, String payloadJson) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_PENDING_ACTION, action == null ? "" : action)
                .putString(KEY_PENDING_CALL_ID, callId == null ? "" : callId)
                .putString(KEY_PENDING_PAYLOAD, payloadJson == null ? "" : payloadJson)
                .apply();
    }

    public static String[] consumePendingAction(Context context) {
        android.content.SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String action = prefs.getString(KEY_PENDING_ACTION, "");
        String callId = prefs.getString(KEY_PENDING_CALL_ID, "");
        String payload = prefs.getString(KEY_PENDING_PAYLOAD, "");
        if (action == null || action.isEmpty()) return null;
        prefs.edit().clear().apply();
        return new String[]{action, callId == null ? "" : callId, payload == null ? "" : payload};
    }

    public static void copyExtras(Intent from, Intent to) {
        if (from == null || to == null) return;
        String[] keys = {EXTRA_CALL_ID, EXTRA_CALLER_NAME, EXTRA_CALLER_ID, EXTRA_CALL_TYPE,
                EXTRA_TEAM_NAME, EXTRA_CONVERSATION_ID, EXTRA_SCOPE, EXTRA_AVATAR, EXTRA_FROM_PUSH};
        for (String key : keys) {
            if (from.hasExtra(key)) to.putExtra(key, from.getStringExtra(key));
        }
    }

    public static String payloadJson(Intent intent) {
        try {
            org.json.JSONObject o = new org.json.JSONObject();
            o.put("callId", safe(intent.getStringExtra(EXTRA_CALL_ID)));
            o.put("callerName", safe(intent.getStringExtra(EXTRA_CALLER_NAME)));
            o.put("callerId", safe(intent.getStringExtra(EXTRA_CALLER_ID)));
            o.put("callType", safe(intent.getStringExtra(EXTRA_CALL_TYPE)));
            o.put("teamName", safe(intent.getStringExtra(EXTRA_TEAM_NAME)));
            o.put("conversationId", safe(intent.getStringExtra(EXTRA_CONVERSATION_ID)));
            o.put("scope", safe(intent.getStringExtra(EXTRA_SCOPE)));
            o.put("avatar", safe(intent.getStringExtra(EXTRA_AVATAR)));
            return o.toString();
        } catch (Exception e) {
            return "{}";
        }
    }

    private static PendingIntent actionIntent(Context context, String action, Intent data, int offset) {
        Intent intent = new Intent(context, IncomingCallReceiver.class);
        intent.setAction(action);
        copyExtras(data, intent);
        String callId = safe(data.getStringExtra(EXTRA_CALL_ID));
        return PendingIntent.getBroadcast(
                context,
                notificationId(callId) + offset,
                intent,
                pendingFlags(PendingIntent.FLAG_UPDATE_CURRENT)
        );
    }

    private static int pendingFlags(int base) {
        int flags = base;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return flags;
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
