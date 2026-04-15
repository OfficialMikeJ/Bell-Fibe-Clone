# StreamVault — Installation & Setup Guide

A self-hosted IPTV service with Live TV Guide (EPG), Video on Demand, cloud recordings, device activation, and admin dashboard.

## Table of Contents

- [System Requirements](#system-requirements)
- [Quick Start](#quick-start)
- [Detailed Installation](#detailed-installation)
- [Configuration](#configuration)
- [First-Time Setup](#first-time-setup)
- [Features](#features)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)
- [Production Deployment](#production-deployment)
- [Admin CLI Tools](#admin-cli-tools)

---

## System Requirements

### Minimum Requirements
- **OS**: Ubuntu 22.04+ / Debian 12+
- **CPU**: 2 cores
- **RAM**: 4GB
- **Disk**: 10GB free space
- **Network**: Stable internet connection

### Required Software
- **Python**: 3.11 or higher
- **Node.js**: 18.x or higher
- **Yarn**: 1.22.x or higher
- **MongoDB**: 8.0
- **Supervisor**: For process management
- **Git**: For pulling the code

---

## Quick Start

```bash
# 1. Navigate to where you want to install StreamVault
#    Use /opt for a system-wide install, or ~ for your home directory
cd /opt

# 2. Clone the repository (public repo — no username or password required)
sudo git clone https://github.com/YOUR_GITHUB_USERNAME/Bell-Fibe-Clone.git streamvault
cd streamvault

# 3. Set ownership to your user so you don't need sudo for everything
sudo chown -R $USER:$USER /opt/streamvault

# 4. Install system dependencies
sudo apt-get update
sudo apt-get install -y python3.11 python3.11-venv python3-pip nodejs npm supervisor git
sudo npm install -g yarn

# 5. Setup Backend
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 6. Setup Frontend
cd ../frontend
yarn install

# 7. Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# 8. Configure Environment
cd ../backend
cp .env.example .env
# Edit .env with your settings (see Configuration section below)

# 9. Start Services
sudo supervisorctl reload
sudo supervisorctl start all

# 10. Access the application
# Frontend:  http://your-server-ip:3000
# Admin:     http://your-server-ip:3000/admin/login
# API Docs:  http://your-server-ip:8001/docs
```

---

## Detailed Installation

### Step 1: Install Git and Clone the Repository

```bash
sudo apt-get update
sudo apt-get install -y git
```

**Clone the repository into `/opt/streamvault`:**
```bash
cd /opt
sudo git clone https://github.com/YOUR_GITHUB_USERNAME/Bell-Fibe-Clone.git streamvault
cd streamvault

# Set ownership to your user
sudo chown -R $USER:$USER /opt/streamvault
```

> **Replace `YOUR_GITHUB_USERNAME`** with your actual GitHub username. The repo name on GitHub is `Bell-Fibe-Clone` — the command above clones it into a local folder called `streamvault`.

> **No username or password required.** Public GitHub repositories can be cloned over HTTPS without any credentials. If Git asks you for a username/password, your system has cached old credentials. Clear them with:
> ```bash
> git config --global --unset credential.helper
> ```
> Then run the clone command again.

**Pulling future updates:**
```bash
cd /opt/streamvault
git pull origin main
```
This also requires no credentials for public repos.

### Step 2: Install Python 3.11+

```bash
sudo apt-get install -y software-properties-common
sudo add-apt-repository ppa:deadsnakes/ppa
sudo apt-get update
sudo apt-get install -y python3.11 python3.11-venv python3.11-dev
```

### Step 3: Install Node.js and Yarn

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g yarn
```

### Step 4: Install MongoDB

```bash
# Install dependencies
sudo apt-get install -y gnupg curl

# Import MongoDB 8.0 GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor

# Add repository (replace 'noble' with your Ubuntu codename: jammy=22.04, noble=24.04)
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list

# Install
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

### Step 5: Install Supervisor

```bash
sudo apt-get install -y supervisor
sudo systemctl enable supervisor
sudo systemctl start supervisor
```

### Step 6: Setup Backend

```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step 7: Setup Frontend

```bash
cd ../frontend
yarn install
```

---

## Configuration

### Backend Configuration

Edit `backend/.env`:

```bash
MONGO_URL="mongodb://localhost:27017"
DB_NAME="iptv_service"
JWT_SECRET="change-this-to-a-secure-random-string"
CORS_ORIGINS="*"
ACTIVATION_DOMAIN="http://your-server-ip:3000"
ENVIRONMENT="development"
PUBLIC_BASE_URL="http://your-server-ip:3000"
```

**Generate a secure JWT secret:**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Frontend Configuration

Edit `frontend/.env`:

```bash
REACT_APP_BACKEND_URL=http://your-server-ip:3000
WDS_SOCKET_PORT=443
```

---

## First-Time Setup

1. Navigate to `http://your-server-ip:3000`
2. Complete the setup wizard:
   - Step 1: System requirements check
   - Step 2: Service name configuration
   - Step 3: Admin account creation (enter email — a 10-character password is auto-generated, save it immediately)
   - Step 4: Bulk channel creation (25-100)
   - Step 5: Completion
3. Login at `/admin/login` with the email and generated password

---

## Features

### TV Guide (EPG)
- Live channel grid with 30-minute time slots
- Category-coded channels (Family, Action, Drama, Comedy, Kids, Music, etc.)
- Immediate fullscreen playback — no on-screen controls
- Arrow key channel surfing (remote-friendly)
- HLS stream support with auto-volume

### Admin Dashboard (16 tabs)
- Channel management with logo upload
- EPG program scheduling
- Media library with file upload and FFmpeg metadata
- VOD catalog with rich metadata linking
- Device management with QR codes
- User and customer account management
- Support tickets with admin reply
- Notifications, FAQ, Statistics, Analytics
- System health monitoring (CPU/RAM/Disk)
- Storage overview with per-folder breakdown
- Server backup/restore and scheduled auto-backup
- OTA update management for Android app
- Home feed announcements
- Branding and service configuration

### Security
- JWT authentication with email + auto-generated 10-char passwords
- All admin endpoints require Bearer token
- HMAC-signed media URLs to prevent hotlinking
- 2FA with Google Authenticator
- IP-based brute force lockout on device activation
- Password reset via CLI only (not exposed on web)

### Customer Portal
- Public registration page at `/register`
- Customer login at `/customer-login`
- Device activation with admin-generated credentials
- Support ticket submission

---

## API Documentation

Interactive docs: `http://your-server-ip:8001/docs`

### Key Endpoints
- `/api/auth/*` — Admin authentication (login, register, verify, 2FA)
- `/api/channels/*` — Channel management
- `/api/programs/*` — EPG program management
- `/api/vod/*` — Video on Demand
- `/api/devices/*` — Device management
- `/api/users/*` — User management
- `/api/customer/*` — Customer accounts and device activation
- `/api/media/*` — Media library
- `/api/catalog/*` — Media catalog (IMDB-like metadata)
- `/api/health/*` — System health and storage (admin-only)
- `/api/admin/*` — Backup, restore, auto-backups

---

## Troubleshooting

### Check Service Status
```bash
sudo supervisorctl status
```

### View Logs
```bash
# Backend errors
tail -f /var/log/supervisor/backend.err.log

# Backend output
tail -f /var/log/supervisor/backend.out.log

# Frontend
tail -f /var/log/supervisor/frontend.out.log
```

### Restart Services
```bash
sudo supervisorctl restart all
```

### Check MongoDB
```bash
sudo systemctl status mongod
```

---

## Admin CLI Tools

### Reset Admin Password
Run from your server terminal (SSH/Termius):

```bash
cd /path/to/streamvault/backend
source venv/bin/activate
python3 reset_password.py admin@streamvault.ca
```

This generates a new 10-character random password and prints it to the terminal. No web access required.

---

## Production Deployment

### 1. Secure JWT Secret
```bash
# Generate and set in backend/.env
JWT_SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
```

### 2. Configure CORS
```bash
# In backend/.env, restrict to your domain
CORS_ORIGINS="https://yourdomain.com"
```

### 3. Setup Nginx Proxy Manager
See `NginxProxyManagerGuide.md` for full proxy host configuration, SSL setup, and security headers.

### 4. Deployment Checklist
See `DeploymentChecklist.md` for the step-by-step multi-server deployment guide.

### 5. Enable MongoDB Authentication
```bash
mongosh
use admin
db.createUser({user: "svadmin", pwd: "your-strong-password", roles: ["root"]})
```

Then update `backend/.env`:
```bash
MONGO_URL="mongodb://svadmin:your-strong-password@localhost:27017"
```

### 6. Automated Backups
StreamVault includes built-in auto-backup via the admin dashboard (Settings tab). Runs nightly at 03:00 UTC, keeps last 7 backups.

Manual backup:
```bash
mongodump --db iptv_service --out /backup/$(date +%Y%m%d)
```

---

## Documentation Files

| File | Description |
|------|-------------|
| `README.md` | This file — installation and setup |
| `NginxProxyManagerGuide.md` | Nginx Proxy Manager configuration |
| `DeploymentChecklist.md` | Multi-server deployment steps |
| `StorageSetup.md` | TrueNAS NFS shared storage setup |
| `Full-Release-Features.md` | Features planned for full release |
| `DEVICE_AUTHENTICATION.md` | Device auth flow documentation |
| `android/README.md` | Android WebView app source code |
| `android/Android-Admin-App.md` | Android admin tablet app source |

---

## Quick Reference

| Component | URL | Access |
|-----------|-----|--------|
| TV Guide | http://your-server-ip:3000 | Public |
| Admin Login | http://your-server-ip:3000/admin/login | Email + Password |
| Customer Registration | http://your-server-ip:3000/register | Public |
| Customer Login | http://your-server-ip:3000/customer-login | Email + Password |
| API Docs | http://your-server-ip:8001/docs | Public |
| Support Portal | http://your-server-ip:3000/portal | Public |
