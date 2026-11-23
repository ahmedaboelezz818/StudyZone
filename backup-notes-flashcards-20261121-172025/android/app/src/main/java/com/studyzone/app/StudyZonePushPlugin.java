package com.studyzone.app;

import android.content.Context;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;

/**
 * Guarded Firebase Cloud Messaging entry point.
 *
 * Firebase only works when the Google Services Gradle plugin generated the
 * google_app_id / gcm_defaultSenderId / google_api_key resources from
 * android/app/google-services.json. When that file is missing the Gradle
 * plugin is skipped, FirebaseInitProvider cannot create a default FirebaseApp,
 * and any call to FirebaseMessaging.getInstance() throws
 * IllegalStateException("Default FirebaseApp is not initialized...").
 *
 * @capacitor/push-notifications calls FirebaseMessaging.getInstance()
 * unconditionally inside its register() method, which crashed this app during
 * startup. This plugin answers "is Firebase actually ready?" first and keeps
 * every FCM call behind that answer, so the web layer can skip push
 * registration without the native bridge throwing.
 *
 * Nothing here disables push: as soon as a valid google-services.json for
 * com.studyzone.app is added, status() reports configured=true and the token
 * flow works exactly as before. No Firebase options are invented or hardcoded.
 */
@CapacitorPlugin(name = "StudyZonePush")
public class StudyZonePushPlugin extends Plugin {

    private static final String TAG = "StudyZonePush";

    private static int stringResourceId(Context context, String name) {
        try {
            return context.getResources().getIdentifier(name, "string", context.getPackageName());
        } catch (Throwable error) {
            return 0;
        }
    }

    /** True only when the Google Services plugin actually generated app config. */
    private static boolean hasFirebaseConfig(Context context) {
        int id = stringResourceId(context, "google_app_id");
        if (id == 0) return false;
        try {
            String appId = context.getString(id);
            return appId != null && !appId.trim().isEmpty();
        } catch (Throwable error) {
            return false;
        }
    }

    /**
     * Returns true when a default FirebaseApp exists.
     *
     * FirebaseInitProvider normally creates it at process start (initOrder 100)
     * whenever google-services.json was processed, so this is usually just a
     * read-only check. The initializeApp() call below is only reached when the
     * config resources exist but the provider has not run yet; it reuses the
     * exact same resource options and cannot create a duplicate app.
     */
    public static boolean ensureDefaultApp(Context context) {
        if (context == null) return false;
        try {
            if (!FirebaseApp.getApps(context).isEmpty()) return true;
            if (!hasFirebaseConfig(context)) return false;
            FirebaseOptions options = FirebaseOptions.fromResource(context);
            if (options == null) return false;
            FirebaseApp.initializeApp(context, options);
            return !FirebaseApp.getApps(context).isEmpty();
        } catch (Throwable error) {
            Log.w(TAG, "Firebase default app is unavailable: " + error.getMessage());
            return false;
        }
    }

    private static String unavailableReason(Context context) {
        if (context == null) return "no-context";
        if (!hasFirebaseConfig(context)) return "missing-google-services";
        return "firebase-not-initialized";
    }

    private JSObject statusFor(Context context) {
        boolean configured;
        try {
            configured = ensureDefaultApp(context);
        } catch (Throwable error) {
            configured = false;
        }
        JSObject result = new JSObject();
        result.put("configured", configured);
        result.put("reason", configured ? "ok" : unavailableReason(context));
        return result;
    }

    /** Safe capability probe: never touches FirebaseMessaging. */
    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(statusFor(getContext()));
    }

    /**
     * Guarded replacement for PushNotifications.register(). Resolves with
     * {configured, reason, token} instead of allowing an IllegalStateException
     * to escape into the Capacitor bridge and kill the app.
     */
    @PluginMethod
    public void register(PluginCall call) {
        Context context = getContext();
        boolean configured = false;
        try {
            configured = ensureDefaultApp(context);
        } catch (Throwable ignored) {
            configured = false;
        }

        if (!configured) {
            String reason = unavailableReason(context);
            Log.i(TAG, "FCM registration skipped: " + reason);
            JSObject skipped = new JSObject();
            skipped.put("configured", false);
            skipped.put("reason", reason);
            skipped.put("token", "");
            call.resolve(skipped);
            return;
        }

        try {
            FirebaseMessaging messaging = FirebaseMessaging.getInstance();
            messaging.setAutoInitEnabled(true);
            messaging.getToken().addOnCompleteListener(task -> {
                JSObject done = new JSObject();
                done.put("configured", true);
                done.put("reason", "ok");
                if (task.isSuccessful()) {
                    String token = task.getResult();
                    done.put("token", token == null ? "" : token);
                } else {
                    Exception failure = task.getException();
                    done.put("token", "");
                    done.put(
                        "error",
                        failure == null ? "unknown" : String.valueOf(failure.getLocalizedMessage())
                    );
                }
                call.resolve(done);
            });
        } catch (Throwable error) {
            Log.w(TAG, "FCM token request failed safely", error);
            JSObject failed = new JSObject();
            failed.put("configured", false);
            failed.put("reason", "firebase-error");
            failed.put("token", "");
            failed.put("error", String.valueOf(error.getMessage()));
            call.resolve(failed);
        }
    }
}
