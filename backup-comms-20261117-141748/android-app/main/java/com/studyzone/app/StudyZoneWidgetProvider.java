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
import android.widget.RemoteViews;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

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
        updateClass(context, manager, StudyZoneContributionsWidgetSmall.class, "contributions_small");
        updateClass(context, manager, StudyZoneContributionsWidgetMedium.class, "contributions_medium");
        updateClass(context, manager, StudyZoneContributionsWidgetLarge.class, "contributions_large");
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
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String themeId = prefs.getString(KEY_THEME, "original");
            String dataJson = prefs.getString("widget_data_json_" + type,
                    prefs.getString("widget_data_json" + appWidgetId, "{}"));

            RemoteViews views = new RemoteViews(context.getPackageName(), layoutFor(type));
            try {
                applyTheme(context, views, themeId, type);
            } catch (RuntimeException themeError) {
                // A theme mismatch must never stop the widget from rendering.
                android.util.Log.w("StudyZoneWidget", "theme apply failed", themeError);
            }
            try {
                populateData(context, views, type, dataJson, themeId);
            } catch (RuntimeException dataError) {
                android.util.Log.w("StudyZoneWidget", "data populate failed", dataError);
            }

            Intent launch = new Intent(context, MainActivity.class);
            launch.setAction(Intent.ACTION_VIEW);
            launch.putExtra("page", pageFor(type));
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pending = PendingIntent.getActivity(context, appWidgetId, launch,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_root, pending);

            manager.updateAppWidget(appWidgetId, views);
        } catch (RuntimeException error) {
            // Never let an exception escape into the launcher process: that is
            // what produces the "Can't load widget" message on many launchers.
            android.util.Log.e("StudyZoneWidget", "update failed for " + type, error);
        }
    }

    private static int layoutFor(String type) {
        switch (type) {
            case "large_tasks": return R.layout.widget_large_tasks;
            case "daily_progress": return R.layout.widget_daily_progress;
            case "focus": return R.layout.widget_focus;
            case "upcoming_deadlines": return R.layout.widget_upcoming_deadlines;
            case "contributions_small": return R.layout.widget_contributions_small;
            case "contributions_medium": return R.layout.widget_contributions_medium;
            case "contributions_large": return R.layout.widget_contributions_large;
            case "today_tasks":
            default: return R.layout.widget_today_tasks;
        }
    }

    private static String pageFor(String type) {
        switch (type) {
            case "focus": return "focus";
            case "daily_progress": return "dashboard";
            case "upcoming_deadlines": return "deadlines";
            case "contributions_small":
            case "contributions_medium":
            case "contributions_large": return "analytics";
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
            case "contributions_small":
            case "contributions_medium":
            case "contributions_large":
                views.setTextColor(R.id.widget_contrib_title, text);
                views.setTextColor(R.id.widget_contrib_summary, muted);
                views.setTextColor(R.id.widget_contrib_open, muted);
                views.setInt(R.id.widget_contrib_divider, "setBackgroundColor", border);
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

    private static void populateData(Context context, RemoteViews views, String type, String json, String themeId) {
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
            case "contributions_small":
            case "contributions_medium":
            case "contributions_large":
                views.setTextViewText(R.id.widget_contrib_title, value(json, "title", "Activity"));
                views.setTextViewText(
                    R.id.widget_contrib_summary,
                    value(json, "summary", String.valueOf(number(json, "activeDays", 0)) + " days")
                );
                views.setTextViewText(R.id.widget_contrib_open, "Tap to open analytics");
                populateContributionCells(context, views, type, json, themeId);
                break;
            default:
                break;
        }
    }

    private static int contributionCellId(String type, int row, int column) {
        if ("contributions_small".equals(type)) {
            switch (column) {
                case 0: return R.id.widget_contrib_cell_0;
                case 1: return R.id.widget_contrib_cell_1;
                case 2: return R.id.widget_contrib_cell_2;
                case 3: return R.id.widget_contrib_cell_3;
                case 4: return R.id.widget_contrib_cell_4;
                case 5: return R.id.widget_contrib_cell_5;
                default: return R.id.widget_contrib_cell_6;
            }
        }
        if ("contributions_medium".equals(type)) {
            switch (row) {
                case 0:
                    switch (column) {
                        case 0: return R.id.widget_contrib_cell_m_0_0;
                        case 1: return R.id.widget_contrib_cell_m_0_1;
                        case 2: return R.id.widget_contrib_cell_m_0_2;
                        case 3: return R.id.widget_contrib_cell_m_0_3;
                        case 4: return R.id.widget_contrib_cell_m_0_4;
                        case 5: return R.id.widget_contrib_cell_m_0_5;
                        default: return R.id.widget_contrib_cell_m_0_6;
                    }
                case 1:
                    switch (column) {
                        case 0: return R.id.widget_contrib_cell_m_1_0;
                        case 1: return R.id.widget_contrib_cell_m_1_1;
                        case 2: return R.id.widget_contrib_cell_m_1_2;
                        case 3: return R.id.widget_contrib_cell_m_1_3;
                        case 4: return R.id.widget_contrib_cell_m_1_4;
                        case 5: return R.id.widget_contrib_cell_m_1_5;
                        default: return R.id.widget_contrib_cell_m_1_6;
                    }
                case 2:
                    switch (column) {
                        case 0: return R.id.widget_contrib_cell_m_2_0;
                        case 1: return R.id.widget_contrib_cell_m_2_1;
                        case 2: return R.id.widget_contrib_cell_m_2_2;
                        case 3: return R.id.widget_contrib_cell_m_2_3;
                        case 4: return R.id.widget_contrib_cell_m_2_4;
                        case 5: return R.id.widget_contrib_cell_m_2_5;
                        default: return R.id.widget_contrib_cell_m_2_6;
                    }
                case 3:
                    switch (column) {
                        case 0: return R.id.widget_contrib_cell_m_3_0;
                        case 1: return R.id.widget_contrib_cell_m_3_1;
                        case 2: return R.id.widget_contrib_cell_m_3_2;
                        case 3: return R.id.widget_contrib_cell_m_3_3;
                        case 4: return R.id.widget_contrib_cell_m_3_4;
                        case 5: return R.id.widget_contrib_cell_m_3_5;
                        default: return R.id.widget_contrib_cell_m_3_6;
                    }
                case 4:
                    switch (column) {
                        case 0: return R.id.widget_contrib_cell_m_4_0;
                        case 1: return R.id.widget_contrib_cell_m_4_1;
                        case 2: return R.id.widget_contrib_cell_m_4_2;
                        case 3: return R.id.widget_contrib_cell_m_4_3;
                        case 4: return R.id.widget_contrib_cell_m_4_4;
                        case 5: return R.id.widget_contrib_cell_m_4_5;
                        default: return R.id.widget_contrib_cell_m_4_6;
                    }
                case 5:
                    switch (column) {
                        case 0: return R.id.widget_contrib_cell_m_5_0;
                        case 1: return R.id.widget_contrib_cell_m_5_1;
                        case 2: return R.id.widget_contrib_cell_m_5_2;
                        case 3: return R.id.widget_contrib_cell_m_5_3;
                        case 4: return R.id.widget_contrib_cell_m_5_4;
                        case 5: return R.id.widget_contrib_cell_m_5_5;
                        default: return R.id.widget_contrib_cell_m_5_6;
                    }
                default: return R.id.widget_contrib_cell_m_0_0;
            }
        }
        if ("contributions_large".equals(type)) {
            switch (row) {
                case 0:
                    switch (column) {
                        case 0: return R.id.widget_contrib_cell_l_0_0;
                        case 1: return R.id.widget_contrib_cell_l_0_1;
                        case 2: return R.id.widget_contrib_cell_l_0_2;
                        case 3: return R.id.widget_contrib_cell_l_0_3;
                        case 4: return R.id.widget_contrib_cell_l_0_4;
                        case 5: return R.id.widget_contrib_cell_l_0_5;
                        default: return R.id.widget_contrib_cell_l_0_6;
                    }
                case 1:
                    switch (column) {
                        case 0: return R.id.widget_contrib_cell_l_1_0;
                        case 1: return R.id.widget_contrib_cell_l_1_1;
                        case 2: return R.id.widget_contrib_cell_l_1_2;
                        case 3: return R.id.widget_contrib_cell_l_1_3;
                        case 4: return R.id.widget_contrib_cell_l_1_4;
                        case 5: return R.id.widget_contrib_cell_l_1_5;
                        default: return R.id.widget_contrib_cell_l_1_6;
                    }
                case 2:
                    switch (column) {
                        case 0: return R.id.widget_contrib_cell_l_2_0;
                        case 1: return R.id.widget_contrib_cell_l_2_1;
                        case 2: return R.id.widget_contrib_cell_l_2_2;
                        case 3: return R.id.widget_contrib_cell_l_2_3;
                        case 4: return R.id.widget_contrib_cell_l_2_4;
                        case 5: return R.id.widget_contrib_cell_l_2_5;
                        default: return R.id.widget_contrib_cell_l_2_6;
                    }
                case 3:
                    switch (column) {
                        case 0: return R.id.widget_contrib_cell_l_3_0;
                        case 1: return R.id.widget_contrib_cell_l_3_1;
                        case 2: return R.id.widget_contrib_cell_l_3_2;
                        case 3: return R.id.widget_contrib_cell_l_3_3;
                        case 4: return R.id.widget_contrib_cell_l_3_4;
                        case 5: return R.id.widget_contrib_cell_l_3_5;
                        default: return R.id.widget_contrib_cell_l_3_6;
                    }
                case 4:
                    switch (column) {
                        case 0: return R.id.widget_contrib_cell_l_4_0;
                        case 1: return R.id.widget_contrib_cell_l_4_1;
                        case 2: return R.id.widget_contrib_cell_l_4_2;
                        case 3: return R.id.widget_contrib_cell_l_4_3;
                        case 4: return R.id.widget_contrib_cell_l_4_4;
                        case 5: return R.id.widget_contrib_cell_l_4_5;
                        default: return R.id.widget_contrib_cell_l_4_6;
                    }
                case 5:
                    switch (column) {
                        case 0: return R.id.widget_contrib_cell_l_5_0;
                        case 1: return R.id.widget_contrib_cell_l_5_1;
                        case 2: return R.id.widget_contrib_cell_l_5_2;
                        case 3: return R.id.widget_contrib_cell_l_5_3;
                        case 4: return R.id.widget_contrib_cell_l_5_4;
                        case 5: return R.id.widget_contrib_cell_l_5_5;
                        default: return R.id.widget_contrib_cell_l_5_6;
                    }
                case 6:
                    switch (column) {
                        case 0: return R.id.widget_contrib_cell_l_6_0;
                        case 1: return R.id.widget_contrib_cell_l_6_1;
                        case 2: return R.id.widget_contrib_cell_l_6_2;
                        case 3: return R.id.widget_contrib_cell_l_6_3;
                        case 4: return R.id.widget_contrib_cell_l_6_4;
                        case 5: return R.id.widget_contrib_cell_l_6_5;
                        default: return R.id.widget_contrib_cell_l_6_6;
                    }
                default: return R.id.widget_contrib_cell_l_0_0;
            }
        }
        return 0;
    }

    private static int cellColor(Context context, String themeId, int level) {
        int backgroundId = context.getResources().getIdentifier(
            "widget_background_" + themeId,
            "color",
            context.getPackageName()
        );
        int background = backgroundId == 0 ? Color.BLACK : context.getColor(backgroundId);
        if (level <= 0) {
            return background;
        }
        int primaryId = context.getResources().getIdentifier(
            "widget_primary_" + themeId,
            "color",
            context.getPackageName()
        );
        int primary = primaryId == 0 ? Color.MAGENTA : context.getColor(primaryId);
        float alpha = level == 1 ? 0.16f : level == 2 ? 0.38f : level == 3 ? 0.66f : 1f;
        return Color.argb(
            Math.round(255 * alpha),
            Color.red(primary),
            Color.green(primary),
            Color.blue(primary)
        );
    }

    private static void populateContributionCells(Context context, RemoteViews views, String type, String json, String themeId) {
        try {
            JSONObject data = new JSONObject(json);
            JSONArray weeks = data.optJSONArray("weeks");
            int rowCount = weeks == null ? 0 : weeks.length();
            if ("contributions_small".equals(type)) rowCount = 1;
            if ("contributions_medium".equals(type)) rowCount = Math.min(6, Math.max(0, rowCount));
            if ("contributions_large".equals(type)) rowCount = Math.min(53, Math.max(0, rowCount));

            int maxRows = "contributions_medium".equals(type) ? 6 : ("contributions_large".equals(type) ? 53 : 1);
            for (int row = 0; row < maxRows; row += 1) {
                JSONArray week = row < rowCount && weeks != null ? weeks.optJSONArray(row) : null;
                for (int column = 0; column < 7; column += 1) {
                    int level = week == null ? 0 : week.optInt(column, 0);
                    int cellId = contributionCellId(type, row, column);
                    views.setInt(cellId, "setBackgroundColor", cellColor(context, themeId, level));
                    views.setTextColor(cellId, context.getColor(
                        context.getResources().getIdentifier(
                            "widget_text_" + themeId,
                            "color",
                            context.getPackageName()
                        )
                    ));
                }
            }
        } catch (JSONException ignored) {
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
