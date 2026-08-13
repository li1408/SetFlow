package com.setflow.fitness;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SetFlowPredictiveBack")
public class PredictiveBackPlugin extends Plugin {
    @PluginMethod
    public void setEnabled(PluginCall call) {
        if (!(getActivity() instanceof MainActivity)) {
            call.reject("Predictive back requires SetFlow MainActivity");
            return;
        }
        ((MainActivity) getActivity()).setPredictiveBackEnabled(
            call.getBoolean("enabled", false)
        );
        call.resolve();
    }
}
