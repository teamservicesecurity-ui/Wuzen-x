package com.wuzenx.utils;

import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;

public class KeyguardWatcher {
    private AccessibilityService service;
    private String capturedPin = "";

    public KeyguardWatcher(AccessibilityService service) {
        this.service = service;
    }

    public void onAccessibilityEvent(AccessibilityEvent event) {}

    public String getCapturedPin() { return capturedPin; }
}
