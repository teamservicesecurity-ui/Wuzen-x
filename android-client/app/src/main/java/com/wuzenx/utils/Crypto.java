package com.wuzenx.utils;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import android.util.Base64;

public class Crypto {
    private static final String ALGORITHM = "AES/ECB/PKCS5Padding";
    private static final String KEY = "WuzenX2026Secure!";

    public static String encrypt(String plaintext) {
        try {
            SecretKeySpec key = new SecretKeySpec(
                KEY.getBytes("UTF-8"), "AES");
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, key);
            byte[] encrypted = cipher.doFinal(plaintext.getBytes("UTF-8"));
            return Base64.encodeToString(encrypted, Base64.NO_WRAP);
        } catch (Exception e) {
            return null;
        }
    }

    public static String decrypt(String encryptedBase64) {
        try {
            SecretKeySpec key = new SecretKeySpec(
                KEY.getBytes("UTF-8"), "AES");
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, key);
            byte[] decoded = Base64.decode(encryptedBase64, Base64.NO_WRAP);
            byte[] decrypted = cipher.doFinal(decoded);
            return new String(decrypted, "UTF-8");
        } catch (Exception e) {
            return null;
        }
    }
}
