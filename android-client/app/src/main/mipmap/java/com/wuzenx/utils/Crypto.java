package com.wuzenx.utils;

import android.util.Base64;
import com.wuzenx.Config;
import java.security.MessageDigest;
import java.security.SecureRandom;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

public class Crypto {
    private static final String ALGO = "AES/GCM/NoPadding";
    private static byte[] key = null;

    private static byte[] getKey() {
        if (key == null) {
            try {
                key = MessageDigest.getInstance("SHA-256")
                    .digest(Config.ENCRYPTION_KEY.getBytes("UTF-8"));
            } catch (Exception e) {
                key = new byte[32];
            }
        }
        return key;
    }

    public static String encrypt(String plaintext) {
        try {
            Cipher cipher = Cipher.getInstance(ALGO);
            byte[] iv = new byte[12];
            SecureRandom.getInstanceStrong().nextBytes(iv);
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(getKey(), "AES"),
                new GCMParameterSpec(128, iv));
            byte[] encrypted = cipher.doFinal(plaintext.getBytes("UTF-8"));
            byte[] combined = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(encrypted, 0, combined, iv.length, encrypted.length);
            return Base64.encodeToString(combined, Base64.NO_WRAP);
        } catch (Exception e) {
            return Base64.encodeToString(plaintext.getBytes(), Base64.NO_WRAP);
        }
    }

    public static String decrypt(String ciphertext) {
        try {
            byte[] decoded = Base64.decode(ciphertext, Base64.NO_WRAP);
            if (decoded.length < 28) return null; // 12 IV + 16 tag min
            
            byte[] iv = new byte[12];
            byte[] data = new byte[decoded.length - 12];
            System.arraycopy(decoded, 0, iv, 0, 12);
            System.arraycopy(decoded, 12, data, 0, decoded.length - 12);
            
            Cipher cipher = Cipher.getInstance(ALGO);
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(getKey(), "AES"),
                new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(data), "UTF-8");
        } catch (Exception e) {
            return null;
        }
    }
}
