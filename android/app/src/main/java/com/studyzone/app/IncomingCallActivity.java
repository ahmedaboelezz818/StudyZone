package com.studyzone.app;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

public class IncomingCallActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        turnScreenOnAndKeyguard();
        setContentView(R.layout.activity_incoming_call);
        bindUi(getIntent());
        wireActions();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        bindUi(intent);
    }

    private void wireActions() {
        ImageButton accept = findViewById(R.id.incoming_call_accept);
        ImageButton decline = findViewById(R.id.incoming_call_decline);
        if (accept != null) {
            accept.setOnClickListener(v -> {
                Intent action = new Intent(this, IncomingCallReceiver.class);
                action.setAction(CallNotificationHelper.ACTION_ACCEPT);
                CallNotificationHelper.copyExtras(getIntent(), action);
                sendBroadcast(action);
                finish();
            });
        }
        if (decline != null) {
            decline.setOnClickListener(v -> {
                Intent action = new Intent(this, IncomingCallReceiver.class);
                action.setAction(CallNotificationHelper.ACTION_DECLINE);
                CallNotificationHelper.copyExtras(getIntent(), action);
                sendBroadcast(action);
                finish();
            });
        }
    }

    private void bindUi(Intent intent) {
        if (intent == null) return;
        String caller = safe(intent.getStringExtra(CallNotificationHelper.EXTRA_CALLER_NAME));
        String team = safe(intent.getStringExtra(CallNotificationHelper.EXTRA_TEAM_NAME));
        String type = safe(intent.getStringExtra(CallNotificationHelper.EXTRA_CALL_TYPE));
        String avatar = safe(intent.getStringExtra(CallNotificationHelper.EXTRA_AVATAR));

        TextView callerView = findViewById(R.id.incoming_call_caller);
        TextView subtitleView = findViewById(R.id.incoming_call_subtitle);
        TextView typeView = findViewById(R.id.incoming_call_type);
        TextView avatarView = findViewById(R.id.incoming_call_avatar);

        if (callerView != null) callerView.setText(caller.isEmpty() ? getString(R.string.app_name) : caller);
        if (subtitleView != null) subtitleView.setText(team.isEmpty() ? getString(R.string.title_activity_main) : team);
        if (typeView != null) {
            boolean video = "video".equalsIgnoreCase(type);
            typeView.setText(video ? R.string.incoming_video_call : R.string.incoming_audio_call);
        }
        if (avatarView != null) {
            avatarView.setText(initials(caller, avatar));
        }
    }

    private void turnScreenOnAndKeyguard() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            );
        }
    }

    private String initials(String name, String avatar) {
        if (avatar != null && avatar.length() >= 1 && avatar.length() <= 3) return avatar.toUpperCase();
        if (name == null) return "SZ";
        String trimmed = name.trim();
        if (trimmed.isEmpty()) return "SZ";
        String[] parts = trimmed.split("\\s+");
        if (parts.length == 1) return parts[0].substring(0, Math.min(2, parts[0].length())).toUpperCase();
        return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
