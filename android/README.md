# Android App Wrapper

This directory contains configuration and build files for wrapping the TV Guide in an Android app.

## Overview
The Android app is a WebView wrapper around the TV Guide (guide-app).

## Architecture
```
┌─────────────────┐
│  Android App    │
│   (WebView)     │
│                 │
│  ┌───────────┐  │
│  │TV Guide   │  │
│  │Frontend   │  │
│  └───────────┘  │
└─────────────────┘
         ↓
    ┌─────────┐
    │ Backend │
    │   API   │
    └─────────┘
```

## Features for Android App
- Cloud Video Recorder (CVR) - 265 hours
- Personal Video Recorder (PVR)
- Digital Video Recorder (DVR)
- Device management
- Offline guide caching
- Push notifications

## Channel Behaviour Notes

### Coming Soon Channels (Live TV 1, Live TV 2)
These channels are placeholder entries for future live TV integration. They are flagged with `coming_soon: true` in the database.

**Behaviour in the guide:**
- Channel rows appear greyed out (50% opacity) in the EPG grid
- Clicking/selecting a coming-soon channel does **not** switch the preview player
- Instead, a full-screen popup modal appears with the message:
  > *"Live TV channels coming soon. Stay tuned for updates on when live TV will be added."*
- A **"Got It"** button dismisses the popup
- The program schedule area shows *"Programming not yet available"* instead of a time grid

**How to activate them when live TV is ready:**
1. In Admin → Channels, edit the channel
2. Add the HLS stream URL (e.g. `http://your-server/stream/livetv1.m3u8`)
3. Set `coming_soon` to `false` (uncheck in the channel editor)
4. The channel will immediately become fully interactive in the guide

## Requirements
- Android Studio Arctic Fox or higher
- Android SDK 24+ (Android 7.0+)
- Java JDK 11+
- Gradle 7.0+

## Setup Instructions

### 1. Install Android Studio
Download from: https://developer.android.com/studio

### 2. Configure WebView App

Create basic structure:
```
/app/android/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── java/
│   │   │   │   └── com/tvservice/guide/
│   │   │   │       └── MainActivity.java
│   │   │   └── res/
│   │   │       ├── layout/
│   │   │       │   └── activity_main.xml
│   │   │       ├── values/
│   │   │       │   └── strings.xml
│   │   │       └── drawable/
│   ├── build.gradle
│   └── proguard-rules.pro
├── gradle/
└── build.gradle
```

### 3. WebView Configuration

**MainActivity.java:**
```java
package com.streamvault.tv;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebViewClient;

import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private WebView webView;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler  = new Handler(Looper.getMainLooper());

    // ── Replace with your actual server IP / domain ──────────────────────────
    private static final String BASE_URL   = "http://70.28.9.208:8001";   // or https://api.yourdomain.com
    private static final String GUIDE_URL  = "http://70.28.9.208:3001";   // or https://guide.yourdomain.com

    // Increment this every time you build and upload a new APK
    private static final int APP_VERSION_CODE = 1;
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
        webSettings.setGeolocationEnabled(true);

        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl(GUIDE_URL);

        // Check for update in background (no deprecated AsyncTask)
        checkForUpdate();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executor.shutdownNow();   // clean up thread pool — prevents memory leaks
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    // ── Background update check using Executors (replaces deprecated AsyncTask) ──
    private void checkForUpdate() {
        executor.execute(() -> {
            JSONObject result = fetchLatestRelease();
            mainHandler.post(() -> handleUpdateResult(result));
        });
    }

    private JSONObject fetchLatestRelease() {
        try {
            HttpURLConnection conn = (HttpURLConnection) new URL(BASE_URL + "/api/apk/latest").openConnection();
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) sb.append(line);
            br.close();
            return new JSONObject(sb.toString());
        } catch (Exception e) {
            return null;   // network unavailable — skip silently
        }
    }

    private void handleUpdateResult(JSONObject result) {
        if (result == null || isFinishing()) return;
        try {
            if (!result.optBoolean("has_release", false)) return;

            int serverVersionCode = result.optInt("version_code", 0);
            if (serverVersionCode <= APP_VERSION_CODE) return;   // already up to date

            String serverVersion = result.optString("version", "");
            String downloadUrl   = result.optString("download_url", "");
            String releaseNotes  = result.optString("release_notes", "");
            boolean required     = result.optBoolean("required", false);

            String message = "Version " + serverVersion + " is available.";
            if (!releaseNotes.isEmpty()) message += "\n\n" + releaseNotes;
            if (required) message += "\n\nThis update is required to continue.";

            new AlertDialog.Builder(this)
                .setTitle("Update Available")
                .setMessage(message)
                .setPositiveButton("Download Now", (d, w) ->
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl))))
                .setNegativeButton(required ? null : "Later",
                    required ? null : (d, w) -> d.dismiss())
                .setCancelable(!required)
                .show();
        } catch (Exception e) {
            // ignore — update check is best-effort
        }
    }
}
```

**AndroidManifest.xml:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.streamvault.tv">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />

    <!--
      Set usesCleartextTraffic="true" when using HTTP (static IP / local testing).
      Change to "false" once you have HTTPS via Nginx Proxy Manager + Let's Encrypt.
    -->
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:usesCleartextTraffic="true"
        android:theme="@style/Theme.AppCompat.Light.NoActionBar">
        <activity android:name=".MainActivity">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

### 4. Build Configuration

**app/build.gradle:**
```gradle
plugins {
    id 'com.android.application'
}

android {
    compileSdk 33
    
    defaultConfig {
        applicationId "com.streamvault.tv"
        minSdk 24
        targetSdk 33
        versionCode 1
        versionName "1.0.0"
    }
    
    buildTypes {
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_11
        targetCompatibility JavaVersion.VERSION_11
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.9.0'
}
```

### 5. Building the APK

```bash
cd /app/android
./gradlew assembleRelease

# APK will be at:
# app/build/outputs/apk/release/app-release.apk
```

### 6. Signing the APK

```bash
# Generate keystore
keytool -genkey -v -keystore tv-service.keystore -alias tv-service -keyalg RSA -keysize 2048 -validity 10000

# Sign APK
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore tv-service.keystore app/build/outputs/apk/release/app-release-unsigned.apk tv-service

# Verify
jarsigner -verify -verbose -certs app/build/outputs/apk/release/app-release-unsigned.apk
```

## Features to Implement

### Phase 1: Basic WebView (Current)
- [x] Load guide from HTTPS URL
- [x] JavaScript enabled
- [x] Local storage support
- [x] Back button navigation

### Phase 2: Enhanced Features
- [ ] Offline guide caching
- [ ] Push notifications for programs
- [ ] Download manager for recordings
- [ ] Picture-in-Picture mode
- [ ] Custom controls overlay

### Phase 3: DVR/PVR/CVR
- [ ] Cloud Video Recorder integration
- [ ] Local recording management
- [ ] Playback controls
- [ ] Storage management (265 hours)

## Testing

### On Emulator
```bash
# Start emulator
emulator -avd Pixel_5_API_33

# Install APK
adb install app/build/outputs/apk/release/app-release.apk

# View logs
adb logcat | grep WebView
```

### On Physical Device
1. Enable Developer Options on Android device
2. Enable USB Debugging
3. Connect device via USB
4. Run: `adb install app-release.apk`

## Distribution

### Google Play Store
1. Create Play Console account
2. Upload signed APK
3. Complete store listing
4. Submit for review

### Direct Distribution
1. Host APK on your website
2. Users enable "Install from Unknown Sources"
3. Download and install APK

## Security Considerations

### HTTPS Only
- App configured with `usesCleartextTraffic="false"`
- Only HTTPS connections allowed
- SSL certificate pinning recommended

### Permissions
- Internet: Required for guide access
- Location: For geo-validation (Canada check)
- Storage: For offline caching (optional)

## Future Enhancements

See `/app/FUTURE_DEVELOPMENT.md`:
- Native video player
- Chromecast support
- Android TV launcher integration
- Voice search
- Recommendation engine
- Parental controls
- Multi-profile support

## Support

For build issues or questions, refer to:
- Android Developer Guide: https://developer.android.com/guide
- WebView Documentation: https://developer.android.com/reference/android/webkit/WebView

## Notes

- **Current Status**: Planning phase - structure defined
- **Next Step**: Implement basic WebView wrapper
- **Deployment**: After guide-app separation complete
- **Timeline**: Future development phase
