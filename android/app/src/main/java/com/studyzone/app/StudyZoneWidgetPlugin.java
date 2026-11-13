package com.studyzone.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Receives widget data from the web layer and refreshes every home-screen
 * widget. Data is stored per widget type so the five widget providers can read
 * their own payload from the same preferences file.
 */
@CapacitorPlugin(name = "StudyZoneWidgetPlugin")
public class StudyZoneWidgetPlugin extends Plugin {

    static final String PREFS_NAME = "studyzone_widget";
    static final String KEY_THEME = "widget_theme";

    @PluginMethod
    public void setWidgetData(PluginCall call) {
        String themeId = call.getString("themeId", "original");
        String widgetType = call.getString("widgetType", "today_tasks");
        String dataJson = call.getString("dataJson", "{}");

        Context context = getContext().getApplicationContext();
        SharedPreferences.Editor editor =
                context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit();
        editor.putString(KEY_THEME, themeId);
        editor.putString("widget_data_json_" + widgetType, dataJson);
        editor.apply();

        StudyZoneWidgetProvider.updateAll(context);
        StudyZoneClockWidget.updateAll(context);
        call.resolve();
    }

    @PluginMethod
    public void requestWidgetUpdate(PluginCall call) {
        StudyZoneWidgetProvider.updateAll(getContext().getApplicationContext());
        call.resolve();
    }
}
