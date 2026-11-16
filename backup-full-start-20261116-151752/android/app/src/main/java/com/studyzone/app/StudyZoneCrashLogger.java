package com.studyzone.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import java.io.PrintWriter;
import java.io.StringWriter;

/**
 * Stores the most recent uncaught Java exception so a startup crash can be
 * inspected from the device without an attached debugger. The previous handler
 * is always called afterwards, so Android's normal crash reporting still runs.
 */
public final class StudyZoneCrashLogger {
    private static final String PREFS = "studyzone.diagnostics";
    private static final String KEY_LAST_CRASH = "last_crash";
    private static final String KEY_LAST_CRASH_AT = "last_crash_at";
    private static final int MAX_LENGTH = 12000;

    private StudyZoneCrashLogger() {}

    public static void install(Context context) {
        if (context == null) return;
        final Context appContext = context.getApplicationContext();
        final Thread.UncaughtExceptionHandler previous =
                Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            try {
                StringWriter buffer = new StringWriter();
                error.printStackTrace(new PrintWriter(buffer));
                String trace = buffer.toString();
                if (trace.length() > MAX_LENGTH) trace = trace.substring(0, MAX_LENGTH);
                appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                        .edit()
                        .putString(KEY_LAST_CRASH, trace)
                        .putLong(KEY_LAST_CRASH_AT, System.currentTimeMillis())
                        .apply();
                Log.e("StudyZoneCrash", "Uncaught exception on " + thread.getName(), error);
            } catch (Throwable ignored) {
                /* never replace the real crash with a logging failure */
            }
            if (previous != null) previous.uncaughtException(thread, error);
        });
    }

    public static String lastCrash(Context context) {
        if (context == null) return "";
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return prefs.getString(KEY_LAST_CRASH, "");
    }

    public static long lastCrashAt(Context context) {
        if (context == null) return 0L;
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return prefs.getLong(KEY_LAST_CRASH_AT, 0L);
    }

    public static void clear(Context context) {
        if (context == null) return;
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .remove(KEY_LAST_CRASH)
                .remove(KEY_LAST_CRASH_AT)
                .apply();
    }
}
