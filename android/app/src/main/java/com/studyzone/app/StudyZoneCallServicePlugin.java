package com.studyzone.app;

import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Web bridge for the active-call foreground service. The Team Live web code
 * calls these methods when a call starts and when it really ends; both are
 * idempotent and safe to call more than once.
 */
@CapacitorPlugin(name = "StudyZoneCallForegroundService")
public class StudyZoneCallServicePlugin extends Plugin {

    @PluginMethod
    public void startCall(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("No context");
            return;
        }
        String callId = safe(call.getString("callId"));
        String callType = safe(call.getString("callType"));
        String title = safe(call.getString("title"));

        Intent intent = new Intent(context, StudyZoneCallService.class);
        intent.setAction(StudyZoneCallService.ACTION_START);
        if (!callId.isEmpty()) intent.putExtra(StudyZoneCallService.EXTRA_CALL_ID, callId);
        if (!callType.isEmpty()) intent.putExtra(StudyZoneCallService.EXTRA_CALL_TYPE, callType);
        if (!title.isEmpty()) intent.putExtra(StudyZoneCallService.EXTRA_CALL_TITLE, title);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
            JSObject result = new JSObject();
            result.put("running", true);
            call.resolve(result);
        } catch (Throwable error) {
            JSObject result = new JSObject();
            result.put("running", false);
            result.put("warning", String.valueOf(error.getMessage()));
            call.resolve(result);
        }
    }

    @PluginMethod
    public void stopCall(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("No context");
            return;
        }
        Intent intent = new Intent(context, StudyZoneCallService.class);
        intent.setAction(StudyZoneCallService.ACTION_STOP);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
            JSObject result = new JSObject();
            result.put("running", false);
            call.resolve(result);
        } catch (Throwable error) {
            // Stopping must never fail the call teardown path.
            JSObject result = new JSObject();
            result.put("running", false);
            result.put("warning", String.valueOf(error.getMessage()));
            call.resolve(result);
        }
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
