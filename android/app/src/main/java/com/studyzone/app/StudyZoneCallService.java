package com.studyzone.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

/**
 * Foreground service that keeps an in-progress Team Live call alive while the
 * Study Zone WebView is in the background or the screen is locked.
 *
 * It holds no media by itself: WebRTC lives in the WebView. Its job is to
 * satisfy Android's foreground-service rules (persistent notification + a
 * declared service type) and to give the user a way back to the call and a
 * way to end it without opening the full app.
 *
 * It never starts on its own and stops itself as soon as the web layer tells
 * it the call is over (see StudyZoneCallServicePlugin).
 */
public class StudyZoneCallService extends Service {
    public static final String CHANNEL_ID = "studyzone_active_call_v1";
    public static final String ACTION_START = "com.studyzone.app.action.CALL_SERVICE_START";
    public static final String ACTION_STOP = "com.studyzone.app.action.CALL_SERVICE_STOP";
    public static final String ACTION_RETURN = "com.studyzone.app.action.CALL_SERVICE_RETURN";
    public static final String EXTRA_CALL_ID = "call_id";
    public static final String EXTRA_CALL_TYPE = "call_type";
    public static final String EXTRA_CALL_TITLE = "call_title";

    public static final int NOTIFICATION_ID = 920000;

    private volatile boolean running = false;

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_STOP.equals(action)) {
            stopCall();
            return START_NOT_STICKY;
        }
        if (ACTION_START.equals(action)) {
            String callId = intent.getStringExtra(EXTRA_CALL_ID);
            String callType = intent.getStringExtra(EXTRA_CALL_TYPE);
            String title = intent.getStringExtra(EXTRA_CALL_TITLE);
            startForeground(callId, callType, title);
            return START_NOT_STICKY;
        }
        return START_NOT_STICKY;
    }

    private void startForeground(String callId, String callType, String title) {
        boolean video = "video".equalsIgnoreCase(callType);
        String appTitle = getString(R.string.app_name);
        String contentTitle = title != null && !title.trim().isEmpty() ? title : appTitle;
        String contentText = video ? getString(R.string.call_in_progress_video) : getString(R.string.call_in_progress_audio);

        Intent returnIntent = new Intent(this, MainActivity.class);
        returnIntent.setAction(ACTION_RETURN);
        if (callId != null) returnIntent.putExtra(EXTRA_CALL_ID, callId);
        returnIntent.putExtra("page", "team-live");
        returnIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent returnPending = PendingIntent.getActivity(
                this,
                NOTIFICATION_ID + 1,
                returnIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent declineIntent = new Intent(this, StudyZoneCallActionReceiver.class);
        declineIntent.setAction(StudyZoneCallActionReceiver.ACTION_END_CALL);
        if (callId != null) declineIntent.putExtra(EXTRA_CALL_ID, callId);
        PendingIntent endPending = PendingIntent.getBroadcast(
                this,
                NOTIFICATION_ID + 2,
                declineIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_studyzone)
                .setContentTitle(contentTitle)
                .setContentText(contentText)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setContentIntent(returnPending)
                .addAction(R.drawable.ic_call_decline, getString(R.string.end_call), endPending);

        Notification notification = builder.build();

        // Android 14+ requires the foreground-service type to match the
        // experiences the call can actually use (mic + camera).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE | ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        running = true;
    }

    private void stopCall() {
        running = false;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(NOTIFICATION_ID);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                getString(R.string.active_call_channel_name),
                NotificationManager.IMPORTANCE_LOW);
        channel.setDescription(getString(R.string.active_call_channel_description));
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
