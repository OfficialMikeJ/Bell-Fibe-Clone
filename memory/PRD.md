# StreamVault IPTV — Product Requirements Document

## Original Problem Statement
StreamVault — a full-featured IPTV service with Live TV Guide (EPG), VOD section, admin dashboard, customer support portal, and public registration website. Containerized for deployment on a user-provided server with a custom domain and an external Nginx Proxy Manager.

## Architecture
```
/app
├── backend/           FastAPI (Python) + MongoDB (Motor async)
│   ├── routes/        auth, channels, programs, devices, users, setup,
│   │                  media, vod, notifications, recordings, tickets, faq,
│   │                  customer, guide_state, apk, home_posts
│   ├── models/        admin, channel (coming_soon, channel_type), device,
│   │                  program, service_config, user, media, vod,
│   │                  notification, recording, ticket, faq, customer
│   └── utils/         geo_location, https_middleware, qr_generator,
│                      security, two_factor, media_utils (FFmpeg wrapper)
├── frontend/          React + TailwindCSS + Shadcn UI + hls.js
│   └── src/
│       ├── App.js     Main router — guide/ondemand/home/recordings/notifications views
│       ├── components/
│       │   ├── AdminDashboard.jsx   (15 tabs including Home Feed)
│       │   ├── EPGGrid.jsx          (coming_soon popup, VOD channel link)
│       │   ├── ChannelFeatured.jsx  (hls.js player, VOD card)
│       │   ├── HomePage.jsx         (dynamic home: VOD + posts)
│       │   ├── HomeFeedTab.jsx      (admin: create/edit/delete home posts)
│       │   ├── OnDemandPage.jsx     (VOD browser with category filter)
│       │   ├── UserManagementTab.jsx (shows app_username / app_password)
│       │   └── SettingsTab.jsx      (APK upload section)
│       └── pages/
│           ├── ActivationGate.jsx   (username+password device login)
│           └── RegisterPage.jsx     (no TOTP)
├── android/           README.md with full Android WebView wrapper code
├── docker-compose.yml Production deployment (external NPM)
└── guide-app/         DEAD CODE — to be deleted
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

### Admin Dashboard (15 tabs)
1. Channels — CRUD, logo upload, quality label, channel_type, stream URL, coming_soon flag
2. EPG Programs — Create/delete, media file link, FFmpeg duration auto-fill
3. Media Library — Upload video files, FFmpeg metadata
4. VOD — VOD catalog management
5. Devices — UUID display, geo, IP tracking
6. Users — Full CRUD, auto-generated credentials, status, notes
7. Notifications — Create/toggle/delete
8. CVR — Cloud Video Recording management
9. Support Tickets — Color-coded, admin reply
10. FAQ — Manage FAQ articles
11. Statistics — Channel/program/device counts
12. Analytics — Charts
13. Branding — Logo, service name, Master PIN
14. Settings — APK upload, domain config, Uptime Kuma
15. **Home Feed** — Create/edit/delete/publish announcement posts (app_update, upcoming_feature)

### Customer-Facing Guide App (at /)
- Sidebar navigation: Home | Guide | On Demand | Recordings | Notifications
- **Home page**: Dynamic sections — Upcoming Movies, New on TV, App Updates, Upcoming Features
- EPG grid with HLS video previews for channels with stream URLs
- "Coming Soon" channels show popup modal on click
- "On Demand" channel in EPG links to VOD browser (filtered to Movies)
- VOD browser (OnDemandPage) with category filter
- Android WebView wrapper documented in /app/android/README.md

### Deployment Infrastructure
- docker-compose.yml: backend + frontend + MongoDB, designed for external Nginx Proxy Manager
- Android WebView wrapper: full README with modern ExecutorService-based update check

## Key Technical Decisions
- hls.js for HLS stream playback in the guide
- pyotp REMOVED — replaced by simple username/password credentials
- FFmpeg system-wide for media analysis
- home_posts collection: `{id, title, body, category, is_published, version_tag, created_at}`

## Database Collections
- `admins`, `users`, `service_configs`, `channels`, `epg_programs`
- `devices`, `media_items`, `vod_items`, `notifications`, `recordings`
- `customer_accounts`: `app_username`, `app_password_hash`, `is_activated`, `device_id`, `last_active_at`
- `tickets`, `faqs`, `portal_sessions`
- `pin_attempt_log`: IP-based lockout
- `home_posts`: `{id, title, body, category, is_published, version_tag, created_at}`
- `apk_versions`: APK update management

## Key API Endpoints
- `POST /api/customer/activate-with-credentials` — device login (username+password)
- `GET /api/home-posts` — public, returns published posts sorted newest first
- `GET /api/home-posts/admin/all` — admin, returns all posts (auth required)
- `POST /api/home-posts` — admin create post
- `PUT /api/home-posts/{id}` — admin update post
- `DELETE /api/home-posts/{id}` — admin delete post
- `GET /api/apk/latest` — Android app update check
- `POST /api/apk/upload` — admin APK upload

## Test Credentials
- Admin: username=admin, password=admin123
- Customer accounts: generated via /register, credentials in Admin → Users tab

## P1 Upcoming (User Tasks)
- Android App build: Take code from /app/android/README.md, create Android Studio project, compile APK
- Nginx Proxy Manager config: proxy hosts for backend (:8001) and frontend (:3000)

## P2 Backlog
- **Delete /app/guide-app** — confirmed dead code, causes confusion
- TV Tuner Integration: backend logic for Free-to-Air channels
- VOD Content Ingestion: file upload system for movie/show files
- Add Volume Slider to HLS preview player in the guide
- Live TV channels: connect actual HLS/RTSP stream URLs
- CVR automated recording (background job)
- Credential rotation option (admin-triggered)

## Completion Status (as of 2026-02)
- Home Feed feature: COMPLETE & TESTED (iteration_12: 100% pass, 27/27 flows)
- Docker infrastructure: VALIDATED (iteration_11: 100% pass)
- All core features: implemented and tested across iterations 1-12
