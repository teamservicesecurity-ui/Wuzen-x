-keep class io.socket.client.** { *; }
-keep class io.socket.engineio.client.** { *; }
-keepclassmembers class io.socket.client.Socket {
    *** on(...);
    *** off(...);
    *** emit(...);
    *** connect(...);
    *** disconnect(...);
}
-dontwarn io.socket.**

-keep class androidx.camera.core.ImageCapture { *; }
-keep class androidx.camera.core.CameraSelector { *; }
-keep class androidx.camera.core.Preview { *; }
-keep class androidx.camera.lifecycle.ProcessCameraProvider { *; }
-dontwarn androidx.camera.**

-keep class com.google.android.gms.location.** { *; }
-keep class com.google.android.gms.internal.** { *; }
-dontwarn com.google.android.gms.internal.**

-keepclassmembers class com.fason.app.** {
    *** get(...);
    *** set(...);
}
-keep class com.fason.app.core.network.SocketCommandRouter { *; }
-keep class com.fason.app.features.** { *; }

-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.OkHttpClient { *; }
-keep class okhttp3.Request { *; }
-keep class okhttp3.Response { *; }
-keep interface okhttp3.** { *; }

-keep class androidx.work.** { *; }

-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-verbose

-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}
