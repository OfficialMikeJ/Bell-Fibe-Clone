# StreamVault — Android Admin App

A native Android tablet app for diagnosing on-site customer issues and
monitoring your StreamVault service from anywhere on the local network
or remotely via HTTPS.

Authenticates with the same admin credentials as the web Admin Dashboard
and calls the existing backend API — no new backend work needed.

---

## What You Can Do

| Screen | Actions |
|--------|---------|
| **Dashboard** | Live server CPU/RAM/Disk mini-gauges, active device count, open ticket count, recent activity |
| **Devices** | Search all registered devices, view status (active/pending/suspended), activate or suspend |
| **Customer Detail** | Full on-site diagnostic: device info, recording list, support tickets, last seen time |
| **Support Tickets** | Browse open/resolved tickets, read messages, post admin replies |
| **System Health** | Live CPU/RAM/Disk gauges refreshing every 5 s (mirrors web admin) |
| **Settings** | Change server URL without rebuilding, logout |

---

## Project Setup in Android Studio

### 1. Create New Project

- **Template**: Empty Activity
- **Package**: `com.streamvault.admin`
- **Min SDK**: API 26 (Android 8.0) — covers all modern tablets
- **Language**: Java
- **Build config**: Groovy (`.gradle`)

### 2. `app/build.gradle`

```groovy
plugins {
    id 'com.android.application'
}

android {
    compileSdk 34

    defaultConfig {
        applicationId "com.streamvault.admin"
        minSdk 26
        targetSdk 34
        versionCode 1
        versionName "1.0.0"
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

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_11
        targetCompatibility JavaVersion.VERSION_11
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.9.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    implementation 'androidx.fragment:fragment:1.6.2'
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
    implementation 'org.json:json:20231013'
    implementation 'androidx.swiperefreshlayout:swiperefreshlayout:1.1.0'
}
```

### 3. `AndroidManifest.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.streamvault.admin">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <!--
      usesCleartextTraffic="true"  → Testing on local IP (HTTP)
      usesCleartextTraffic="false" → Production with HTTPS
    -->
    <application
        android:allowBackup="false"
        android:icon="@mipmap/ic_launcher"
        android:label="StreamVault Admin"
        android:theme="@style/Theme.MaterialComponents.DayNight.NoActionBar"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".LoginActivity"
            android:exported="true"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <activity android:name=".MainActivity" android:exported="false" />
        <activity android:name=".DeviceDetailActivity" android:exported="false" />

    </application>
</manifest>
```

---

## Source Files

### `ApiClient.java`
Central HTTP helper. Handles JWT auth, all API calls, and JSON parsing.

```java
package com.streamvault.admin;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.IOException;
import okhttp3.*;

public class ApiClient {

    private static final String PREFS   = "sv_admin";
    private static final String KEY_URL = "server_url";
    private static final String KEY_TOK = "auth_token";

    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    private final OkHttpClient http = new OkHttpClient.Builder()
            .connectTimeout(8, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
            .build();

    private final SharedPreferences prefs;

    public ApiClient(Context ctx) {
        prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // ── Config ────────────────────────────────────────────────────────────────

    public String getServerUrl() {
        return prefs.getString(KEY_URL, "http://YOUR_SERVER_IP:8001");
    }

    public void setServerUrl(String url) {
        prefs.edit().putString(KEY_URL, url.replaceAll("/$", "")).apply();
    }

    public void setToken(String token) {
        prefs.edit().putString(KEY_TOK, token).apply();
    }

    public String getToken() {
        return prefs.getString(KEY_TOK, null);
    }

    public void clearToken() {
        prefs.edit().remove(KEY_TOK).apply();
    }

    public boolean isLoggedIn() {
        return getToken() != null;
    }

    // ── HTTP helpers ──────────────────────────────────────────────────────────

    private Request.Builder authed() {
        return new Request.Builder()
                .header("Authorization", "Bearer " + getToken())
                .header("Content-Type", "application/json");
    }

    public JSONObject postJson(String path, JSONObject body) throws Exception {
        RequestBody rb = RequestBody.create(body.toString(), JSON);
        Request req = new Request.Builder()
                .url(getServerUrl() + path)
                .post(rb)
                .build();
        try (Response res = http.newCall(req).execute()) {
            String bodyStr = res.body() != null ? res.body().string() : "{}";
            if (!res.isSuccessful()) throw new IOException("HTTP " + res.code() + ": " + bodyStr);
            return new JSONObject(bodyStr);
        }
    }

    public JSONArray getArray(String path) throws Exception {
        Request req = authed().url(getServerUrl() + path).get().build();
        try (Response res = http.newCall(req).execute()) {
            String bodyStr = res.body() != null ? res.body().string() : "[]";
            if (!res.isSuccessful()) throw new IOException("HTTP " + res.code());
            return new JSONArray(bodyStr);
        }
    }

    public JSONObject getObject(String path) throws Exception {
        Request req = authed().url(getServerUrl() + path).get().build();
        try (Response res = http.newCall(req).execute()) {
            String bodyStr = res.body() != null ? res.body().string() : "{}";
            if (!res.isSuccessful()) throw new IOException("HTTP " + res.code());
            return new JSONObject(bodyStr);
        }
    }

    public JSONObject patchJson(String path, JSONObject body) throws Exception {
        RequestBody rb = RequestBody.create(body.toString(), JSON);
        Request req = authed().url(getServerUrl() + path).patch(rb).build();
        try (Response res = http.newCall(req).execute()) {
            String bodyStr = res.body() != null ? res.body().string() : "{}";
            if (!res.isSuccessful()) throw new IOException("HTTP " + res.code());
            return new JSONObject(bodyStr);
        }
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    /** Returns the JWT token on success, throws on failure. */
    public String login(String username, String password) throws Exception {
        JSONObject body = new JSONObject();
        body.put("username", username);
        body.put("password", password);
        JSONObject res = postJson("/api/auth/login", body);
        String token = res.getString("access_token");
        setToken(token);
        return token;
    }

    // ── Devices ───────────────────────────────────────────────────────────────

    public JSONArray getDevices() throws Exception {
        return getArray("/api/devices");
    }

    public JSONObject updateDeviceStatus(String deviceId, String status) throws Exception {
        JSONObject body = new JSONObject();
        body.put("status", status);
        return patchJson("/api/devices/" + deviceId, body);
    }

    // ── Tickets ───────────────────────────────────────────────────────────────

    public JSONArray getTickets() throws Exception {
        return getArray("/api/tickets");
    }

    public JSONObject replyToTicket(String ticketId, String message) throws Exception {
        JSONObject body = new JSONObject();
        body.put("message", message);
        body.put("sender", "admin");
        return postJson("/api/tickets/" + ticketId + "/messages", body);
    }

    public JSONObject closeTicket(String ticketId) throws Exception {
        JSONObject body = new JSONObject();
        body.put("status", "resolved");
        return patchJson("/api/tickets/" + ticketId, body);
    }

    // ── Health ────────────────────────────────────────────────────────────────

    public JSONObject getHealthMetrics() throws Exception {
        return getObject("/api/health/metrics");
    }

    public JSONObject getStorageStats() throws Exception {
        return getObject("/api/health/storage");
    }

    // ── Recordings ────────────────────────────────────────────────────────────

    public JSONArray getUserRecordings(String userId) throws Exception {
        return getArray("/api/recordings/user/" + userId);
    }
}
```

---

### `LoginActivity.java`

```java
package com.streamvault.admin;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class LoginActivity extends AppCompatActivity {

    private ApiClient api;
    private EditText etServerUrl, etUsername, etPassword;
    private Button btnLogin;
    private ProgressBar progress;
    private TextView tvError;
    private final ExecutorService exec = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);

        api = new ApiClient(this);

        // Skip login if already authenticated
        if (api.isLoggedIn()) {
            goToMain();
            return;
        }

        etServerUrl = findViewById(R.id.et_server_url);
        etUsername  = findViewById(R.id.et_username);
        etPassword  = findViewById(R.id.et_password);
        btnLogin    = findViewById(R.id.btn_login);
        progress    = findViewById(R.id.progress);
        tvError     = findViewById(R.id.tv_error);

        etServerUrl.setText(api.getServerUrl());

        btnLogin.setOnClickListener(v -> attemptLogin());
    }

    private void attemptLogin() {
        String url  = etServerUrl.getText().toString().trim();
        String user = etUsername.getText().toString().trim();
        String pass = etPassword.getText().toString();

        if (url.isEmpty() || user.isEmpty() || pass.isEmpty()) {
            tvError.setText("All fields are required");
            tvError.setVisibility(View.VISIBLE);
            return;
        }

        api.setServerUrl(url);
        setLoading(true);
        tvError.setVisibility(View.GONE);

        exec.execute(() -> {
            try {
                api.login(user, pass);
                main.post(() -> {
                    setLoading(false);
                    goToMain();
                });
            } catch (Exception e) {
                main.post(() -> {
                    setLoading(false);
                    tvError.setText("Login failed: " + e.getMessage());
                    tvError.setVisibility(View.VISIBLE);
                });
            }
        });
    }

    private void setLoading(boolean loading) {
        btnLogin.setEnabled(!loading);
        progress.setVisibility(loading ? View.VISIBLE : View.GONE);
    }

    private void goToMain() {
        startActivity(new Intent(this, MainActivity.class));
        finish();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        exec.shutdownNow();
    }
}
```

**`res/layout/activity_login.xml`** — description:
- Dark background (`#121212`)
- StreamVault logo / app name centered at top
- `EditText`: Server URL (pre-filled from SharedPreferences)
- `EditText`: Admin username
- `EditText`: Admin password (inputType = textPassword)
- `Button`: "Login" (full width, blue `#0056A8`)
- `ProgressBar` (horizontal, hidden until login pressed)
- `TextView`: error message (red, hidden by default)

---

### `MainActivity.java`
Bottom navigation container with 4 fragments.

```java
package com.streamvault.admin;

import android.content.Intent;
import android.os.Bundle;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;
import com.google.android.material.bottomnavigation.BottomNavigationView;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        BottomNavigationView nav = findViewById(R.id.bottom_nav);
        nav.setOnItemSelectedListener(item -> {
            Fragment f = null;
            int id = item.getItemId();
            if      (id == R.id.nav_dashboard) f = new DashboardFragment();
            else if (id == R.id.nav_devices)   f = new DevicesFragment();
            else if (id == R.id.nav_tickets)   f = new TicketsFragment();
            else if (id == R.id.nav_health)    f = new HealthFragment();
            else if (id == R.id.nav_settings)  f = new SettingsFragment();
            if (f != null) {
                getSupportFragmentManager().beginTransaction()
                    .replace(R.id.fragment_container, f).commit();
            }
            return true;
        });

        // Default screen
        if (savedInstanceState == null) {
            nav.setSelectedItemId(R.id.nav_dashboard);
        }
    }
}
```

**`res/menu/bottom_nav_menu.xml`**:
```xml
<?xml version="1.0" encoding="utf-8"?>
<menu xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:id="@+id/nav_dashboard" android:title="Dashboard"
        android:icon="@drawable/ic_dashboard" />
    <item android:id="@+id/nav_devices"   android:title="Devices"
        android:icon="@drawable/ic_devices" />
    <item android:id="@+id/nav_tickets"   android:title="Tickets"
        android:icon="@drawable/ic_tickets" />
    <item android:id="@+id/nav_health"    android:title="Health"
        android:icon="@drawable/ic_health" />
    <item android:id="@+id/nav_settings"  android:title="Settings"
        android:icon="@drawable/ic_settings" />
</menu>
```
> Use Material Icons (already included via `material:1.9.0`): `ic_dashboard_24`, `ic_devices_other_24`, `ic_support_agent_24`, `ic_monitor_heart_24`, `ic_settings_24`

---

### `DashboardFragment.java`
Shows quick stats and recent activity on load.

```java
package com.streamvault.admin;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class DashboardFragment extends Fragment {

    private ApiClient api;
    private TextView tvDeviceCount, tvTicketCount, tvCpu, tvRam, tvStatus;
    private final ExecutorService exec = Executors.newCachedThreadPool();
    private final Handler main = new Handler(Looper.getMainLooper());

    @Nullable @Override
    public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container, Bundle state) {
        View v = inflater.inflate(R.layout.fragment_dashboard, container, false);
        api = new ApiClient(requireContext());

        tvDeviceCount = v.findViewById(R.id.tv_device_count);
        tvTicketCount = v.findViewById(R.id.tv_ticket_count);
        tvCpu         = v.findViewById(R.id.tv_cpu);
        tvRam         = v.findViewById(R.id.tv_ram);
        tvStatus      = v.findViewById(R.id.tv_status);

        loadData();
        return v;
    }

    private void loadData() {
        // Load devices + tickets + health in parallel
        exec.execute(() -> {
            try {
                JSONArray devices = api.getDevices();
                int active = 0;
                for (int i = 0; i < devices.length(); i++) {
                    if ("active".equals(devices.getJSONObject(i).optString("status"))) active++;
                }
                final int activeCount = active;
                final int totalDevices = devices.length();
                main.post(() -> tvDeviceCount.setText(activeCount + " active / " + totalDevices + " total"));
            } catch (Exception e) {
                main.post(() -> tvDeviceCount.setText("--"));
            }
        });

        exec.execute(() -> {
            try {
                JSONArray tickets = api.getTickets();
                int open = 0;
                for (int i = 0; i < tickets.length(); i++) {
                    String s = tickets.getJSONObject(i).optString("status");
                    if ("open".equals(s) || "in_progress".equals(s)) open++;
                }
                final int openCount = open;
                main.post(() -> tvTicketCount.setText(openCount + " open tickets"));
            } catch (Exception e) {
                main.post(() -> tvTicketCount.setText("--"));
            }
        });

        exec.execute(() -> {
            try {
                JSONObject h = api.getHealthMetrics();
                double cpu = h.optDouble("cpu_percent", 0);
                double ram = h.optDouble("ram_percent", 0);
                main.post(() -> {
                    tvCpu.setText(String.format("CPU: %.0f%%", cpu));
                    tvRam.setText(String.format("RAM: %.0f%%", ram));
                    tvStatus.setText("Server online");
                });
            } catch (Exception e) {
                main.post(() -> tvStatus.setText("Server unreachable"));
            }
        });
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        exec.shutdownNow();
    }
}
```

---

### `DevicesFragment.java`
Searchable list of all devices. Tap a device to open `DeviceDetailActivity`.

```java
package com.streamvault.admin;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.*;
import android.widget.*;
import androidx.annotation.*;
import androidx.fragment.app.Fragment;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.*;
import java.util.concurrent.*;

public class DevicesFragment extends Fragment {

    private ApiClient api;
    private ListView listView;
    private EditText etSearch;
    private SwipeRefreshLayout swipe;
    private final List<JSONObject> allDevices  = new ArrayList<>();
    private final List<JSONObject> shown       = new ArrayList<>();
    private ArrayAdapter<String> adapter;
    private final ExecutorService exec = Executors.newSingleThreadExecutor();
    private final Handler main         = new Handler(Looper.getMainLooper());

    @Nullable @Override
    public View onCreateView(@NonNull LayoutInflater inf, ViewGroup container, Bundle state) {
        View v = inf.inflate(R.layout.fragment_devices, container, false);
        api      = new ApiClient(requireContext());
        listView = v.findViewById(R.id.list_devices);
        etSearch = v.findViewById(R.id.et_search);
        swipe    = v.findViewById(R.id.swipe_refresh);

        adapter = new ArrayAdapter<>(requireContext(), android.R.layout.simple_list_item_2,
                android.R.id.text1, new ArrayList<>());
        listView.setAdapter(adapter);

        listView.setOnItemClickListener((parent, view, pos, id) -> {
            JSONObject device = shown.get(pos);
            Intent intent = new Intent(requireContext(), DeviceDetailActivity.class);
            intent.putExtra("device_json", device.toString());
            startActivity(intent);
        });

        etSearch.addTextChangedListener(new TextWatcher() {
            public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            public void onTextChanged(CharSequence s, int a, int b, int c) { filter(s.toString()); }
            public void afterTextChanged(Editable s) {}
        });

        swipe.setOnRefreshListener(this::loadDevices);
        loadDevices();
        return v;
    }

    private void loadDevices() {
        swipe.setRefreshing(true);
        exec.execute(() -> {
            try {
                JSONArray arr = api.getDevices();
                allDevices.clear();
                for (int i = 0; i < arr.length(); i++) allDevices.add(arr.getJSONObject(i));
                main.post(() -> {
                    filter(etSearch.getText().toString());
                    swipe.setRefreshing(false);
                });
            } catch (Exception e) {
                main.post(() -> {
                    Toast.makeText(requireContext(), "Failed to load devices", Toast.LENGTH_SHORT).show();
                    swipe.setRefreshing(false);
                });
            }
        });
    }

    private void filter(String q) {
        shown.clear();
        adapter.clear();
        String query = q.toLowerCase().trim();
        for (JSONObject d : allDevices) {
            String name   = d.optString("username", "").toLowerCase();
            String id     = d.optString("device_id", "").toLowerCase();
            String status = d.optString("status", "").toLowerCase();
            if (query.isEmpty() || name.contains(query) || id.contains(query)) {
                shown.add(d);
                String statusIcon = "active".equals(status) ? "✓" : ("suspended".equals(status) ? "✗" : "⏳");
                adapter.add(statusIcon + "  " + d.optString("username", id));
            }
        }
        adapter.notifyDataSetChanged();
    }

    @Override
    public void onDestroyView() { super.onDestroyView(); exec.shutdownNow(); }
}
```

---

### `DeviceDetailActivity.java`
Full on-site diagnostic screen for a specific device.

```java
package com.streamvault.admin;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.*;
import androidx.appcompat.app.AppCompatActivity;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.concurrent.*;

public class DeviceDetailActivity extends AppCompatActivity {

    private ApiClient api;
    private TextView tvName, tvStatus, tvDeviceId, tvLastSeen, tvRecordings, tvTickets;
    private Button btnActivate, btnSuspend;
    private ProgressBar progress;
    private JSONObject device;
    private final ExecutorService exec = Executors.newCachedThreadPool();
    private final Handler main         = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_device_detail);
        api = new ApiClient(this);

        tvName       = findViewById(R.id.tv_name);
        tvStatus     = findViewById(R.id.tv_status);
        tvDeviceId   = findViewById(R.id.tv_device_id);
        tvLastSeen   = findViewById(R.id.tv_last_seen);
        tvRecordings = findViewById(R.id.tv_recordings);
        tvTickets    = findViewById(R.id.tv_tickets);
        btnActivate  = findViewById(R.id.btn_activate);
        btnSuspend   = findViewById(R.id.btn_suspend);
        progress     = findViewById(R.id.progress);

        try {
            device = new JSONObject(getIntent().getStringExtra("device_json"));
        } catch (Exception e) { finish(); return; }

        populateHeader();
        loadAdditionalData();

        btnActivate.setOnClickListener(v -> setDeviceStatus("active"));
        btnSuspend.setOnClickListener(v -> setDeviceStatus("suspended"));
    }

    private void populateHeader() {
        String name   = device.optString("username", device.optString("device_id", "Unknown"));
        String status = device.optString("status", "unknown");
        String id     = device.optString("device_id", "—");
        String seen   = device.optString("last_seen", "Never");

        tvName.setText(name);
        tvDeviceId.setText("Device ID: " + id);
        tvLastSeen.setText("Last seen: " + seen);

        tvStatus.setText(status.toUpperCase());
        tvStatus.setBackgroundColor(getResources().getColor(
            "active".equals(status) ? android.R.color.holo_green_dark
            : "suspended".equals(status) ? android.R.color.holo_red_dark
            : android.R.color.darker_gray
        ));

        btnActivate.setEnabled(!"active".equals(status));
        btnSuspend.setEnabled(!"suspended".equals(status));
    }

    private void loadAdditionalData() {
        String userId = device.optString("user_id", device.optString("id", ""));
        if (userId.isEmpty()) return;

        // Recordings count
        exec.execute(() -> {
            try {
                JSONArray recs = api.getUserRecordings(userId);
                long completed = 0;
                for (int i = 0; i < recs.length(); i++) {
                    if ("completed".equals(recs.getJSONObject(i).optString("status"))) completed++;
                }
                final long c = completed;
                final int t = recs.length();
                main.post(() -> tvRecordings.setText(t + " recordings (" + c + " completed)"));
            } catch (Exception e) {
                main.post(() -> tvRecordings.setText("Unable to load recordings"));
            }
        });

        // Open tickets for this user
        exec.execute(() -> {
            try {
                JSONArray all = api.getTickets();
                int count = 0;
                for (int i = 0; i < all.length(); i++) {
                    JSONObject t = all.getJSONObject(i);
                    String uid = t.optString("user_id", "");
                    String s   = t.optString("status", "");
                    if (uid.equals(userId) && (!"resolved".equals(s) && !"closed".equals(s))) count++;
                }
                final int c = count;
                main.post(() -> tvTickets.setText(c > 0 ? c + " open ticket(s)" : "No open tickets"));
            } catch (Exception e) {
                main.post(() -> tvTickets.setText("Unable to load tickets"));
            }
        });
    }

    private void setDeviceStatus(String status) {
        progress.setVisibility(View.VISIBLE);
        btnActivate.setEnabled(false);
        btnSuspend.setEnabled(false);

        String deviceId = device.optString("id", device.optString("device_id", ""));
        exec.execute(() -> {
            try {
                api.updateDeviceStatus(deviceId, status);
                device.put("status", status);
                main.post(() -> {
                    progress.setVisibility(View.GONE);
                    populateHeader();
                    Toast.makeText(this, "Device " + status, Toast.LENGTH_SHORT).show();
                });
            } catch (Exception e) {
                main.post(() -> {
                    progress.setVisibility(View.GONE);
                    btnActivate.setEnabled(true);
                    btnSuspend.setEnabled(true);
                    Toast.makeText(this, "Failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        });
    }

    @Override
    protected void onDestroy() { super.onDestroy(); exec.shutdownNow(); }
}
```

---

### `TicketsFragment.java`
List of all support tickets with inline reply capability.

```java
package com.streamvault.admin;

import android.app.AlertDialog;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.*;
import android.widget.*;
import androidx.annotation.*;
import androidx.fragment.app.Fragment;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.*;
import java.util.concurrent.*;

public class TicketsFragment extends Fragment {

    private ApiClient api;
    private ListView listView;
    private SwipeRefreshLayout swipe;
    private final List<JSONObject> tickets = new ArrayList<>();
    private ArrayAdapter<String> adapter;
    private final ExecutorService exec = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());

    @Nullable @Override
    public View onCreateView(@NonNull LayoutInflater inf, ViewGroup container, Bundle state) {
        View v = inf.inflate(R.layout.fragment_tickets, container, false);
        api      = new ApiClient(requireContext());
        listView = v.findViewById(R.id.list_tickets);
        swipe    = v.findViewById(R.id.swipe_refresh);

        adapter = new ArrayAdapter<>(requireContext(), android.R.layout.simple_list_item_2,
                android.R.id.text1, new ArrayList<>());
        listView.setAdapter(adapter);

        listView.setOnItemClickListener((parent, view, pos, id) -> showTicketDialog(tickets.get(pos)));
        swipe.setOnRefreshListener(this::loadTickets);
        loadTickets();
        return v;
    }

    private void loadTickets() {
        swipe.setRefreshing(true);
        exec.execute(() -> {
            try {
                JSONArray arr = api.getTickets();
                tickets.clear();
                adapter.clear();
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject t = arr.getJSONObject(i);
                    tickets.add(t);
                    String status  = t.optString("status", "open");
                    String subject = t.optString("subject", "No subject");
                    String user    = t.optString("username", "Unknown");
                    String icon    = "open".equals(status) ? "🔴" : "resolved".equals(status) ? "✅" : "🟡";
                    adapter.add(icon + " [" + user + "] " + subject);
                }
                main.post(() -> {
                    adapter.notifyDataSetChanged();
                    swipe.setRefreshing(false);
                });
            } catch (Exception e) {
                main.post(() -> swipe.setRefreshing(false));
            }
        });
    }

    private void showTicketDialog(JSONObject ticket) {
        String subject = ticket.optString("subject", "Support Ticket");
        String desc    = ticket.optString("description", "");
        String status  = ticket.optString("status", "open");
        String tid     = ticket.optString("id", "");

        EditText etReply = new EditText(requireContext());
        etReply.setHint("Type your reply...");
        etReply.setSingleLine(false);
        etReply.setMinLines(3);

        new AlertDialog.Builder(requireContext())
            .setTitle(subject)
            .setMessage(desc + "\n\nStatus: " + status.toUpperCase())
            .setView(etReply)
            .setPositiveButton("Send Reply", (d, w) -> {
                String reply = etReply.getText().toString().trim();
                if (!reply.isEmpty() && !tid.isEmpty()) sendReply(tid, reply);
            })
            .setNeutralButton("Close Ticket", (d, w) -> {
                if (!tid.isEmpty()) closeTicket(tid);
            })
            .setNegativeButton("Cancel", null)
            .show();
    }

    private void sendReply(String ticketId, String message) {
        exec.execute(() -> {
            try {
                api.replyToTicket(ticketId, message);
                main.post(() -> Toast.makeText(requireContext(), "Reply sent", Toast.LENGTH_SHORT).show());
            } catch (Exception e) {
                main.post(() -> Toast.makeText(requireContext(), "Failed to send: " + e.getMessage(), Toast.LENGTH_LONG).show());
            }
        });
    }

    private void closeTicket(String ticketId) {
        exec.execute(() -> {
            try {
                api.closeTicket(ticketId);
                main.post(() -> {
                    Toast.makeText(requireContext(), "Ticket closed", Toast.LENGTH_SHORT).show();
                    loadTickets();
                });
            } catch (Exception e) {
                main.post(() -> Toast.makeText(requireContext(), "Failed", Toast.LENGTH_SHORT).show());
            }
        });
    }

    @Override
    public void onDestroyView() { super.onDestroyView(); exec.shutdownNow(); }
}
```

---

### `HealthFragment.java`
Live metrics — same data as the web System Health tab, auto-refreshes every 5 s.

```java
package com.streamvault.admin;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.*;
import android.widget.*;
import androidx.annotation.*;
import androidx.fragment.app.Fragment;
import org.json.JSONObject;
import java.util.concurrent.*;

public class HealthFragment extends Fragment {

    private ApiClient api;
    private TextView tvCpu, tvRam, tvDisk, tvLoad, tvRamDetail, tvDiskDetail, tvLastUpdate, tvStatus;
    private ProgressBar pbCpu, pbRam, pbDisk;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private ScheduledFuture<?> pollJob;

    @Nullable @Override
    public View onCreateView(@NonNull LayoutInflater inf, ViewGroup container, Bundle state) {
        View v = inf.inflate(R.layout.fragment_health, container, false);
        api = new ApiClient(requireContext());

        tvCpu       = v.findViewById(R.id.tv_cpu_pct);
        tvRam       = v.findViewById(R.id.tv_ram_pct);
        tvDisk      = v.findViewById(R.id.tv_disk_pct);
        tvLoad      = v.findViewById(R.id.tv_load);
        tvRamDetail = v.findViewById(R.id.tv_ram_detail);
        tvDiskDetail= v.findViewById(R.id.tv_disk_detail);
        tvLastUpdate= v.findViewById(R.id.tv_last_update);
        tvStatus    = v.findViewById(R.id.tv_health_status);
        pbCpu       = v.findViewById(R.id.pb_cpu);
        pbRam       = v.findViewById(R.id.pb_ram);
        pbDisk      = v.findViewById(R.id.pb_disk);

        return v;
    }

    @Override
    public void onResume() {
        super.onResume();
        fetchAndUpdate();
        // Poll every 5 seconds
        pollJob = scheduler.scheduleAtFixedRate(this::fetchAndUpdate, 5, 5, TimeUnit.SECONDS);
    }

    @Override
    public void onPause() {
        super.onPause();
        if (pollJob != null) pollJob.cancel(false);
    }

    private void fetchAndUpdate() {
        try {
            JSONObject h = api.getHealthMetrics();
            double cpu  = h.optDouble("cpu_percent", 0);
            double ram  = h.optDouble("ram_percent", 0);
            double disk = h.optDouble("disk_percent", 0);
            double load = h.optDouble("load_avg_1m", 0);
            double load5= h.optDouble("load_avg_5m", 0);
            double ramU = h.optDouble("ram_used_gb", 0);
            double ramT = h.optDouble("ram_total_gb", 0);
            double diskU= h.optDouble("disk_used_gb", 0);
            double diskT= h.optDouble("disk_total_gb", 0);

            main.post(() -> {
                tvCpu.setText(String.format("%.0f%%", cpu));
                tvRam.setText(String.format("%.0f%%", ram));
                tvDisk.setText(String.format("%.0f%%", disk));
                tvLoad.setText(String.format("Load: %.2f  (5m: %.2f)", load, load5));
                tvRamDetail.setText(String.format("%.1f / %.1f GB", ramU, ramT));
                tvDiskDetail.setText(String.format("%.1f / %.1f GB", diskU, diskT));
                tvLastUpdate.setText("Updated: " + new java.util.Date().toString().substring(11, 19));
                tvStatus.setText("Online");

                pbCpu.setProgress((int) cpu);
                pbRam.setProgress((int) ram);
                pbDisk.setProgress((int) disk);

                // Color-code bars
                int color = cpu > 85 || ram > 85 ? android.R.color.holo_red_light
                          : cpu > 65 || ram > 65 ? android.R.color.holo_orange_light
                          : android.R.color.holo_green_light;
                tvStatus.setTextColor(getResources().getColor(color));
            });
        } catch (Exception e) {
            main.post(() -> {
                tvStatus.setText("Offline");
                tvStatus.setTextColor(getResources().getColor(android.R.color.holo_red_light));
            });
        }
    }

    @Override
    public void onDestroyView() { super.onDestroyView(); scheduler.shutdownNow(); }
}
```

---

### `SettingsFragment.java`
Change server URL and logout.

```java
package com.streamvault.admin;

import android.content.Intent;
import android.os.Bundle;
import android.view.*;
import android.widget.*;
import androidx.annotation.*;
import androidx.fragment.app.Fragment;

public class SettingsFragment extends Fragment {

    @Nullable @Override
    public View onCreateView(@NonNull LayoutInflater inf, ViewGroup container, Bundle state) {
        View v = inf.inflate(R.layout.fragment_settings, container, false);
        ApiClient api = new ApiClient(requireContext());

        EditText etUrl  = v.findViewById(R.id.et_server_url);
        Button btnSave  = v.findViewById(R.id.btn_save_url);
        Button btnLogout= v.findViewById(R.id.btn_logout);

        etUrl.setText(api.getServerUrl());

        btnSave.setOnClickListener(view -> {
            String url = etUrl.getText().toString().trim();
            if (!url.isEmpty()) {
                api.setServerUrl(url);
                Toast.makeText(requireContext(), "Server URL updated", Toast.LENGTH_SHORT).show();
            }
        });

        btnLogout.setOnClickListener(view -> {
            api.clearToken();
            startActivity(new Intent(requireContext(), LoginActivity.class));
            requireActivity().finish();
        });

        return v;
    }
}
```

---

## Layout XML Summary

Create these layout files in `res/layout/`:

| File | Key Views |
|------|-----------|
| `activity_login.xml` | Logo `ImageView`, `EditText` ×3 (server URL, username, password), `Button` login, `ProgressBar`, `TextView` error |
| `activity_main.xml` | `FrameLayout` (`R.id.fragment_container`) + `BottomNavigationView` |
| `fragment_dashboard.xml` | Title `TextView`, stat cards: device count, ticket count, CPU %, RAM %, server status |
| `fragment_devices.xml` | `EditText` search bar, `SwipeRefreshLayout` wrapping `ListView` |
| `fragment_tickets.xml` | `SwipeRefreshLayout` wrapping `ListView` |
| `fragment_health.xml` | 3× (`TextView` + `ProgressBar`) for CPU/RAM/Disk, load avg `TextView`, last-updated `TextView` |
| `fragment_settings.xml` | `EditText` server URL, `Button` save, `Button` logout |
| `activity_device_detail.xml` | Header card (name, status badge, device ID, last seen), recording count, ticket count, `Button` Activate + Suspend, `ProgressBar` |

All layouts use dark background `#121212` with white/grey text and `#0056A8` accent colour.

---

## Before You Build

Update in `ApiClient.java`:
```java
// Testing (LAN):
prefs.getString(KEY_URL, "http://192.168.2.101:8001");

// Production (HTTPS):
prefs.getString(KEY_URL, "https://api.yourdomain.com");
```

Or leave as `YOUR_SERVER_IP` — the Settings screen lets you change it at runtime without rebuilding.

---

## APK Distribution

Same as the TV app — sideload only:

```bash
# Build
./gradlew assembleRelease

# Install to your tablet via USB
adb install app/build/outputs/apk/release/app-release.apk
```

Filename suggestion: `streamvault-admin-v1.0.apk`

---

## API Endpoints Used

| Action | Endpoint |
|--------|---------|
| Login | `POST /api/auth/login` |
| List devices | `GET /api/devices` |
| Update device | `PATCH /api/devices/{id}` |
| List tickets | `GET /api/tickets` |
| Reply to ticket | `POST /api/tickets/{id}/messages` |
| Close ticket | `PATCH /api/tickets/{id}` |
| Health metrics | `GET /api/health/metrics` |
| Storage stats | `GET /api/health/storage` |
| User recordings | `GET /api/recordings/user/{user_id}` |
