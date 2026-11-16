package com.studyzone.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Exposes the dynamic launcher-icon switch to the web layer.
 *
 * The web app calls StudyZoneIconPlugin.setLauncherIcon({ themeId }) whenever
 * the user picks a color theme, so the Android launcher icon follows the app
 * theme. Exactly one activity alias stays enabled at a time.
 */
@CapacitorPlugin(name = "StudyZoneIconPlugin")
public class StudyZoneIconPlugin extends Plugin {

    @PluginMethod
    public void setLauncherIcon(PluginCall call) {
        String themeId = call.getString("themeId", "original");
        MainActivity activity = (MainActivity) getActivity();
        if (activity == null) {
            call.reject("MainActivity not available");
            return;
        }
        activity.setLauncherIcon(themeId);
        call.resolve();
    }
}
