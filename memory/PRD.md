# IPTV Service - Product Requirements Document

## Original Problem Statement
Clone of Bell Canada's TV service (IPTV + Live TV Guide). Full-stack application with admin dashboard and customer-facing EPG grid. No copyrighted materials (logos/channel names).

## Architecture
```
/app
├── backend/           FastAPI (Python) + MongoDB
│   ├── routes/        auth, channels, programs, devices, users, setup
│   ├── models/        admin, channel, device, program, service_config, user
│   └── utils/         geo_location, https_middleware, qr_generator, security, two_factor
├── frontend/          React + TailwindCSS + Shadcn UI
│   └── src/
│       ├── components/ AdminDashboard, LoginPage, SettingsTab, UserManagementTab,
│       │               TwoFactorSetup, SetupWizard, EPGGrid, Sidebar, TopBar, ChannelFeatured
│       └── contexts/   AuthContext, ServiceContext
├── guide-app/         Placeholder for future standalone guide app
└── android/           Placeholder for Android wrapper
```

## Core Features - Implemented

### Authentication & Security
- JWT-based admin authentication
- Two-Factor Authentication (Google Authenticator / TOTP)
- Password reset via security questions
- Route protection (admin routes require JWT)
- All admin API endpoints secured with Bearer token auth
- Canada-only geo-fencing for device activation

### Admin Dashboard (6 tabs)
- **Channels**: CRUD with logo upload, inline SVG fallback for logos
- **EPG Programs**: Create/delete programs with date/time/duration/channel
- **Devices**: QR code generation, Refresh QR, Reset activation code, geo-location display
- **Users**: Full CRUD with status (active/suspended/trial/cancelled), notes, max devices
- **Statistics**: Total channels, programs, active devices
- **Settings**: Service name config (saved to DB + ServiceContext), 2FA enable/disable, domain config

### TV Guide (Customer-facing)
- EPG grid with 30-minute time slots
- Sidebar navigation (Guide, Home, Coming Soon items)
- Dynamic service name from DB via ServiceContext
- Channel featured display

### Device Management
- QR code activation system
- MAC address + UUID tracking
- Geo-location validation (Canada only)
- IP history tracking

### Setup Wizard
- Multi-step guided setup
- System requirements check
- Service naming
- Admin account creation with security questions

## Key Technical Decisions
- Frontend uses ServiceContext to load service name from `/api/setup/config`
- Setup completion requires: service_configured=True AND admin_exists (no longer requires 25 channels)
- Channel logo fallback: inline SVG data URI (no external URL dependency)

## Database Collections
- `admins`: username, password_hash, security_questions, two_fa_secret, two_fa_enabled
- `users`: username, email, full_name, account_status, max_devices, notes, is_active
- `service_configs`: setup_completed, service_name, domain_name
- `channels`: name, number, description, logo_path
- `epg_programs`: channel_id, title, description, start_time, end_time, date, duration_minutes
- `devices`: device_name, mac_address, device_uuid, activation_code, qr_code_path, status, user_id, ip_history

## API Endpoints
- POST /api/auth/login (with optional two_fa_code)
- GET /api/auth/verify
- POST /api/auth/password-reset
- GET /api/auth/security-questions/{username}
- POST /api/auth/2fa/setup, /enable, /disable
- GET/POST/PUT/DELETE /api/channels (auth required for write)
- GET/POST/DELETE /api/programs (auth required)
- GET/POST /api/devices (auth required)
- POST /api/devices/refresh-qr (auth required)
- POST /api/devices/activate (public - for IPTV boxes)
- GET /api/devices/guide/{device_id} (public - geo-validated)
- GET/POST/PUT/DELETE /api/users (all auth required)
- GET /api/setup/status
- GET /api/setup/config
- POST /api/setup/service-config (auth required)

## Test Credentials
- Admin: username=admin, password=admin123
- Note: Default admin has no security questions (created by auto-setup)

## Completion Status (as of 2026-03-12)
Estimated ~98% complete

## P0 Remaining
- None - all core features implemented and tested

## P1 Backlog
- Separate guide-app: Move EPGGrid, Sidebar, TopBar to /app/guide-app as standalone React app
- Android app wrapper: Package guide-app using /app/android folder

## Future (P2)
- CVR (Cloud Video Recorder) feature - documented in /app/FUTURE_DEVELOPMENT.md
- Public customer registration website
- Add security questions to default admin account
