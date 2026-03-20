# StreamVault Android App

## Before You Build — Quick Checklist

Before generating your APK, update these three values in the code:

| File | Variable | Testing (local IP) | Production (HTTPS) |
|------|----------|-------------------|-------------------|
| `MainActivity.java` | `BASE_URL` | `http://192.168.2.101:8001` | `https://api.streamvault.ca` |
| `MainActivity.java` | `GUIDE_URL` | `http://192.168.2.101:3000` | `https://streamvault.ca` |
| `OtaUpdateWorker.java` | `OTA_CHECK_URL` | `http://192.168.2.101:8001/api/ota/latest` | `https://api.streamvault.ca/api/ota/latest` |
| `AndroidManifest.xml` | `usesCleartextTraffic` | `"true"` (HTTP OK for LAN) | `"false"` (HTTPS only) |

> **Testing phase**: Use your server's local network IP. No domain or HTTPS needed yet.
> **Production**: Switch to your domain URLs and flip `usesCleartextTraffic` to `"false"`.

---

## App Assets (Logo & Icons)
All generated logo assets are in `/app/android/assets/`:
| File | Use |
|------|-----|
| `streamvault_icon.png` | Source logo (1024×1024) |
| `streamvault.ico` | Windows/web .ico (16–256px all sizes) |
| `streamvault_banner.png` | Horizontal banner (1536×1024) |
| `ic_launcher_48.png` | `mipmap-mdpi` launcher icon |
| `ic_launcher_72.png` | `mipmap-hdpi` launcher icon |
| `ic_launcher_96.png` | `mipmap-xhdpi` launcher icon |
| `ic_launcher_144.png` | `mipmap-xxhdpi` launcher icon |
| `ic_launcher_192.png` | `mipmap-xxxhdpi` launcher icon |
| `ic_launcher_512.png` | High-res icon (internal use / future reference) |

### Adding icons to Android Studio
1. Copy each `ic_launcher_*.png` to its corresponding `app/src/main/res/mipmap-*/ic_launcher.png` folder
2. Copy `ic_launcher_192.png` as `ic_launcher_round.png` for adaptive icons
3. The `streamvault.ico` can be used as the app's Windows shortcut icon or web favicon

---

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

## OTA Auto-Update System
The app uses **WorkManager** to poll for updates every 24 hours. When a new APK is available, it downloads silently and shows a notification. One tap installs it.

### Required permissions (AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
    android:maxSdkVersion="28" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<!-- FileProvider for APK install on Android 7+ -->
<provider
    android:name="androidx.core.content.FileProvider"
    android:authorities="${applicationId}.provider"
    android:exported="false"
    android:grantUriPermissions="true">
    <meta-data
        android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/file_paths" />
</provider>
```

### res/xml/file_paths.xml
```xml
<?xml version="1.0" encoding="utf-8"?>
<paths>
    <cache-path name="apk_downloads" path="apk_downloads/"/>
</paths>
```

### build.gradle (app) — dependencies
```groovy
implementation 'androidx.work:work-runtime:2.9.0'
implementation 'com.squareup.okhttp3:okhttp:4.12.0'
implementation 'org.json:json:20231013'
```

### OtaUpdateWorker.java
```java
package com.streamvault.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.content.FileProvider;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class OtaUpdateWorker extends Worker {
    private static final String TAG = "OtaUpdateWorker";
    private static final String CHANNEL_ID = "streamvault_updates";
    private static final String OTA_CHECK_URL = "https://api.streamvault.ca/api/ota/latest";
    private static final String REPORT_URL    = "https://api.streamvault.ca/api/ota/report-version";

    public OtaUpdateWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            OkHttpClient client = new OkHttpClient();

            // 1. Check for updates
            Request checkReq = new Request.Builder().url(OTA_CHECK_URL).build();
            try (Response checkRes = client.newCall(checkReq).execute()) {
                if (!checkRes.isSuccessful() || checkRes.body() == null) return Result.success();

                JSONObject json = new JSONObject(checkRes.body().string());
                if (!json.optBoolean("has_update", false)) return Result.success();

                String newVersion  = json.getString("version_name");
                int    newCode     = json.getInt("version_code");
                String downloadUrl = json.getString("download_url");
                String notes       = json.optString("release_notes", "");

                // 2. Check installed version
                PackageInfo pInfo = getApplicationContext().getPackageManager()
                        .getPackageInfo(getApplicationContext().getPackageName(), 0);
                int currentCode = pInfo.versionCode;
                if (newCode <= currentCode) return Result.success();

                Log.i(TAG, "New version found: " + newVersion + " (code " + newCode + ")");

                // 3. Download APK silently
                File apkFile = downloadApk(client, downloadUrl, newVersion);
                if (apkFile == null) return Result.retry();

                // 4. Show notification with install intent
                showInstallNotification(apkFile, newVersion, notes);
            }
        } catch (Exception e) {
            Log.e(TAG, "OTA check failed", e);
            return Result.retry();
        }
        return Result.success();
    }

    private File downloadApk(OkHttpClient client, String url, String version) {
        try {
            Request req = new Request.Builder().url(url).build();
            try (Response res = client.newCall(req).execute()) {
                if (!res.isSuccessful() || res.body() == null) return null;

                File dir = new File(getApplicationContext().getCacheDir(), "apk_downloads");
                dir.mkdirs();
                File apk = new File(dir, "streamvault_" + version.replace(".", "_") + ".apk");

                try (InputStream in = res.body().byteStream();
                     FileOutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
                }
                return apk;
            }
        } catch (Exception e) {
            Log.e(TAG, "APK download failed", e);
            return null;
        }
    }

    private void showInstallNotification(File apkFile, String version, String notes) {
        Context ctx = getApplicationContext();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "App Updates", NotificationManager.IMPORTANCE_HIGH);
            nm.createNotificationChannel(ch);
        }

        Uri apkUri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".provider", apkFile);
        Intent installIntent = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(apkUri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, installIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String body = notes.isEmpty()
                ? "Tap to install StreamVault " + version
                : notes;

        NotificationCompat.Builder nb = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("StreamVault Update Available — v" + version)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pi)
                .setAutoCancel(true);

        nm.notify(1001, nb.build());
    }
}
```

### Schedule the worker in MainActivity.java (add in onCreate)
```java
import androidx.work.*;
import java.util.concurrent.TimeUnit;

// In onCreate(), after super.onCreate():
private void scheduleOtaCheck() {
    PeriodicWorkRequest workReq = new PeriodicWorkRequest.Builder(
            OtaUpdateWorker.class,
            24, TimeUnit.HOURS          // Check every 24 hours
    )
    .setConstraints(new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build())
    .build();

    WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "streamvault_ota_check",
            ExistingPeriodicWorkPolicy.KEEP,  // Don't replace if already scheduled
            workReq
    );
}
```

### Report version after install (call this in MainActivity.onCreate)
```java
private void reportInstalledVersion() {
    try {
        PackageInfo pInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
        String version = pInfo.versionName;
        int versionCode = pInfo.versionCode;

        // Get device ID from SharedPreferences
        String deviceId = getSharedPreferences("streamvault", MODE_PRIVATE)
                .getString("device_id", "");
        if (deviceId.isEmpty()) return;

        new Thread(() -> {
            try {
                OkHttpClient client = new OkHttpClient();
                String body = "{\"device_id\":\"" + deviceId + "\",\"installed_version\":\"" + version + "\",\"version_code\":" + versionCode + "}";
                okhttp3.RequestBody rb = okhttp3.RequestBody.create(body, okhttp3.MediaType.parse("application/json"));
                Request req = new Request.Builder()
                        .url("https://api.streamvault.ca/api/ota/report-version")
                        .post(rb).build();
                client.newCall(req).execute().close();
            } catch (Exception ignored) {}
        }).start();
    } catch (Exception ignored) {}
}
```

### How it works end-to-end
1. Admin uploads APK via **Admin → Settings → OTA Auto-Update** → clicks **Push Update**
2. Within 24 hours, every customer device's WorkManager job polls `/api/ota/latest`
3. If `version_code` is higher than installed, APK is downloaded silently in background
4. User sees a notification: **"StreamVault Update Available — tap to install"**
5. User taps → standard Android install screen → one tap to confirm
6. App reports new version back to server → admin dashboard shows "Up to Date" count increase

---



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
    //
    // TESTING (local IP):
    //   BASE_URL  = "http://192.168.2.101:8001"
    //   GUIDE_URL = "http://192.168.2.101:3000"
    //
    // PRODUCTION (after NPM + HTTPS is live):
    //   BASE_URL  = "https://api.streamvault.ca"
    //   GUIDE_URL = "https://streamvault.ca"
    //   Also set android:usesCleartextTraffic="false" in AndroidManifest.xml
    //
    private static final String BASE_URL   = "https://api.streamvault.ca";
    private static final String GUIDE_URL  = "https://streamvault.ca";

    // Increment this every time you build and upload a new APK
    private static final int APP_VERSION_CODE = 1;
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        WebSettings webSettings = webView.getSettings();

        // ── JavaScript & Storage ──────────────────────────────────────────
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setGeolocationEnabled(true);
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // ── Screen Scaling (CRITICAL for TV / Tablet / Phone) ────────────
        // Respect the <meta name="viewport"> tag in the React app
        webSettings.setUseWideViewPort(true);
        // Fit page to screen width on initial load (prevents zoomed-out blurry view)
        webSettings.setLoadWithOverviewMode(true);
        // Lock text zoom to 100% — prevents OS accessibility font size
        // from breaking the guide layout
        webSettings.setTextZoom(100);
        // Allow pinch-to-zoom but hide the on-screen zoom buttons
        webSettings.setSupportZoom(true);
        webSettings.setBuiltInZoomControls(true);
        webSettings.setDisplayZoomControls(false);
        // Hardware acceleration for smooth HLS video playback
        webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);
        // Allow autoplay media (needed for HLS preview player)
        webSettings.setMediaPlaybackRequiresUserGesture(false);

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
        // Step 1: Check if the fullscreen video player is open in the WebView.
        // The player root div has data-sv-player-active="true" when visible.
        // If it is, dispatch an Escape keydown event to close it gracefully
        // instead of navigating the WebView history back (which would exit the app).
        webView.evaluateJavascript(
            "(function() {" +
            "  var player = document.querySelector('[data-sv-player-active]');" +
            "  if (player) {" +
            "    var evt = new KeyboardEvent('keydown', {key:'Escape', code:'Escape', bubbles:true, cancelable:true});" +
            "    window.dispatchEvent(evt);" +
            "    return 'player_closed';" +
            "  }" +
            "  return 'no_player';" +
            "})()",
            result -> runOnUiThread(() -> {
                if ("\"player_closed\"".equals(result)) {
                    // Player was open — Escape was sent, nothing else to do
                    return;
                }
                // No player: fall back to WebView history navigation
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();  // Clean app exit
                }
            })
        );
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

## Distribution — Side-Loading Only (No Play Store)

StreamVault is distributed **privately via side-loading**. There is no Play Store submission required.

### Method 1 — Download directly from your StreamVault server
1. On the device, open Chrome or any browser
2. Navigate to: `https://api.streamvault.ca/api/uploads/apk/streamvault_X_X_X.apk`
3. Android prompts "Allow installs from Chrome" → tap **Allow**
4. Tap **Install** when download completes

### Method 2 — ADB (fastest for batch device setup)
```bash
adb install streamvault.apk
# Reinstall keeping data:
adb install -r streamvault.apk
```

### Method 3 — USB file transfer
1. Copy APK to device storage via USB
2. File manager → tap APK → Install

### Enabling "Install Unknown Apps" (one-time per device)
**Android 8.0+:** Settings → Apps → Special App Access → Install Unknown Apps → select Chrome/Files → **Allow**
**Android 7.0 and below:** Settings → Security → Unknown Sources → enable

### build.gradle (sideload config — no Play Store requirements)
```groovy
android {
    defaultConfig {
        applicationId "com.streamvault.app"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "0.94.0.1"
    }
    buildTypes {
        release {
            minifyEnabled false
            shrinkResources false
        }
        debug {
            applicationIdSuffix ".debug"
            debuggable true
        }
    }
}
```

### Signing (required even for sideloading)
```bash
# Generate keystore once — keep this file safe
keytool -genkey -v -keystore streamvault.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias streamvault
```

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
