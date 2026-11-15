package com.studyzone.app;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import android.util.Log;

import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

/**
 * Study Zone Android shell.
 *
 * The app draws edge-to-edge (required for Android 15 / targetSdk 35) and
 * forwards the real system-bar insets to CSS variables so the web layout can
 * keep its content inside the safe area. The hardware back button, status bar,
 * keyboard and notifications are handled by Capacitor plugins from
 * native-shell.js.
 *
 * It is deliberately the single, stable launcher activity. Earlier builds
 * toggled `activity-alias` launcher entries at runtime to swap the app icon.
 * That could leave the home-screen shortcut bound to a disabled component
 * (opening Android "App info" instead of the app) and could interrupt the
 * running task whenever the theme changed. Theme identity is now applied in the
 * web UI and the widgets, which cannot break app startup.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StudyZoneIconPlugin.class);
        registerPlugin(StudyZoneWidgetPlugin.class);
        registerPlugin(StudyZonePermissionsPlugin.class);
        registerPlugin(StudyZoneClockPlugin.class);
        registerPlugin(StudyZoneCallServicePlugin.class);
        registerPlugin(StudyZoneScreenCapturePlugin.class);
        super.onCreate(savedInstanceState);

        handleOpenPage(getIntent());

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        final WebView webView = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(webView, (View view, WindowInsetsCompat insets) -> {
            float density = getResources().getDisplayMetrics().density;
            int top = Math.round(insets.getInsets(WindowInsetsCompat.Type.statusBars()).top / density);
            int bottom = Math.round(insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom / density);
            int left = Math.round(insets.getInsets(WindowInsetsCompat.Type.systemBars()).left / density);
            int right = Math.round(insets.getInsets(WindowInsetsCompat.Type.systemBars()).right / density);

            final String script =
                "(function(){var r=document.documentElement;" +
                "r.style.setProperty('--safe-top','" + top + "px');" +
                "r.style.setProperty('--safe-bottom','" + bottom + "px');" +
                "r.style.setProperty('--safe-left','" + left + "px');" +
                "r.style.setProperty('--safe-right','" + right + "px');" +
                "r.classList.add('native-app');" +
                "})();";

            view.post(() -> webView.evaluateJavascript(script, null));
            return insets;
        });
        ViewCompat.requestApplyInsets(webView);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleOpenPage(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        // Re-sync the native clock surfaces with the real system time and the
        // currently selected theme. TextClock updates itself, but a reboot,
        // resize or theme change still needs one refresh.
        StudyZoneClockWidget.updateAll(this);
        StudyZoneClockNotification.sync(this);
        dispatchPendingCallAction();
    }

    private void handleOpenPage(Intent intent) {
        if (intent == null || getBridge() == null) return;

        String action = intent.getAction();
        String callId = intent.getStringExtra(CallNotificationHelper.EXTRA_CALL_ID);
        if (action != null && callId != null && !callId.isEmpty()) {
            if (action.startsWith(CallNotificationHelper.ACTION_ACCEPT)) {
                CallNotificationHelper.savePendingAction(
                        this, "accept", callId, CallNotificationHelper.payloadJson(intent));
            } else if (action.startsWith(CallNotificationHelper.ACTION_DECLINE)) {
                CallNotificationHelper.savePendingAction(
                        this, "decline", callId, CallNotificationHelper.payloadJson(intent));
            }
        }

        String page = intent.hasExtra("page") ? intent.getStringExtra("page") : null;
        boolean endCallRequest = "1".equals(intent.getStringExtra("studyzone_end_call"));

        dispatchPendingCallAction();
        if (page == null || page.isEmpty()) return;
        final String target = JSONObject.quote(page);
        final WebView webView = getBridge().getWebView();
        if (endCallRequest) {
            String endCallId = intent.getStringExtra(CallNotificationHelper.EXTRA_CALL_ID);
            final String endCallScript =
                    "setTimeout(function(){window.dispatchEvent(new CustomEvent('studyzone:end-call',{detail:{callId:" +
                            JSONObject.quote(endCallId == null ? "" : endCallId) + "}}));},450);";
            webView.post(() -> webView.evaluateJavascript(endCallScript, null));
        }
        webView.post(() -> webView.evaluateJavascript(
                "setTimeout(function(){window.dispatchEvent(new CustomEvent('studyzone:shortcut-open',{detail:{page:" +
                        target + "}}));},450);",
                null));
    }

    private void dispatchPendingCallAction() {
        if (getBridge() == null) return;
        String[] pending = CallNotificationHelper.consumePendingAction(this);
        if (pending == null) return;
        final String action = JSONObject.quote(pending[0]);
        final String callId = JSONObject.quote(pending[1]);
        String payload = pending[2] == null || pending[2].isEmpty() ? "{}" : pending[2];
        final WebView webView = getBridge().getWebView();
        final String script =
                "setTimeout(function(){" +
                "var d={action:" + action + ",callId:" + callId + ",payload:" + payload + "};" +
                "window.__studyZonePendingCallAction=d;" +
                "window.dispatchEvent(new CustomEvent('studyzone:incoming-call-action',{detail:d}));" +
                "},600);";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    /**
     * Kept for API compatibility with StudyZoneIconPlugin.
     *
     * The launcher icon is intentionally no longer swapped at runtime: the
     * alias toggling it relied on was the cause of the "opens Android settings
     * instead of the app" bug and of theme-change interruptions. This method is
     * a safe no-op so existing web calls never throw.
     */
    public void setLauncherIcon(String themeId) {
        Log.d("StudyZoneIcon", "launcher icon is fixed; theme " + themeId + " applies in-app");
    }
}
