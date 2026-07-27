package com.wuzenx.utils;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;

public class Persistence {

    public static void scheduleBoot(Context context) {
        Intent intent = new Intent(context, BootReceiver.class);
        intent.setAction(Intent.ACTION_BOOT_COMPLETED);

        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        alarmManager.setInexactRepeating(
            AlarmManager.ELAPSED_REALTIME_WAKEUP,
            SystemClock.elapsedRealtime() + 10000,
            60000,
            pendingIntent
        );
    }

    public static void keepAlive(Context context) {
        scheduleBoot(context);

        Intent intent = new Intent(context, BootReceiver.class);
        intent.setAction("KEEP_ALIVE");

        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            1,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        alarmManager.setRepeating(
            AlarmManager.RTC_WAKEUP,
            System.currentTimeMillis() + 300000,
            300000,
            pendingIntent
        );
    }
}
