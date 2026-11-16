package com.studyzone.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class IncomingCallReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null || intent.getAction() == null) return;
        String action = intent.getAction();
        String callId = intent.getStringExtra(CallNotificationHelper.EXTRA_CALL_ID);
        if (callId == null) callId = "";

        if (CallNotificationHelper.ACTION_DECLINE.equals(action)) {
            CallNotificationHelper.cancel(context, callId);
            CallNotificationHelper.savePendingAction(
                    context, "decline", callId, CallNotificationHelper.payloadJson(intent)
            );
            // Best-effort: open app in background context is not possible, so web
            // layer will process decline when app resumes; also try to start main
            // activity with decline action so if it can come up it handles it.
            Intent declineIntent = new Intent(context, MainActivity.class);
            CallNotificationHelper.copyExtras(intent, declineIntent);
            declineIntent.setAction(CallNotificationHelper.ACTION_DECLINE + ":" + callId);
            declineIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            try {
                context.startActivity(declineIntent);
            } catch (Exception ignored) {
            }
            return;
        }

        if (CallNotificationHelper.ACTION_ACCEPT.equals(action)) {
            CallNotificationHelper.cancel(context, callId);
            CallNotificationHelper.savePendingAction(
                    context, "accept", callId, CallNotificationHelper.payloadJson(intent)
            );
            Intent acceptIntent = new Intent(context, MainActivity.class);
            CallNotificationHelper.copyExtras(intent, acceptIntent);
            acceptIntent.putExtra("page", "team-live");
            acceptIntent.setAction(CallNotificationHelper.ACTION_ACCEPT + ":" + callId);
            acceptIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            try {
                context.startActivity(acceptIntent);
            } catch (Exception ignored) {
            }
        }
    }
}
