package com.setflow.fitness;

import androidx.activity.BackEventCompat;
import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SetFlowPredictiveBack")
public class PredictiveBackPlugin extends Plugin {
    private OnBackPressedCallback callback;

    @Override
    public void load() {
        callback = new OnBackPressedCallback(false) {
            @Override
            public void handleOnBackStarted(BackEventCompat backEvent) {
                emit("started", backEvent.getProgress());
            }

            @Override
            public void handleOnBackProgressed(BackEventCompat backEvent) {
                emit("progress", backEvent.getProgress());
            }

            @Override
            public void handleOnBackCancelled() {
                emit("cancelled", 0);
            }

            @Override
            public void handleOnBackPressed() {
                emit("invoked", 1);
            }
        };
        getActivity().getOnBackPressedDispatcher().addCallback(getActivity(), callback);
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        callback.setEnabled(call.getBoolean("enabled", false));
        call.resolve();
    }

    private void emit(String type, float progress) {
        JSObject event = new JSObject();
        event.put("type", type);
        event.put("progress", progress);
        bridge.triggerWindowJSEvent("setflowPredictiveBack", event.toString());
    }
}
