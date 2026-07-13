# Capacitor WebView
-keep class com.getcapacitor.** { *; }
-keep class com.capacitor.** { *; }

# Capacitor Plugins
-keep class com.capacitor.plugins.** { *; }

# Keep JavaScript interface for WebView
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve line numbers for crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Keep Firebase if present
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# Keep TensorFlow.js
-keep class org.tensorflow.** { *; }
-dontwarn org.tensorflow.**

# Keep Room/SQLite
-keep class * extends androidx.room.RoomDatabase { *; }
-keep @androidx.room.Entity class * { *; }
