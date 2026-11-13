package com.studyzone.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Settings;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Microphone permission bridge for voice notes.
 *
 * WebView getUserMedia() can only produce a generic "NotAllowedError". The
 * difference between "the user tapped Deny once" and "the user selected Don't
 * ask again" matters: only the second case needs the Android app-settings
 * screen. Capacitor tracks that state (PERMISSION_PREFS_NAME) so the web layer
 * can show the correct affordance instead of an endless retry loop.
 *
 * The manifest declares RECORD_AUDIO + MODIFY_AUDIO_SETTINGS; Capacitor's
 * BridgeWebChromeClient performs the actual runtime request for getUserMedia.
 */
@CapacitorPlugin(
    name = "StudyZonePermissions",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone")
    }
)
public class StudyZonePermissionsPlugin extends Plugin {

    @PluginMethod
    public void checkMicrophone(PluginCall call) {
        JSObject result = new JSObject();
        PermissionState state = getPermissionState("microphone");
        result.put("state", state == null ? "prompt" : state.toString());
        result.put("granted", state == PermissionState.GRANTED);
        result.put("blocked", state == PermissionState.DENIED);
        call.resolve(result);
    }

    @PluginMethod
    public void requestMicrophone(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            result.put("blocked", false);
            result.put("state", "granted");
            call.resolve(result);
            return;
        }
        requestPermissionForAlias("microphone", call, "microphoneCallback");
    }

    @PermissionCallback
    private void microphoneCallback(PluginCall call) {
        PermissionState state = getPermissionState("microphone");
        JSObject result = new JSObject();
        boolean granted = state == PermissionState.GRANTED;
        result.put("granted", granted);
        result.put("blocked", state == PermissionState.DENIED);
        result.put("state", state == null ? "prompt" : state.toString());
        call.resolve(result);
    }

    /** Opens this app's system settings page (Permissions → Microphone). */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Context context = getContext();
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + context.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not open app settings", error);
        }
    }

    /** True when the OS has granted RECORD_AUDIO; used by diagnostics. */
    @PluginMethod
    public void canRecord(PluginCall call) {
        boolean granted = ActivityCompat.checkSelfPermission(
            getContext(), Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED;
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }
}
