package com.studyzone.app;

import android.content.Intent;
import android.media.projection.MediaProjectionManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;

/**
 * Capacitor bridge for opting into screen capture with explicit user consent.
 * The Android consent dialog is shown every time the user requests capture;
 * the result is passed straight to the foreground service.
 */
@CapacitorPlugin(name = "StudyZoneScreenCapture")
public class StudyZoneScreenCapturePlugin extends Plugin {

    public static final int REQUEST_CONSENT = 7713;
    // Shared extra keys so both the plugin and the activity pass the same values.
    public static final String EXTRA_MAX_WIDTH = "max_width";
    public static final String EXTRA_MAX_HEIGHT = "max_height";
    public static final String EXTRA_FRAME_RATE = "frame_rate";
    private static StudyZoneScreenCapturePlugin instance;
    private volatile int pendingMaxWidth = 720;
    private volatile int pendingMaxHeight = 1280;
    private volatile int pendingFrameRate = 4;

    public StudyZoneScreenCapturePlugin() {
        instance = this;
    }

    @PluginMethod
    public void requestConsent(PluginCall call) {
        int maxWidth = clampDimens(call.getInt("maxWidth", 720), 240, 1280);
        int maxHeight = clampDimens(call.getInt("maxHeight", 1280), 240, 1280);
        int frameRate = clampDimens(call.getInt("frameRate", 4), 1, 12);

        MediaProjectionManager manager = (MediaProjectionManager) getContext().getSystemService(android.content.Context.MEDIA_PROJECTION_SERVICE);
        Intent consentIntent = manager.createScreenCaptureIntent();

        // The system consent dialog is activity-based. We launch it directly
        // through the plugin's startActivityForResult so the result comes back
        // to onActivityResult.
        this.pendingMaxWidth = maxWidth;
        this.pendingMaxHeight = maxHeight;
        this.pendingFrameRate = frameRate;
        startActivityForResult(call, consentIntent, "onActivityResult");
    }

    @ActivityCallback
    protected void onActivityResult(PluginCall call, int resultCode, Intent data) {
        JSObject result = new JSObject();
        if (resultCode == android.app.Activity.RESULT_OK && data != null) {
            Intent launch = new Intent(getContext(), StudyZoneScreenCaptureService.class);
            launch.setAction(StudyZoneScreenCaptureService.ACTION_CONSENT);
            launch.putExtra("consent_result_code", resultCode);
            launch.putExtra("consent_result_data", data);
            launch.putExtra(EXTRA_MAX_WIDTH, this.pendingMaxWidth);
            launch.putExtra(EXTRA_MAX_HEIGHT, this.pendingMaxHeight);
            launch.putExtra(EXTRA_FRAME_RATE, this.pendingFrameRate);
            try {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    getContext().startForegroundService(launch);
                } else {
                    getContext().startService(launch);
                }
                result.put("granted", true);
                call.resolve(result);
            } catch (Throwable error) {
                result.put("granted", false);
                result.put("reason", String.valueOf(error.getMessage()));
                call.resolve(result);
            }
        } else {
            result.put("granted", false);
            call.resolve(result);
        }
    }

    @PluginMethod
    public void stopCapture(PluginCall call) {
        Intent intent = new Intent(getContext(), StudyZoneScreenCaptureService.class);
        intent.setAction(StudyZoneScreenCaptureService.ACTION_STOP);
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
        } catch (Throwable ignored) {
            /* stopping must never fail */
        }
        JSObject result = new JSObject();
        result.put("stopped", true);
        call.resolve(result);
    }

    public static void emitConsentResult(boolean granted, String reason) {
        JSObject event = new JSObject();
        event.put("granted", granted);
        event.put("reason", reason == null ? "" : reason);
        if (instance != null) instance.notifyListeners("consentResult", event, true);
    }

    public static void onCaptureStarted(int width, int height, int frameRate) {
        JSObject event = new JSObject();
        event.put("width", width);
        event.put("height", height);
        event.put("frameRate", frameRate);
        if (instance != null) instance.notifyListeners("captureStarted", event, true);
    }

    public static void onCaptureFrame(String jpegBase64, int width, int height) {
        JSObject event = new JSObject();
        event.put("jpeg", jpegBase64);
        event.put("width", width);
        event.put("height", height);
        if (instance != null) instance.notifyListeners("captureFrame", event, true);
    }

    private static int clampDimens(int value, int min, int max) {
        if (value < min) return min;
        return Math.min(value, max);
    }
}
