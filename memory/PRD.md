# IPTV Service - Product Requirements Document

## Original Problem Statement
Clone of Bell Canada's TV service (IPTV + Live TV Guide). Full-stack application with admin dashboard and customer-facing EPG grid. No copyrighted materials.

## Architecture
```
/app
├── backend/           FastAPI (Python) + MongoDB
│   ├── routes/        auth, channels, programs, devices, users, setup,
│   │                  media, vod, notifications, recordings, tickets, faq
│   ├── models/        admin, channel, device, program, service_config, user,
│   │                  media, vod, notification, recording, ticket, faq
│   └── utils/         geo_location, https_middleware, qr_generator,
│                      security, two_factor, media_utils (FFmpeg wrapper)
├── frontend/          React + TailwindCSS + Shadcn UI
│   └── src/
│       ├── components/ AdminDashboard (14 tabs), LoginPage, SettingsTab,
│       │               UserManagementTab, TwoFactorSetup, SetupWizard,
│       │               EPGGrid, Sidebar, TopBar, ChannelFeatured,
│       │               MediaLibraryTab, VODTab, NotificationsTab,
│       │               CVRTab, BrandingTab, AnalyticsTab,
│       │               admin/TicketsTab, admin/FAQTab
│       │               OnDemandPage, RecordingsPage, NotificationsPage
│       ├── pages/      ActivatePage, PortalLayout, PortalHome,
│       │               PortalFAQ, PortalSupport, PortalStatus
│       └── contexts/   AuthContext, ServiceContext
├── guide-app/         Placeholder for standalone guide app (future)
└── android/           Placeholder for Android wrapper (future)
```

## Core Features - Implemented

### Authentication & Security
- JWT-based admin authentication
- 2FA (Google Authenticator / TOTP)
- Password reset via security questions
- Master Admin PIN for sidebar locking
- All admin API endpoints secured with Bearer token auth
- Canada-only geo-fencing for device activation
- Portal login via QR activation code (no username/password)

### Admin Dashboard (14 tabs)
1. **Channels** - CRUD with logo upload, quality label (720p/720p60/1080p/1080p60/1440p/1440p60/4K/4K60), channel type (live/VOD), stream URL
2. **EPG Programs** - Create/delete with media file link (auto-fills duration from FFmpeg), poster display
3. **Media Library** - Upload video files (FFmpeg auto-detects duration/resolution/fps/quality), poster upload, metadata CRUD
4. **VOD** - VOD catalog management, link to media library, featured flag, poster
5. **Devices** - QR code generation, full UUID display, geo (City, Province, Country), Public IP with Static/Dynamic indicator, User ID, Refresh/Reset QR
6. **Users** - Full CRUD with status (active/suspended/trial/cancelled), notes, max devices
7. **Notifications** - Create/toggle/delete notifications
8. **CVR** - View all user recordings, status management, storage config, user hour requests
9. **Support Tickets** - Color-coded priority (Critical/High/Medium/Info/Resolved), status tags (#Open/#In-Progress/#Resolved/#Closed), ticket types, admin reply with Admin ✓ badge, IP cross-reference
10. **FAQ** - Manage FAQ articles (question/answer/category/order/visibility), shown in portal
11. **Statistics** - Total channels, programs, active devices
12. **Analytics** - Charts for content types, genres, channel popularity, storage, recording hours
13. **Branding** - Service logo upload, service name, Master PIN setup
14. **Settings** - 2FA setup, domain config, Uptime Kuma status page URL, account info

### Customer Portal (/portal)
- QR code login (activation code → user_id session)
- FAQ page with search and category accordion
- Support ticket submission + My Tickets view (with ticket types)
- Service Status page (embeds Uptime Kuma status page)

### Self-Serve Activation (/activate)
- Customer scans QR → opens /activate?code={activation_code}
- Device lookup, Canada geo-check, confirmation flow
- Shows User ID after activation

### QR Code System
- QR codes encode activation URL: {service_domain}/activate?code={activation_code}
- Self-service: no admin visit required
- Portal login: enter activation code → get user_id session

### Customer Registration Website (/register, /customer-login, /my-account)
- Public landing page at /register (hero, features, CTA)
- Registration form: first/last name, email, password, device brand (Samsung/LG/TCL/Sony/Hisense/OnePlus/Motorola/Xiaomi/Philips/Other), device type (Android Smart TV/Box/Tablet/Phone/Other)
- Android device compatibility disclaimer (must acknowledge to proceed)
- Auto-login after registration → redirected to /my-account
- Customer dashboard: large 6-digit PIN display, QR code, account info, quick links
- Customer login at /customer-login (email/password)
- PIN refresh feature (generates new PIN, regenerates QR)

### 6-Digit PIN Activation System
- Every customer account gets a unique cryptographically-random 6-digit PIN
- PIN displayed prominently on /my-account page as large individual digit boxes
- QR code encodes {service_url}/activate?pin={PIN} for optional scan-to-activate
- App enters 6-digit PIN at /activate (or /activate?pin=XXXXXX for QR pre-fill)
- IP-based lockout: 3 failed attempts from same IP → 45-minute block (HTTP 429)
- Admin can clear lockouts via DELETE /api/customer/admin/lockout/clear

### TV Guide (Customer-facing Sidebar - 7 items)
- **Home** - Welcome page
- **Guide** - EPG grid with keyboard/D-pad navigation, video preview, channel logos
- **On Demand** - VOD catalog with categories (Movie/TV Show/Mini Series/Limited Series)
- **Recordings** - User's CVR recordings (view/play/delete)
- **What's New** - Notifications feed
- **Saved** - Placeholder for saved programs
- **Settings** (Admin locked) - Redirects to /admin

### Media System
- FFmpeg-based media analysis (duration, resolution, fps, quality auto-detection)
- Auto-fill EPG program duration from uploaded media file
- Video player in ChannelFeatured (HTML5 video element)
- Poster images on EPG grid programs

### Device Management
- QR code activation system
- MAC address + UUID tracking
- Geo-location validation (Canada only)
- IP history tracking

### CVR (Cloud Video Recording)
- Users schedule recordings from the guide
- Admin manages recordings via CVR tab
- Users view/play/delete recordings from Recordings page

## Key Technical Decisions
- FFmpeg installed system-wide; ffprobe used for media analysis
- Frontend uses ServiceContext to load service name from `/api/setup/config`
- Channel logo fallback: inline SVG data URI (no external URL dependency)
- Keyboard navigation (Arrow keys = D-pad) added to EPGGrid for Android TV remote
- VOD and Notifications GET endpoints are public; all write and media endpoints require auth

## Database Collections
- `admins`: username, password_hash, security_questions, two_fa_secret, two_fa_enabled
- `users`: username, email, full_name, account_status, max_devices, notes, is_active
- `service_configs`: setup_completed, service_name, domain_name, logo_path, master_pin_hash
- `channels`: name, number, description, logo_path, quality_label, channel_type, stream_url
- `epg_programs`: channel_id, title, description, start_time, end_time, date, duration_minutes, media_id, poster_path
- `devices`: device_name, mac_address, device_uuid, activation_code, qr_code_path, status, user_id, ip_history
- `media_items`: title, description, file_path, poster_path, duration_seconds, duration_formatted, resolution, fps, quality_label, file_size, media_type, genre, year, rating
- `vod_items`: title, description, media_id, poster_path, category, genre, year, rating, is_featured
- `notifications`: title, message, type, channel_id, channel_name, image_path, is_active
- `recordings`: user_id, device_id, channel_id, channel_name, program_title, start_time, end_time, date, duration_minutes, status, file_path

## Test Credentials
- Admin: username=admin, password=admin123
- Note: Default admin has no security questions configured

## Completion Status (as of 2026-03-12): 100% core features tested & working

## Recently Completed (2026-03-12 fork session)
1. **Setup Service Config API fix**: Made `service_name` optional in `/api/setup/service-config`; added `cvr_total_storage_gb`, `hours_request_min`, `hours_request_max` fields
2. **Config endpoint fix**: `/api/setup/config` now returns CVR storage fields
3. **Uploads routing fix**: All upload files now served under `/api/uploads/...` (Kubernetes ingress compatible); frontend updated across 9 components
4. **Media streaming**: Custom Range-streaming endpoint moved to `/api/uploads/media/{filename}`
5. **Test coverage**: Backend 100% (26/26), Frontend 100% - iteration_3 report

## P1 Backlog
- Separate guide-app: Move EPGGrid, Sidebar, TopBar to /app/guide-app as standalone React app (prerequisite for Android)
- Android wrapper: Package guide-app in /app/android

## Future (P2)
- Public customer registration website
- Actual HLS/RTSP stream playback integration
- CVR automated recording (background job)
