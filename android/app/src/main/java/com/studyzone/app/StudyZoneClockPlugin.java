package com.studyzone.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridges the in-app "Flip Clock notification" setting and the native clock
 * widget to the web layer.
 *
 * No dependency is ever required from the web app: the widget and notification
 * keep working from native SharedPreferences after the WebView is destroyed.
 */
@CapacitorPlugin(name = "StudyZoneClockPlugin")
public class StudyZoneClockPlugin extends Plugin {

    @PluginMethod
    public void setClockNotification(PluginCall call) {
        Context context = getContext().getApplicationContext();
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));

        if (!enabled) {
            StudyZoneClockNotification.setEnabled(context, false);
            StudyZoneClockNotification.hide(context);
            JSObject result = new JSObject();
            result.put("enabled", false);
            result.put("canPost", StudyZoneClockNotification.canPost(context));
            call.resolve(result);
            return;
        }

        if (!StudyZoneClockNotification.canPost(context)) {
            // Do not claim success when Android will silently drop the
            // notification. The web layer asks for POST_NOTIFICATIONS and
            // retries, or offers the app-settings shortcut.
            JSObject result = new JSObject();
            result.put("enabled", false);
            result.put("canPost", false);
            result.put("reason", "permission");
            call.resolve(result);
            return;
        }

        StudyZoneClockNotification.setEnabled(context, true);
        StudyZoneClockNotification.show(context);
        JSObject result = new JSObject();
        result.put("enabled", true);
        result.put("canPost", true);
        call.resolve(result);
    }

    @PluginMethod
    public void getClockNotification(PluginCall call) {
        Context context = getContext().getApplicationContext();
        JSObject result = new JSObject();
        result.put("enabled", StudyZoneClockNotification.isEnabled(context));
        result.put("canPost", StudyZoneClockNotification.canPost(context));
        call.resolve(result);
    }

    @PluginMethod
    public void refreshClockWidget(PluginCall call) {
        StudyZoneClockWidget.updateAll(getContext().getApplicationContext());
        StudyZoneClockNotification.sync(getContext().getApplicationContext());
        call.resolve();
    }

    @PluginMethod
    public void openClockNotificationSettings(PluginCall call) {
        Context context = getContext();
        try {
            Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, context.getPackageName());
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve();
        } catch (RuntimeException error) {
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(Uri.parse("package:" + context.getPackageName()));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(fallback);
                call.resolve();
            } catch (RuntimeException nested) {
                call.reject("Could not open notification settings", nested);
            }
        }
    }
}
