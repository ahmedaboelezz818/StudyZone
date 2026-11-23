package com.studyzone.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * Handles the persistent "End call" action from the active-call notification
 * and forwards it to the WebView as a pending action so the web layer can
 * leave/end the call cleanly (server RPC + media teardown).
 */
public class StudyZoneCallActionReceiver extends BroadcastReceiver {
    public static final String ACTION_END_CALL = "com.studyzone.app.action.CALL_END";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;
        String action = intent.getAction();
        if (!ACTION_END_CALL.equals(action)) return;

        String callId = intent.getStringExtra(StudyZoneCallService.EXTRA_CALL_ID);

        // Cancel the foreground service + notification first.
        Intent stop = new Intent(context, StudyZoneCallService.class);
        stop.setAction(StudyZoneCallService.ACTION_STOP);
        try {
            context.stopService(stop);
        } catch (Throwable ignored) {
            /* best effort */
        }

        // Hand the action to MainActivity -> WebView.
        Intent forward = new Intent(context, MainActivity.class);
        forward.setAction(CallNotificationHelper.ACTION_DISMISS + ":" + (callId == null ? "" : callId));
        forward.putExtra("page", "team-live");
        forward.putExtra(CallNotificationHelper.EXTRA_CALL_ID, callId);
        forward.putExtra("studyzone_end_call", "1");
        forward.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        try {
            context.startActivity(forward);
        } catch (Throwable ignored) {
            /* The notification action must never crash the app. */
        }
    }
}
