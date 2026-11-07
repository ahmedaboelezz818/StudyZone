package com.studyzone.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Study Zone Android shell.
 *
 * The app draws edge-to-edge (required for Android 15 / targetSdk 35) and
 * forwards the real system-bar insets to CSS variables so the web layout can
 * keep its content inside the safe area. The hardware back button, status bar,
 * keyboard and notifications are handled by Capacitor plugins from
 * native-shell.js.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

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
}
