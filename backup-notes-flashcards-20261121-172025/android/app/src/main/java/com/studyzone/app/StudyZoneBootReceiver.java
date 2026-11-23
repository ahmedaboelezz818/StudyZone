package com.studyzone.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Restores the clock widget/notification state after reboot and handles the
 * "Turn off" button on the persistent clock notification.
 */
public class StudyZoneBootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();

        if (StudyZoneClockNotification.ACTION_DISABLE.equals(action)) {
            StudyZoneClockNotification.setEnabled(context, false);
            StudyZoneClockNotification.hide(context);
            return;
        }

        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || "android.intent.action.LOCKED_BOOT_COMPLETED".equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            StudyZoneClockWidget.updateAll(context);
            StudyZoneClockNotification.sync(context);
        }
    }
}
