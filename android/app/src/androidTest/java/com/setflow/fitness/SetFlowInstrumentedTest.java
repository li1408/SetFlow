package com.setflow.fitness;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.content.Context;

import androidx.activity.OnBackPressedCallback;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.lang.reflect.Field;

@RunWith(AndroidJUnit4.class)
public class SetFlowInstrumentedTest {
    @Test
    public void usesSetFlowApplicationId() {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("com.setflow.fitness", appContext.getPackageName());
    }

    @Test
    public void predictiveBackCallbackIsReadyBeforeWebContentRequestsIt() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                try {
                    Field field = MainActivity.class.getDeclaredField("predictiveBackCallback");
                    field.setAccessible(true);
                    OnBackPressedCallback callback = (OnBackPressedCallback) field.get(activity);
                    assertTrue(
                        "Android back must never be consumed by a disabled SetFlow callback",
                        callback.isEnabled()
                    );
                } catch (ReflectiveOperationException error) {
                    throw new AssertionError(error);
                }
            });
        }
    }
}
