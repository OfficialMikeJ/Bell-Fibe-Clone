# IPTV Service - Product Requirements Document

## Original Problem Statement
StreamVault — a full-featured IPTV service with Live TV Guide. Full-stack application with admin dashboard and customer-facing EPG grid.

## Architecture
```
/app
├── backend/           FastAPI (Python) + MongoDB
│   ├── routes/        auth, channels, programs, devices, users, setup,
│   │                  media, vod, notifications, recordings, tickets, faq, customer, portal
│   ├── models/        admin, channel, device, program, service_config, user,
│   │                  media, vod, notification, recording, ticket, faq, customer
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
│       │               PortalFAQ, PortalSupport, PortalStatus,
│       │               RegisterPage, MyAccountPage, CustomerLoginPage
│       └── contexts/   AuthContext, ServiceContext
├── guide-app/         Standalone customer-facing TV guide app (React)
│   └── src/
│       ├── App.jsx     Auth shell with 45-day inactivity check
│       ├── config.js
│       └── pages/      ActivationGate.jsx (TOTP), TVGuide.jsx, VODPage.jsx, RecordingsPage.jsx
├── android/           Android WebView wrapper (README + build specs)
├── docker-compose.yml Production deployment config
```

## Core Features - Implemented

### Authentication & Security
- JWT-based admin authentication
- 2FA (Google Authenticator / TOTP) for admin
- Password reset via security questions
- Master Admin PIN for sidebar locking
- All admin API endpoints secured with Bearer token auth
- Canada-only geo-fencing for device activation
- Portal login via QR activation code (no username/password)

### Customer Authentication (Updated: Google Authenticator TOTP)
- Registration generates a TOTP secret automatically
- QR code on /register success page encodes `otpauth://` URI for Google Authenticator
- Device activation (guide-app): email + 6-digit TOTP code from Google Authenticator
- 45-day inactivity → guide-app forces re-authentication via TOTP
- IP-based lockout: 3 failed TOTP attempts → 45-minute block
- Re-authentication: same TOTP endpoint handles both first activation and re-auth
- TOTP secret stored in customer record; QR accessible in /my-account

### Admin Dashboard (14 tabs)
1. **Channels** - CRUD with logo upload, quality label, channel type, stream URL
2. **EPG Programs** - Create/delete with media file link, auto-fill duration from FFmpeg
3. **Media Library** - Upload video files, FFmpeg auto-detects metadata
4. **VOD** - VOD catalog management
5. **Devices** - QR code generation, UUID display, geo, IP tracking
6. **Users** - Full CRUD with status (active/suspended/trial/cancelled), notes
7. **Notifications** - Create/toggle/delete notifications
8. **CVR** - Cloud Video Recording management
9. **Support Tickets** - Color-coded priority, status tags, admin reply
10. **FAQ** - Manage FAQ articles
11. **Statistics** - Channel/program/device counts
12. **Analytics** - Charts for content, storage, recordings
13. **Branding** - Logo, service name, Master PIN setup
14. **Settings** - 2FA setup, domain config, Uptime Kuma URL

### Customer Portal (/portal)
- QR code login (activation code → user_id session)
- FAQ page with search and category accordion
- Support ticket submission + My Tickets view
- Service Status page (embeds Uptime Kuma)

### Customer Registration (/register, /customer-login, /my-account)
- Public landing page with Google Authenticator preview
- Registration form: name, email, password, device brand/type, disclaimer
- Post-registration: Google Authenticator QR code setup screen (4-step instructions)
- /my-account: Google Authenticator status, QR code for re-scanning, device info

### Guide App (standalone /app/guide-app)
- ActivationGate: email + 6-digit TOTP entry (Google Authenticator)
- 45-day inactivity check (client-side via localStorage)
- TVGuide: live channel list + current programs
- VODPage: on-demand content grid
- RecordingsPage: user's CVR recordings

### Deployment Infrastructure
- docker-compose.yml: backend, frontend, guide-app, MongoDB, network for Nginx Proxy Manager
- Android WebView wrapper: full README with MainActivity.java, manifest, build.gradle

## Key Technical Decisions
- pyotp library used for TOTP generation and verification (valid_window=1 for ±30s clock drift)
- Google Authenticator QR = otpauth:// URI → same PNG infrastructure as before
- FFmpeg installed system-wide; ffprobe used for media analysis
- Frontend uses ServiceContext to load service name from /api/setup/config
- IP lockout shared collection (pin_attempt_log) for both PIN and TOTP endpoints

## Database Collections
- `admins`, `users`, `service_configs`, `channels`, `epg_programs`
- `devices`, `media_items`, `vod_items`, `notifications`, `recordings`
- `customer_accounts`: includes `totp_secret`, `last_active_at`, `is_activated`, `device_id`
- `tickets`, `faqs`, `portal_sessions`
- `pin_attempt_log`: IP-based lockout for TOTP/PIN attempts

## Key API Endpoints
- `POST /api/customer/register` — creates account, generates TOTP secret + GA QR
- `POST /api/customer/activate-with-totp` — email + TOTP code, handles first activation + re-auth
- `POST /api/customer/activate-with-pin` — legacy PIN endpoint (kept for backward compat)
- `POST /api/customer/login` — email + password (web portal login)
- `POST /api/customer/refresh-pin` — regenerates GA QR (secret unchanged)
- `GET /api/customer/me` — returns customer profile (no PIN, no secret)
- `POST /api/devices/portal-login` — portal QR login
- `GET/POST /api/tickets/`, `GET/POST /api/faqs/`

## Test Credentials
- Admin: username=admin, password=admin123

## Completion Status (as of 2026-02-10): All core features implemented and tested
- Backend: TOTP (22/22), all previous tests passing; Roku code fully removed
- Frontend: StreamVault branding live; all flows verified
- Guide-app: Full layout + Netflix-style entrance animations on ActivationGate
- Dockerfiles: backend, frontend, guide-app all created with nginx configs

## P1 Backlog
- Guide-app: Update REACT_APP_API_URL fallback in config.js from localhost to production URL
- Guide-app: Add `.env` file for local guide-app development

## P2 Future
- Migrate EPGGrid, Sidebar, TopBar from main frontend into guide-app for full separation
- Guide-app needs Dockerfile + supervisor config for deployment

## P2 Future
- Android APK build (WebView wrapping guide-app)
- Actual HLS/RTSP stream playback integration
- CVR automated recording (background job)
- TOTP secret rotation option (for lost authenticator device)
