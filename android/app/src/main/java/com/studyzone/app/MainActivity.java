package com.studyzone.app;

import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

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
 * Handles app shortcuts (page extra) and dynamic app icon switching
 * (PackageManager.setComponentEnabledSetting on activity aliases).
 */
public class MainActivity extends BridgeActivity {

    private static final String ALIAS_ORIGINAL = "com.studyzone.app.MainActivityOriginal";
    private static final String ALIAS_OCEAN = "com.studyzone.app.MainActivityOcean";
    private static final String ALIAS_EMERALD = "com.studyzone.app.MainActivityEmerald";
    private static final String ALIAS_PURPLE = "com.studyzone.app.MainActivityPurple";
    private static final String ALIAS_CRIMSON = "com.studyzone.app.MainActivityCrimson";
    private static final String ALIAS_MIDNIGHT = "com.studyzone.app.MainActivityMidnight";
    private static final String ALIAS_SKY = "com.studyzone.app.MainActivitySky";
    private static final String ALIAS_CYAN = "com.studyzone.app.MainActivityCyan";
    private static final String ALIAS_TURQUOISE = "com.studyzone.app.MainActivityTurquoise";
    private static final String ALIAS_TEAL = "com.studyzone.app.MainActivityTeal";
    private static final String ALIAS_MINT = "com.studyzone.app.MainActivityMint";
    private static final String ALIAS_LIME = "com.studyzone.app.MainActivityLime";
    private static final String ALIAS_VIOLET = "com.studyzone.app.MainActivityViolet";
    private static final String ALIAS_LAVENDER = "com.studyzone.app.MainActivityLavender";
    private static final String ALIAS_INDIGO = "com.studyzone.app.MainActivityIndigo";
    private static final String ALIAS_ROSE = "com.studyzone.app.MainActivityRose";
    private static final String ALIAS_PINK = "com.studyzone.app.MainActivityPink";
    private static final String ALIAS_MAGENTA = "com.studyzone.app.MainActivityMagenta";
    private static final String ALIAS_CORAL = "com.studyzone.app.MainActivityCoral";
    private static final String ALIAS_AMBER = "com.studyzone.app.MainActivityAmber";
    private static final String ALIAS_YELLOW = "com.studyzone.app.MainActivityYellow";
    private static final String ALIAS_GRAPHITE = "com.studyzone.app.MainActivityGraphite";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StudyZoneIconPlugin.class);
        registerPlugin(StudyZoneWidgetPlugin.class);
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

    private void handleOpenPage(Intent intent) {
        if (intent == null || getBridge() == null) return;
        String page = intent.hasExtra("page") ? intent.getStringExtra("page") : null;
        if (page == null && intent.getData() != null) {
            page = intent.getData().getQueryParameter("page");
        }
        if (page == null || page.isEmpty()) return;
        final String target = JSONObject.quote(page);
        final WebView webView = getBridge().getWebView();
        webView.post(() -> webView.evaluateJavascript(
                "setTimeout(function(){window.dispatchEvent(new CustomEvent('studyzone:shortcut-open',{detail:{page:" +
                        target + "}}));},450);",
                null));
    }

    /**
     * Switches the launcher icon by enabling/disabling activity aliases.
     * Only one alias is enabled at a time to avoid duplicate launcher icons.
     */
    public void setLauncherIcon(String themeId) {
        PackageManager pm = getPackageManager();
        if (pm == null) return;

        String targetAlias;
        switch (themeId == null ? "" : themeId) {
            case "ocean": targetAlias = ALIAS_OCEAN; break;
            case "emerald": targetAlias = ALIAS_EMERALD; break;
            case "purple": targetAlias = ALIAS_PURPLE; break;
            case "crimson": targetAlias = ALIAS_CRIMSON; break;
            case "midnight": targetAlias = ALIAS_MIDNIGHT; break;
            case "sky": targetAlias = ALIAS_SKY; break;
            case "cyan": targetAlias = ALIAS_CYAN; break;
            case "turquoise": targetAlias = ALIAS_TURQUOISE; break;
            case "teal": targetAlias = ALIAS_TEAL; break;
            case "mint": targetAlias = ALIAS_MINT; break;
            case "lime": targetAlias = ALIAS_LIME; break;
            case "violet": targetAlias = ALIAS_VIOLET; break;
            case "lavender": targetAlias = ALIAS_LAVENDER; break;
            case "indigo": targetAlias = ALIAS_INDIGO; break;
            case "rose": targetAlias = ALIAS_ROSE; break;
            case "pink": targetAlias = ALIAS_PINK; break;
            case "magenta": targetAlias = ALIAS_MAGENTA; break;
            case "coral": targetAlias = ALIAS_CORAL; break;
            case "amber": targetAlias = ALIAS_AMBER; break;
            case "yellow": targetAlias = ALIAS_YELLOW; break;
            case "graphite": targetAlias = ALIAS_GRAPHITE; break;
            case "original":
            default: targetAlias = ALIAS_ORIGINAL; break;
        }

        String[] aliases = {
                ALIAS_ORIGINAL, ALIAS_OCEAN, ALIAS_EMERALD,
                ALIAS_PURPLE, ALIAS_CRIMSON, ALIAS_MIDNIGHT,
                ALIAS_SKY, ALIAS_CYAN, ALIAS_TURQUOISE, ALIAS_TEAL,
                ALIAS_MINT, ALIAS_LIME,
                ALIAS_VIOLET, ALIAS_LAVENDER, ALIAS_INDIGO,
                ALIAS_ROSE, ALIAS_PINK, ALIAS_MAGENTA,
                ALIAS_CORAL, ALIAS_AMBER, ALIAS_YELLOW, ALIAS_GRAPHITE
        };
        for (String alias : aliases) {
            int state = alias.equals(targetAlias)
                    ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                    : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
            try {
                pm.setComponentEnabledSetting(
                        new ComponentName(getPackageName(), alias),
                        state,
                        PackageManager.DONT_KILL_APP);
            } catch (IllegalArgumentException ignored) {
                // Alias missing from this build: continue with the rest.
            }
        }
    }
}
