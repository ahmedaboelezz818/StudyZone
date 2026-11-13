package com.studyzone.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * Optional persistent clock notification.
 *
 * Android does not allow an ordinary app to redraw a notification every second,
 * and a foreground service just to tick a clock would waste battery and break
 * the platform's background limits. Instead the notification uses
 * {@code setUsesChronometer(true)} with its base set to midnight: the system
 * renders an always-correct HH:MM:SS clock without Study Zone waking up.
 *
 * The notification is a normal ongoing notification (not a foreground service),
 * so it stays after the app UI is closed, is restored after a reboot by
 * {@link StudyZoneBootReceiver}, and can be turned off by the user at any time.
 */
final class StudyZoneClockNotification {

    static final String CHANNEL_ID = "studyzone_clock";
    static final int NOTIFICATION_ID = 4102;
    static final String PREFS = "studyzone_clock";
    static final String KEY_ENABLED = "clock_notification_enabled";
    static final String ACTION_DISABLE = "com.studyzone.app.action.DISABLE_CLOCK_NOTIFICATION";

    private StudyZoneClockNotification() {}

    static boolean isEnabled(Context context) {
        return prefs(context).getBoolean(KEY_ENABLED, false);
    }

    static void setEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply();
    }

    static boolean canPost(Context context) {
        if (Build.VERSION.SDK_INT >= 33) {
            if (context.checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                    != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                return false;
            }
        }
        return NotificationManagerCompat.from(context).areNotificationsEnabled();
    }

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        android.app.NotificationManager manager =
                (android.app.NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return;
        android.app.NotificationChannel channel = new android.app.NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.clock_channel_name),
                android.app.NotificationManager.IMPORTANCE_LOW);
        channel.setDescription(context.getString(R.string.clock_channel_description));
        channel.setShowBadge(false);
        channel.enableVibration(false);
        channel.setSound(null, null);
        manager.createNotificationChannel(channel);
    }

    static void show(Context context) {
        if (!canPost(context)) return;
        ensureChannel(context);
        try {
            long now = System.currentTimeMillis();
            java.util.Calendar midnight = java.util.Calendar.getInstance();
            midnight.set(java.util.Calendar.HOUR_OF_DAY, 0);
            midnight.set(java.util.Calendar.MINUTE, 0);
            midnight.set(java.util.Calendar.SECOND, 0);
            midnight.set(java.util.Calendar.MILLISECOND, 0);
            long sinceMidnight = Math.max(0, now - midnight.getTimeInMillis());

            Intent open = new Intent(context, MainActivity.class);
            open.setAction(Intent.ACTION_VIEW);
            open.putExtra("page", "focus");
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent content = PendingIntent.getActivity(context, 4102, open,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            Intent stop = new Intent(context, StudyZoneBootReceiver.class);
            stop.setAction(ACTION_DISABLE);
            PendingIntent stopPending = PendingIntent.getBroadcast(context, 4103, stop,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            // The chronometer is rendered by the system every second from its
            // base. Set the base to midnight so the displayed value always
            // equals the wall clock in 24-hour form (the only form a chronometer
            // can express without drifting).
            java.util.Calendar clock = java.util.Calendar.getInstance();
            String label = String.format(
                    java.util.Locale.US,
                    "%02d:%02d",
                    clock.get(java.util.Calendar.HOUR_OF_DAY),
                    clock.get(java.util.Calendar.MINUTE));

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.drawable.ic_stat_studyzone)
                    .setContentTitle(context.getString(R.string.clock_notification_title, label))
                    .setContentText(context.getString(R.string.clock_notification_text))
                    .setContentIntent(content)
                    .setOngoing(true)
                    .setOnlyAlertOnce(true)
                    .setSilent(true)
                    .setShowWhen(true)
                    .setWhen(now - sinceMidnight)
                    .setUsesChronometer(true)
                    .setPriority(NotificationCompat.PRIORITY_LOW)
                    .setCategory(NotificationCompat.CATEGORY_STATUS)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .addAction(0, context.getString(R.string.clock_notification_open), content)
                    .addAction(0, context.getString(R.string.clock_notification_stop), stopPending);

            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build());
        } catch (SecurityException error) {
            android.util.Log.w("StudyZoneClock", "notification permission missing", error);
        } catch (RuntimeException error) {
            android.util.Log.w("StudyZoneClock", "could not post clock notification", error);
        }
    }

    static void hide(Context context) {
        try {
            NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID);
        } catch (RuntimeException ignored) {
        }
    }

    /** Show when enabled, remove otherwise. Safe to call from any lifecycle point. */
    static void sync(Context context) {
        if (isEnabled(context)) show(context);
        else hide(context);
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
