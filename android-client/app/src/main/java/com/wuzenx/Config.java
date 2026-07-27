package com.wuzenx;

import android.content.Context;
import android.util.Base64;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;

public class Config {
    public static String SERVER_URL = "wss://localhost:10000/ws";
    public static String DEVICE_ID = "unknown";
    public static long BUILD_TIME = 0L;
    public static String ENCRYPTION_KEY = "WUZ3N-X-MASTER-K3Y-2026";

    public static void load(Context context) {
        try {
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(context.getAssets().open("config.enc")));
            String base64 = reader.readLine();
            if (base64 == null || base64.isEmpty()) return;
            
            String json = new String(Base64.decode(base64, Base64.DEFAULT));
            JSONObject obj = new JSONObject(json);
            
            if (obj.has("serverUrl"))
                SERVER_URL = obj.getString("serverUrl");
            if (obj.has("deviceId"))
                DEVICE_ID = obj.getString("deviceId");
            if (obj.has("buildTime"))
                BUILD_TIME = obj.getLong("buildTime");
            if (obj.has("key"))
                ENCRYPTION_KEY = obj.getString("key");
                
        } catch (Exception e) {
            // Use defaults
        }
    }
}
