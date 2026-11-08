package com.studyzone.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.widget.RemoteViews;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Shared implementation for the five Study Zone home-screen widgets.
 *
 * Each concrete subclass declares one widget type; the Android widget picker
 * shows all five providers. Widget data is written by the web layer through
 * StudyZoneWidgetPlugin and stored per widget type. Theme colors are read from
 * widget_colors.xml and applied at update time so every widget follows the
 * selected app theme (Original, Ocean, Emerald, Purple, Crimson, Midnight).
 */
public abstract class StudyZoneWidgetProvider extends AppWidgetProvider {

    static final String PREFS_NAME = "studyzone_widget";
    static final String KEY_THEME = "widget_theme";

    static final String ACTION_UPDATE_WIDGET = "com.studyzone.app.action.UPDATE_WIDGET";

    protected abstract String widgetType();

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        updateWidgets(context, manager, appWidgetIds, widgetType());
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager,
                                          int appWidgetId, android.os.Bundle newOptions) {
        updateAppWidget(context, manager, appWidgetId, widgetType());
    }

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        // Ensure widget data exists when first widget of this type is enabled.
        StudyZoneWidgetProvider.updateAll(context);
    }

    @Override
    public void onDisabled(Context context) {
        super.onDisabled(context);
    }

    @Override
    public void onRestored(Context context, int[] oldWidgetIds, int[] newWidgetIds) {
        super.onRestored(context, oldWidgetIds, newWidgetIds);
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        updateWidgets(context, manager, newWidgetIds, widgetType());
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_UPDATE_WIDGET.equals(intent.getAction())) {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            ComponentName component = new ComponentName(context, getClass());
            int[] ids = manager.getAppWidgetIds(component);
            updateWidgets(context, manager, ids, widgetType());
        }
    }

    /** Refresh every widget instance of every type. */
    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        updateClass(context, manager, StudyZoneTodayTasksWidget.class, "today_tasks");
        updateClass(context, manager, StudyZoneLargeTasksWidget.class, "large_tasks");
        updateClass(context, manager, StudyZoneDailyProgressWidget.class, "daily_progress");
        updateClass(context, manager, StudyZoneFocusWidget.class, "focus");
        updateClass(context, manager, StudyZoneUpcomingDeadlinesWidget.class, "upcoming_deadlines");
    }

    private static void updateClass(Context context, AppWidgetManager manager,
                                    Class<? extends StudyZoneWidgetProvider> cls, String type) {
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, cls));
        updateWidgets(context, manager, ids, type);
    }

    private static void updateWidgets(Context context, AppWidgetManager manager,
                                      int[] ids, String type) {
        for (int id : ids) {
            updateAppWidget(context, manager, id, type);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager manager,
                                int appWidgetId, String type) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String themeId = prefs.getString(KEY_THEME, "original");
        String dataJson = prefs.getString("widget_data_json_" + type,
                prefs.getString("widget_data_json" + appWidgetId, "{}"));

        RemoteViews views = new RemoteViews(context.getPackageName(), layoutFor(type));
        applyTheme(context, views, themeId, type);
        populateData(views, type, dataJson);

        Intent launch = new Intent(context, MainActivity.class);
        launch.setAction(Intent.ACTION_VIEW);
        launch.putExtra("page", pageFor(type));
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(context, appWidgetId, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pending);

        manager.updateAppWidget(appWidgetId, views);
    }

    private static int layoutFor(String type) {
        switch (type) {
            case "large_tasks": return R.layout.widget_large_tasks;
            case "daily_progress": return R.layout.widget_daily_progress;
            case "focus": return R.layout.widget_focus;
            case "upcoming_deadlines": return R.layout.widget_upcoming_deadlines;
            case "today_tasks":
            default: return R.layout.widget_today_tasks;
        }
    }

    private static String pageFor(String type) {
        switch (type) {
            case "focus": return "focus";
            case "daily_progress": return "dashboard";
            case "upcoming_deadlines": return "deadlines";
            case "today_tasks":
            case "large_tasks":
            default: return "tasks";
        }
    }

    private static void applyTheme(Context context, RemoteViews views, String themeId, String type) {
        int bg = color(context, "widget_background_" + themeId, "widget_background");
        int text = color(context, "widget_text_" + themeId, "widget_text");
        int muted = color(context, "widget_muted_" + themeId, "widget_muted");
        int border = color(context, "widget_border_" + themeId, "widget_border");
        int primary = color(context, "widget_primary_" + themeId, "widget_primary");

        views.setInt(R.id.widget_root, "setBackgroundColor", bg);

        switch (type) {
            case "today_tasks":
                views.setTextColor(R.id.widget_date, text);
                views.setTextColor(R.id.widget_day_name, muted);
                views.setTextColor(R.id.widget_task_count, text);
                views.setTextColor(R.id.widget_empty, muted);
                views.setTextColor(R.id.widget_open_tasks, muted);
                views.setInt(R.id.widget_divider, "setBackgroundColor", border);
                views.setTextColor(R.id.widget_task_count, text);
                break;
            case "large_tasks":
                views.setTextColor(R.id.widget_date, text);
                views.setTextColor(R.id.widget_task_count, muted);
                views.setTextColor(R.id.widget_empty, muted);
                views.setTextColor(R.id.widget_open_tasks, muted);
                views.setInt(R.id.widget_divider, "setBackgroundColor", border);
                views.setTextColor(R.id.widget_task_1, text);
                views.setTextColor(R.id.widget_task_2, text);
                views.setTextColor(R.id.widget_task_3, text);
                views.setTextColor(R.id.widget_task_4, text);
                break;
            case "daily_progress":
                views.setTextColor(R.id.widget_progress_title, text);
                views.setTextColor(R.id.widget_progress_date, muted);
                views.setTextColor(R.id.widget_progress_completed, text);
                views.setTextColor(R.id.widget_progress_focus, muted);
                views.setTextColor(R.id.widget_progress_open, muted);
                views.setInt(R.id.widget_divider, "setBackgroundColor", border);
                break;
            case "focus":
                views.setTextColor(R.id.widget_focus_title, text);
                views.setTextColor(R.id.widget_focus_status, primary);
                views.setTextColor(R.id.widget_focus_time, text);
                views.setTextColor(R.id.widget_focus_session, muted);
                views.setTextColor(R.id.widget_focus_open, muted);
                views.setInt(R.id.widget_divider, "setBackgroundColor", border);
                break;
            case "upcoming_deadlines":
                views.setTextColor(R.id.widget_deadlines_title, text);
                views.setTextColor(R.id.widget_deadline_1, text);
                views.setTextColor(R.id.widget_deadline_2, text);
                views.setTextColor(R.id.widget_deadline_3, text);
                views.setTextColor(R.id.widget_deadlines_open, muted);
                views.setInt(R.id.widget_divider, "setBackgroundColor", border);
                break;
            default:
                break;
        }
    }

    private static int color(Context context, String themedName, String fallbackName) {
        int id = context.getResources().getIdentifier(themedName, "color", context.getPackageName());
        if (id == 0) {
            id = context.getResources().getIdentifier(fallbackName, "color", context.getPackageName());
        }
        if (id == 0) return 0xFF000000;
        return context.getColor(id);
    }

    private static void populateData(RemoteViews views, String type, String json) {
        switch (type) {
            case "today_tasks":
                views.setTextViewText(R.id.widget_date, value(json, "date", "Today"));
                views.setTextViewText(R.id.widget_day_name, value(json, "day", ""));
                views.setTextViewText(R.id.widget_task_count, value(json, "taskCount", "0 tasks"));
                views.setProgressBar(R.id.widget_progress, 100, number(json, "progress", 0), false);
                views.setTextViewText(R.id.widget_empty, value(json, "empty", ""));
                break;
            case "large_tasks":
                views.setTextViewText(R.id.widget_date, value(json, "date", "Today"));
                views.setTextViewText(R.id.widget_task_count, value(json, "taskCount", "0 tasks"));
                views.setTextViewText(R.id.widget_task_1, value(json, "task1", ""));
                views.setTextViewText(R.id.widget_task_2, value(json, "task2", ""));
                views.setTextViewText(R.id.widget_task_3, value(json, "task3", ""));
                views.setTextViewText(R.id.widget_task_4, value(json, "task4", ""));
                views.setTextViewText(R.id.widget_empty, value(json, "empty", ""));
                break;
            case "daily_progress":
                views.setTextViewText(R.id.widget_progress_title, value(json, "title", "Daily Progress"));
                views.setTextViewText(R.id.widget_progress_date, value(json, "date", "Today"));
                views.setTextViewText(R.id.widget_progress_completed, value(json, "completed", "0 / 0 tasks"));
                views.setTextViewText(R.id.widget_progress_focus, value(json, "focus", "0 sessions"));
                views.setProgressBar(R.id.widget_progress_bar, 100, number(json, "progress", 0), false);
                break;
            case "focus":
                views.setTextViewText(R.id.widget_focus_title, value(json, "title", "Focus Timer"));
                views.setTextViewText(R.id.widget_focus_status, value(json, "status", "Idle"));
                views.setTextViewText(R.id.widget_focus_time, value(json, "time", "00:00"));
                views.setTextViewText(R.id.widget_focus_session, value(json, "session", "No active session"));
                break;
            case "upcoming_deadlines":
                views.setTextViewText(R.id.widget_deadlines_title, value(json, "title", "Upcoming Deadlines"));
                views.setTextViewText(R.id.widget_deadline_1, value(json, "deadline1", "No upcoming deadlines"));
                views.setTextViewText(R.id.widget_deadline_2, value(json, "deadline2", ""));
                views.setTextViewText(R.id.widget_deadline_3, value(json, "deadline3", ""));
                break;
            default:
                break;
        }
    }

    private static String value(String json, String key, String fallback) {
        try {
            Matcher matcher = Pattern.compile(
                    "\"" + Pattern.quote(key) + "\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\"")
                    .matcher(json);
            if (matcher.find()) {
                return matcher.group(1).replace("\\\"", "\"").replace("\\\\", "\\");
            }
        } catch (Exception ignored) {
        }
        return fallback;
    }

    private static int number(String json, String key, int fallback) {
        try {
            Matcher matcher = Pattern.compile(
                    "\"" + Pattern.quote(key) + "\"\\s*:\\s*(-?\\d+)").matcher(json);
            if (matcher.find()) {
                return Math.max(0, Math.min(100, Integer.parseInt(matcher.group(1))));
            }
        } catch (Exception ignored) {
        }
        return fallback;
    }
}
