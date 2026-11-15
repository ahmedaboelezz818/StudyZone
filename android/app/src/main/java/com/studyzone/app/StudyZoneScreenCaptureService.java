package com.studyzone.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

/**
 * Foreground service that owns the MediaProjection session requested by the
 * user. It only starts after the user approves the system consent dialog.
 *
 * Captured frames are delivered to the WebView as base64 JPEG frames; the web
 * layer draws them on a canvas and exposes the canvas as a MediaStream track
 * for the ongoing WebRTC call. The user can stop capture at any time, which
 * releases the VirtualDisplay, the ImageReader and the MediaProjection.
 */
public class StudyZoneScreenCaptureService extends Service {

    public static final String CHANNEL_ID = "studyzone_screen_capture_v1";
    public static final String ACTION_CONSENT = "com.studyzone.app.action.SCREEN_CAPTURE_CONSENT";
    public static final String ACTION_STOP = "com.studyzone.app.action.SCREEN_CAPTURE_STOP";
    public static final String ACTION_RETURN = "com.studyzone.app.action.SCREEN_CAPTURE_RETURN";

    public static final int NOTIFICATION_ID = 930000;

    public static final String EXTRA_MAX_WIDTH = "max_width";
    public static final String EXTRA_MAX_HEIGHT = "max_height";
    public static final String EXTRA_FRAME_RATE = "frame_rate";

    private MediaProjection projection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private HandlerThread captureThread;
    private Handler captureHandler;
    private int maxWidth = 720;
    private int maxHeight = 1280;
    private int frameRate = 4;
    private long lastEmittedAtMs = 0L;
    private int screenWidth = 0;
    private int screenHeight = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_STOP.equals(action)) {
            stopCapture();
            return START_NOT_STICKY;
        }
        if (ACTION_CONSENT.equals(action)) {
            int resultCode = intent.getIntExtra("consent_result_code", 0);
            Intent consentData = intent.getParcelableExtra("consent_result_data");
            maxWidth = clampDimens(intent.getIntExtra(EXTRA_MAX_WIDTH, 720), 240, 1280);
            maxHeight = clampDimens(intent.getIntExtra(EXTRA_MAX_HEIGHT, 1280), 240, 1280);
            frameRate = clampDimens(intent.getIntExtra(EXTRA_FRAME_RATE, 4), 1, 12);
            startForegroundWithNotification();
            beginCapture(resultCode, consentData);
            return START_NOT_STICKY;
        }
        return START_NOT_STICKY;
    }

    private void startForegroundWithNotification() {
        Intent returnIntent = new Intent(this, MainActivity.class);
        returnIntent.setAction(ACTION_RETURN);
        returnIntent.putExtra("page", "team-live");
        returnIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent returnPending = PendingIntent.getActivity(this,
                NOTIFICATION_ID + 1,
                returnIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent stopIntent = new Intent(this, StudyZoneScreenCaptureService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(this,
                NOTIFICATION_ID + 2,
                stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_studyzone)
                .setContentTitle(getString(R.string.screen_capture_title))
                .setContentText(getString(R.string.screen_capture_text))
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setContentIntent(returnPending)
                .addAction(R.drawable.ic_call_decline, getString(R.string.screen_capture_stop), stopPending)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void beginCapture(int resultCode, Intent consentData) {
        if (resultCode == 0 || consentData == null) {
            StudyZoneScreenCapturePlugin.emitConsentResult(false, "consent_missing");
            stopSelf();
            return;
        }
        captureThread = new HandlerThread("studyzone-screen-capture");
        captureThread.start();
        captureHandler = new Handler(captureThread.getLooper());

        MediaProjectionManager manager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        projection = manager.getMediaProjection(resultCode, consentData);
        if (projection == null) {
            StudyZoneScreenCapturePlugin.emitConsentResult(false, "projection_unavailable");
            stopSelf();
            return;
        }
        projection.registerCallback(new MediaProjection.Callback() {
            @Override
            public void onStop() {
                StudyZoneScreenCapturePlugin.emitConsentResult(true, "stopped");
                stopCapture();
            }
        }, new Handler(Looper.getMainLooper()));

        android.util.DisplayMetrics metrics = getResources().getDisplayMetrics();
        screenWidth = Math.max(1, metrics.widthPixels);
        screenHeight = Math.max(1, metrics.heightPixels);
        float scale = Math.min(1f, Math.min((float) maxWidth / screenWidth, (float) maxHeight / screenHeight));
        int width = Math.max(1, Math.round(screenWidth * scale));
        int height = Math.max(1, Math.round(screenHeight * scale));

        imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2);
        imageReader.setOnImageAvailableListener(this::onImageAvailable, captureHandler);

        virtualDisplay = projection.createVirtualDisplay(
                "StudyZoneScreenCapture",
                width,
                height,
                Math.max(1, metrics.densityDpi),
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader.getSurface(),
                null,
                captureHandler);

        if (virtualDisplay == null) {
            StudyZoneScreenCapturePlugin.emitConsentResult(false, "virtual_display_unavailable");
            stopCapture();
            return;
        }
        StudyZoneScreenCapturePlugin.emitConsentResult(true, "started");
        StudyZoneScreenCapturePlugin.onCaptureStarted(width, height, frameRate);
    }

    private void onImageAvailable(ImageReader reader) {
        Image image = null;
        try {
            image = reader.acquireLatestImage();
            if (image == null) return;
            long now = System.currentTimeMillis();
            long minInterval = Math.max(1L, 1000L / Math.max(1, frameRate));
            if (now - lastEmittedAtMs < minInterval) return;
            lastEmittedAtMs = now;

            int width = image.getWidth();
            int height = image.getHeight();
            Image.Plane plane = image.getPlanes()[0];
            ByteBuffer buffer = plane.getBuffer();
            int rowStride = plane.getRowStride();
            int pixelStride = plane.getPixelStride();
            int padding = rowStride - pixelStride * width;

            Bitmap bitmap = Bitmap.createBitmap(width + Math.max(0, padding / Math.max(1, pixelStride)), height, Bitmap.Config.ARGB_8888);
            bitmap.copyPixelsFromBuffer(buffer);

            int targetWidth = Math.min(width, maxWidth);
            int targetHeight = Math.min(height, maxHeight);
            if (targetWidth != width || targetHeight != height) {
                Bitmap scaled = Bitmap.createScaledBitmap(bitmap, targetWidth, targetHeight, true);
                bitmap.recycle();
                bitmap = scaled;
            }

            ByteArrayOutputStream output = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, 55, output);
            bitmap.recycle();
            byte[] jpeg = output.toByteArray();
            String encoded = Base64.encodeToString(jpeg, Base64.NO_WRAP);
            StudyZoneScreenCapturePlugin.onCaptureFrame(encoded, targetWidth, targetHeight);
        } catch (Throwable error) {
            Log.w("StudyZoneCapture", "frame failed", error);
        } finally {
            if (image != null) image.close();
        }
    }

    private void stopCapture() {
        if (captureHandler != null) captureHandler.removeCallbacksAndMessages(null);
        if (captureThread != null) {
            captureThread.quitSafely();
            captureThread = null;
            captureHandler = null;
        }
        if (virtualDisplay != null) {
            try { virtualDisplay.release(); } catch (Throwable ignored) {}
            virtualDisplay = null;
        }
        if (imageReader != null) {
            try { imageReader.close(); } catch (Throwable ignored) {}
            imageReader = null;
        }
        if (projection != null) {
            try { projection.stop(); } catch (Throwable ignored) {}
            projection = null;
        }
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(NOTIFICATION_ID);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopCapture();
        super.onDestroy();
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                getString(R.string.screen_capture_channel_name),
                NotificationManager.IMPORTANCE_LOW);
        channel.setDescription(getString(R.string.screen_capture_channel_description));
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }

    private static int clampDimens(int value, int min, int max) {
        if (value < min) return min;
        return Math.min(value, max);
    }
}
