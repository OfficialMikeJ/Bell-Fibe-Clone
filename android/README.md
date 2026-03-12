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
package com.tvservice.guide;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView webView;
    private static final String GUIDE_URL = "https://guide.yourdomain.com";
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        webView = findViewById(R.id.webview);
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        
        // Enable caching
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
        webSettings.setAppCacheEnabled(true);
        
        // Location for geo-validation
        webSettings.setGeolocationEnabled(true);
        
        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl(GUIDE_URL);
    }
    
    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
```

**AndroidManifest.xml:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.tvservice.guide">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:usesCleartextTraffic="false"
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
        applicationId "com.tvservice.guide"
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
