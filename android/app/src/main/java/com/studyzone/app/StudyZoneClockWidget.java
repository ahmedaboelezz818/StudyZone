package com.studyzone.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.text.format.DateFormat;
import android.util.TypedValue;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Real Android home-screen clock widget.
 *
 * The clock digits are {@link android.widget.TextClock} views. The launcher
 * owns their ticking, so the time stays correct while Study Zone is closed,
 * after the screen is locked and after the device wakes up, without any
 * background service and without calling AppWidgetManager every second.
 *
 * updatePeriodMillis is 0 because TextClock refreshes itself. The widget is
 * redrawn only when the theme, locale, timezone or focus state changes.
 */
public class StudyZoneClockWidget extends AppWidgetProvider {

    static final String ACTION_REFRESH_CLOCK_WIDGET = "com.studyzone.app.action.REFRESH_CLOCK_WIDGET";
    private static final String PREFS_NAME = "studyzone_widget";
    private static final String KEY_THEME = "widget_theme";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) updateOne(context, manager, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager,
                                          int appWidgetId, Bundle newOptions) {
        updateOne(context, manager, appWidgetId);
    }

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        updateAll(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent == null ? null : intent.getAction();
        if (action == null) return;
        if (ACTION_REFRESH_CLOCK_WIDGET.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)
                || Intent.ACTION_DATE_CHANGED.equals(action)
                || Intent.ACTION_LOCALE_CHANGED.equals(action)) {
            updateAll(context);
        }
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, StudyZoneClockWidget.class);
        int[] ids = manager.getAppWidgetIds(component);
        for (int id : ids) updateOne(context, manager, id);
    }

    static void updateOne(Context context, AppWidgetManager manager, int appWidgetId) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String themeId = prefs.getString(KEY_THEME, "original");
            String focusJson = prefs.getString("widget_data_json_focus", "{}");

            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_clock);
            int bg = color(context, "widget_background_" + themeId, "widget_background");
            int text = color(context, "widget_text_" + themeId, "widget_text");
            int muted = color(context, "widget_muted_" + themeId, "widget_muted");
            int border = color(context, "widget_border_" + themeId, "widget_border");
            int primary = color(context, "widget_primary_" + themeId, "widget_primary");
            int card = blend(bg, text, 0.09f);

            views.setInt(R.id.widget_clock_root, "setBackgroundColor", bg);
            views.setInt(R.id.widget_clock_hour, "setBackgroundColor", card);
            views.setInt(R.id.widget_clock_minute, "setBackgroundColor", card);
            views.setInt(R.id.widget_clock_card, "setBackgroundColor", Color.TRANSPARENT);
            views.setInt(R.id.widget_clock_top_rule, "setBackgroundColor", primary);
            views.setTextColor(R.id.widget_clock_hour, text);
            views.setTextColor(R.id.widget_clock_minute, text);
            views.setTextColor(R.id.widget_clock_colon, primary);
            views.setTextColor(R.id.widget_clock_ampm, muted);
            views.setTextColor(R.id.widget_clock_seconds, muted);
            views.setTextColor(R.id.widget_clock_date, muted);
            views.setTextColor(R.id.widget_clock_status, muted);
            views.setInt(R.id.widget_clock_divider, "setBackgroundColor", border);

            boolean is24 = DateFormat.is24HourFormat(context);
            views.setViewVisibility(R.id.widget_clock_ampm, is24 ? android.view.View.GONE : android.view.View.VISIBLE);

            Locale locale = Locale.getDefault();
            String pattern = is24 ? "EEEE، d MMMM" : "EEEE, d MMMM";
            String dateText;
            try {
                dateText = new SimpleDateFormat(pattern, locale).format(new Date());
            } catch (RuntimeException error) {
                dateText = DateFormat.getDateFormat(context).format(new Date());
            }
            views.setTextViewText(R.id.widget_clock_date, dateText);

            String status = clockStatus(context, focusJson);
            views.setTextViewText(R.id.widget_clock_status, status);

            // Larger widget sizes get larger digits (the launcher tells us the
            // real cell size after a resize).
            Bundle options = manager.getAppWidgetOptions(appWidgetId);
            int minHeight = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
            float size = minHeight >= 220 ? 54f : minHeight >= 150 ? 44f : 36f;
            setTextSize(views, R.id.widget_clock_hour, size);
            setTextSize(views, R.id.widget_clock_minute, size);
            setTextSize(views, R.id.widget_clock_colon, size - 4f);
            setTextSize(views, R.id.widget_clock_ampm, Math.max(11f, size * 0.28f));
            setTextSize(views, R.id.widget_clock_seconds, Math.max(11f, size * 0.34f));

            Intent launch = new Intent(context, MainActivity.class);
            launch.setAction(Intent.ACTION_VIEW);
            launch.putExtra("page", "focus");
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pending = PendingIntent.getActivity(context, appWidgetId, launch,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_clock_root, pending);

            manager.updateAppWidget(appWidgetId, views);
        } catch (RuntimeException error) {
            // Never crash the launcher's widget host.
            android.util.Log.e("StudyZoneClockWidget", "clock widget update failed", error);
        }
    }

    private static void setTextSize(RemoteViews views, int viewId, float sp) {
        views.setTextViewTextSize(viewId, TypedValue.COMPLEX_UNIT_SP, sp);
    }

    private static String clockStatus(Context context, String focusJson) {
        String status = optString(focusJson, "status", "");
        String time = optString(focusJson, "time", "");
        boolean ar = "ar".equalsIgnoreCase(Locale.getDefault().getLanguage());
        if (status.isEmpty() || "idle".equalsIgnoreCase(status) || "00:00".equals(time)) {
            return ar ? "افتح Study Zone" : "Study Zone";
        }
        return (ar ? "تركيز · " : "Focus · ") + time;
    }

    private static int color(Context context, String themedName, String fallbackName) {
        int id = context.getResources().getIdentifier(themedName, "color", context.getPackageName());
        if (id == 0) {
            id = context.getResources().getIdentifier(fallbackName, "color", context.getPackageName());
        }
        if (id == 0) return Color.BLACK;
        return context.getColor(id);
    }

    private static int blend(int base, int overlay, float amount) {
        float keep = 1f - amount;
        return Color.argb(
                255,
                Math.round(Color.red(base) * keep + Color.red(overlay) * amount),
                Math.round(Color.green(base) * keep + Color.green(overlay) * amount),
                Math.round(Color.blue(base) * keep + Color.blue(overlay) * amount));
    }

    private static String optString(String json, String key, String fallback) {
        try {
            Matcher matcher = Pattern.compile(
                    "\"" + Pattern.quote(key) + "\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\"").matcher(json);
            if (matcher.find()) {
                return matcher.group(1).replace("\\\"", "\"").replace("\\\\", "\\");
            }
        } catch (Exception ignored) {
        }
        return fallback;
    }
}
