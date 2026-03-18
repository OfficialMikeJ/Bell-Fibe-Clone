# StreamVault IPTV — Product Requirements Document

## Original Problem Statement
StreamVault — a full-featured IPTV service with Live TV Guide (EPG), VOD section, admin dashboard, customer support portal, and public registration website. Containerized for deployment on a user-provided server with a custom domain and an external Nginx Proxy Manager.

## Architecture
```
/app
├── backend/           FastAPI (Python) + MongoDB (Motor async)
│   ├── routes/        auth, channels, programs, devices, users, setup,
│   │                  media, vod, notifications, recordings, tickets, faq,
│   │                  customer, guide_state, apk, home_posts, catalog, app_version
│   ├── models/        admin, channel, device, program, service_config, user,
│   │                  media, vod, notification, recording, ticket, faq, customer
│   └── utils/         geo_location, https_middleware, qr_generator,
│                      security, two_factor, media_utils (FFmpeg wrapper)
├── frontend/          React + TailwindCSS + Shadcn UI + hls.js
│   └── src/
│       ├── App.js     Main router — guide/ondemand/home/recordings/notifications/
│       │              user-settings/app-info views + VersionPopup
│       ├── components/
│       │   ├── AdminDashboard.jsx   (16 tabs including Catalog + Home Feed)
│       │   ├── EPGGrid.jsx          (purple card system, coming_soon popup, VOD link)
│       │   ├── ChannelFeatured.jsx  (hls.js player, auto-volume 30%, slider)
│       │   ├── HomePage.jsx         (dynamic home: VOD + posts)
│       │   ├── HomeFeedTab.jsx      (admin: create/edit/delete home posts)
│       │   ├── CatalogTab.jsx       (admin: full IMDB-like media catalog)
│       │   ├── OnDemandPage.jsx     (VOD browser with category filter)
│       │   ├── UserSettingsPage.jsx (volume, autoplay, quality prefs → localStorage)
│       │   ├── AppInfoPage.jsx      (version info + changelog + popup trigger)
│       │   ├── UserManagementTab.jsx (shows app_username / app_password)
│       │   └── SettingsTab.jsx      (APK upload section)
│       └── pages/
│           ├── ActivationGate.jsx   (username+password device login)
│           └── RegisterPage.jsx     (no TOTP)
├── android/           README.md with full Android WebView wrapper code
├── APRIL_ANDROID_UPDATE_FEATURES.md  (for Gemini updates)
├── docker-compose.yml Production deployment (external NPM)
└── guide-app/         DEAD CODE — to be deleted (P2 cleanup)
```

## Core Features — Implemented & Tested

### Authentication & Security
- JWT admin authentication
- Password reset via security questions
- Master Admin PIN for sidebar locking
- Canada-only geo-fencing for device activation (configurable)

### Customer Device Authentication (Username/Password)
- Admin creates customer accounts; system generates unique `app_username` + `app_password`
- Visible to admin in Users tab for manual device setup
- Device activation via `POST /api/customer/activate-with-credentials`
- 45-day inactivity check; IP-based lockout on failed attempts

### Admin Dashboard (16 tabs)
1. Channels — CRUD, logo upload, quality label, channel_type, stream URL, coming_soon flag
2. EPG Programs — Create/delete, media file link, FFmpeg duration auto-fill
3. Media Library — Upload video files, FFmpeg metadata; **channel-based subfolders** (`{show_slug}_ch{num}`)
4. VOD — VOD catalog management
5. **Media Catalog** — Full IMDB-like system: title, tagline, content_type, genres, release_date, runtime, director, producers, cast (w/ photos), studio, rating, language, country, tags, poster, backdrop, gallery images
6. Devices — UUID display, geo, IP tracking, **installed_app_version** column
7. Users — Full CRUD, auto-generated credentials, status, notes
8. Notifications — Create/toggle/delete
9. CVR — Cloud Video Recording management
10. Support Tickets — Color-coded, admin reply
11. FAQ — Manage FAQ articles
12. Statistics — Channel/program/device counts
13. Analytics — Charts
14. Branding — Logo, service name, Master PIN
15. Settings — APK upload, domain config, Uptime Kuma, **OTA Auto-Update**, **Server Migration/Backup**
16. **Home Feed** — Create/edit/delete/publish announcement posts

### Customer-Facing Guide App (at /)
- Sidebar: Home | Guide | On Demand | Recordings | What's New | Saved | **User Settings** | **App Info** | Admin (locked)
- **Home page**: Dynamic sections — Upcoming Movies, New on TV, App Updates, Upcoming Features
- EPG grid with **purple card system** (deep purple gradient `#1e0f35→#160a2a`)
- HLS preview player with **auto-volume (30% default)**, hover volume slider with % readout
- "Coming Soon" channels show popup modal on click
- VOD browser (OnDemandPage) with category filter
- **User Settings**: Volume slider, autoplay toggle, quality preference (all localStorage-persisted)
- **App Info**: Version `0.94.0.1.A (Alpha build)` display + changelog popup
- **Version popup**: Auto-shows on first load per version (dismissed state in localStorage)

### Deployment Infrastructure
- docker-compose.yml: backend + frontend + MongoDB, designed for external Nginx Proxy Manager
- Android WebView wrapper documented in /app/android/README.md
- APRIL_ANDROID_UPDATE_FEATURES.md for Gemini-assisted release note generation

## Key Technical Decisions
- hls.js for HLS stream playback in the guide
- Volume stored in localStorage `sv_volume_preference` (0.0–1.0, default 0.3)
- Autoplay in localStorage `sv_autoplay_enabled` (bool, default true)
- Version popup: checks `sv_last_seen_version` in localStorage vs API version string
- Media Catalog upload dirs: `/app/backend/uploads/catalog/{posters,backdrops,cast,gallery}/`

## Database Collections
- `admins`, `users`, `service_configs`, `channels`, `epg_programs`
- `devices`, `media_items`, `vod_items`, `notifications`, `recordings`
- `customer_accounts`: `app_username`, `app_password_hash`, `is_activated`, `device_id`, `last_active_at`
- `tickets`, `faqs`, `portal_sessions`
- `pin_attempt_log`: IP-based lockout
- `home_posts`: `{id, title, body, category, is_published, version_tag, created_at}`
- `apk_versions`: APK update management
- `media_catalog`: `{id, title, tagline, content_type, genres[], release_date, runtime_minutes, description, director, producers[], cast[{id,name,character,photo_path}], studio, rating, language, country, tags[], poster_path, backdrop_path, additional_images[], created_at, updated_at}`
- `app_version`: `{version, sections[{heading, items[]}]}`

## Key API Endpoints
- `POST /api/customer/activate-with-credentials` — device login
- `GET /api/home-posts` — public published posts
- `GET /api/catalog` — public catalog list
- `GET /api/catalog/{id}` — single catalog entry
- `POST /api/catalog` — admin create catalog entry
- `PUT /api/catalog/{id}` — admin update
- `DELETE /api/catalog/{id}` — admin delete
- `POST /api/catalog/{id}/poster` — upload poster
- `POST /api/catalog/{id}/backdrop` — upload backdrop
- `POST /api/catalog/{id}/gallery` — add gallery image
- `POST /api/catalog/{id}/cast` — add cast member
- `DELETE /api/catalog/{id}/cast/{cast_id}` — remove cast member
- `POST /api/catalog/{id}/cast/{cast_id}/photo` — upload cast photo
- `GET /api/app-version` — current version string + sections
- `PUT /api/app-version` — admin update version info
- `GET /api/apk/latest` — Android app update check

## Test Credentials
- Admin: username=admin, password=admin123
- Customer accounts: generated via /register, credentials in Admin → Users tab

## P1 Upcoming (User Tasks)
- Android App build: Take code from /app/android/README.md, create Android Studio project, compile APK
- Nginx Proxy Manager config: proxy hosts for backend (:8001) and frontend (:3000)
- Populate App Version changelog via Admin → Settings or direct API call to `PUT /api/app-version`

## P2 Backlog
- **Delete /app/guide-app** — confirmed dead code
- TV Tuner Integration (Free-to-Air channels with actual stream URLs)
- VOD Content Ingestion system (file uploads for movies/shows)
- Link catalog entries to EPG programs and VOD items via dropdown in admin forms
- Live TV channels: connect actual HLS/RTSP stream URLs
- CVR automated recording (background job)
- Credential rotation option (admin-triggered)

## Completion Status (as of 2026-03)
- Home Feed: COMPLETE & TESTED (iteration_12: 100%)
- Media Catalog: COMPLETE & TESTED (iteration_13: 100% backend, 95% frontend)
- User Settings + App Info + Version Popup: COMPLETE & TESTED
- EPG Purple Cards: COMPLETE & TESTED
- Auto Volume: COMPLETE & TESTED (code-level fix applied post iter13)
- Docker infrastructure: VALIDATED (iteration_11: 100%)
