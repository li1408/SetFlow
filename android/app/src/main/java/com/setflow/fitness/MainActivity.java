package com.setflow.fitness;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;

import androidx.activity.BackEventCompat;
import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;

public class MainActivity extends BridgeActivity {
    private static final String REST_CHANNEL_ID = "setflow-rest-timers";
    private final OnBackPressedCallback predictiveBackCallback = new OnBackPressedCallback(false) {
        @Override
        public void handleOnBackStarted(BackEventCompat backEvent) {
            emitPredictiveBack("started", backEvent.getProgress());
        }

        @Override
        public void handleOnBackProgressed(BackEventCompat backEvent) {
            emitPredictiveBack("progress", backEvent.getProgress());
        }

        @Override
        public void handleOnBackCancelled() {
            emitPredictiveBack("cancelled", 0);
        }

        @Override
        public void handleOnBackPressed() {
            emitPredictiveBack("invoked", 1);
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getBridge().getWebView().addJavascriptInterface(
            new NativeNavigationBridge(),
            "SetFlowNativeNavigation"
        );
        getOnBackPressedDispatcher().addCallback(this, predictiveBackCallback);
        ensureRestNotificationChannel();
    }

    public void setPredictiveBackEnabled(boolean enabled) {
        predictiveBackCallback.setEnabled(enabled);
    }

    private void emitPredictiveBack(String type, float progress) {
        JSObject event = new JSObject();
        event.put("type", type);
        event.put("progress", progress);
        getBridge().triggerWindowJSEvent("setflowPredictiveBack", event.toString());
    }

    private final class NativeNavigationBridge {
        @JavascriptInterface
        public void setPredictiveBackEnabled(boolean enabled) {
            runOnUiThread(() -> MainActivity.this.setPredictiveBackEnabled(enabled));
        }
    }

    private void ensureRestNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationChannel channel = new NotificationChannel(
            REST_CHANNEL_ID,
            "组间休息提醒",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("在组间休息结束时提醒开始下一组");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.enableLights(true);
        channel.enableVibration(true);
        channel.setSound(
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
            new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build()
        );

        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(channel);
    }
}
