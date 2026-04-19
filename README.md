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
- **Node.js**: 20.x or higher
- **Yarn**: 1.22.x or higher
- **MongoDB**: 8.0
- **git**: For downloading the code
- **Supervisor**: For process management

---

## Quick Start

```bash
# 1. Download the repository (no credentials required)
cd /home/streamvault
git clone https://github.com/OfficialMikeJ/Bell-Fibe-Clone.git streamvault
cd streamvault

# 4. Install system dependencies
sudo apt-get update
sudo apt-get install -y python3.11 python3.11-venv python3-pip supervisor git

# 5. Install Node.js 20 (includes npm — do NOT install npm separately)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
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
#    The .env files come pre-populated. Edit them to replace 'localhost' with your server IP.

# Backend .env — contains:
#   MONGO_URL="mongodb://localhost:27017"
#   DB_NAME="iptv_service"
#   CORS_ORIGINS="*"
#   JWT_SECRET="iptv-secret-key-change-in-production-2025"
#   ACTIVATION_DOMAIN="http://localhost:3000"
#   ENVIRONMENT="development"
#   PUBLIC_BASE_URL="http://localhost:3000"
cd ../backend
nano .env
# Replace 'localhost' in PUBLIC_BASE_URL and ACTIVATION_DOMAIN with your server IP
# Replace JWT_SECRET with a secure random string:
#   python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Frontend .env — contains:
#   REACT_APP_BACKEND_URL=http://localhost:3000
#   WDS_SOCKET_PORT=443
cd ../frontend
nano .env
# Replace 'localhost' in REACT_APP_BACKEND_URL with your server IP
# Example: REACT_APP_BACKEND_URL=http://192.168.1.100:3000

# 9. Setup Supervisor to run backend and frontend
cd /home/streamvault/streamvault
sudo cp streamvault-supervisor.conf /etc/supervisor/conf.d/streamvault.conf

# IMPORTANT: Edit the config to match YOUR install path
sudo nano /etc/supervisor/conf.d/streamvault.conf
# Update the two 'directory=' lines to match where you cloned:
#   directory=/home/streamvault/streamvault/backend
#   directory=/home/streamvault/streamvault/frontend
# Update the backend command to your Python path:
#   With venv:    command=/home/streamvault/streamvault/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --workers 1 --reload
#   Without venv: command=uvicorn server:app --host 0.0.0.0 --port 8001 --workers 1 --reload

# Create log directory
sudo mkdir -p /var/log/supervisor

# Load and start services
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start all

# Verify both are running
sudo supervisorctl status

# 10. Open firewall ports (if UFW is enabled)
sudo ufw allow 3000/tcp    # Frontend
sudo ufw allow 8001/tcp    # Backend API
# For production with Nginx Proxy Manager, also open:
# sudo ufw allow 80/tcp
# sudo ufw allow 443/tcp

# 11. Access the application
# Frontend:  http://your-server-ip:3000
# Admin:     http://your-server-ip:3000/admin/login
# API Docs:  http://your-server-ip:8001/docs
```

---

## Detailed Installation

### Step 1: Download the Repository

```bash
sudo apt-get update
sudo apt-get install -y git

cd /home/streamvault
git clone https://github.com/OfficialMikeJ/Bell-Fibe-Clone.git streamvault
cd streamvault
```

> **No username or password required.** The repo is public.

**Pulling future updates:**
```bash
cd /home/streamvault/streamvault
git pull
```

### Step 2: Install Python 3.11+

```bash
sudo apt-get install -y software-properties-common
sudo add-apt-repository ppa:deadsnakes/ppa
sudo apt-get update
sudo apt-get install -y python3.11 python3.11-venv python3.11-dev
```

### Step 3: Install Node.js and Yarn

NodeSource's `nodejs` package already includes `npm`. Do **not** install `npm` separately — it will conflict.

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g yarn
```

Verify:
```bash
node -v   # should show v20.x
npm -v    # should show 10.x
yarn -v   # should show 1.22.x
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

### Step 8: Configure Supervisor (Process Manager)

Supervisor keeps the backend and frontend running and auto-restarts them if they crash.

```bash
# Copy the included config file
sudo cp /home/streamvault/streamvault/streamvault-supervisor.conf /etc/supervisor/conf.d/streamvault.conf
```

The config file is pre-set to use `/home/streamvault/streamvault/` paths. If you cloned to a different location, edit the paths:
```bash
sudo nano /etc/supervisor/conf.d/streamvault.conf
```
Update the `directory=` and `command=` lines to match your install path.

Then load and start the services:
```bash
# Create log directory
sudo mkdir -p /var/log/supervisor

# Tell Supervisor to pick up the new config
sudo supervisorctl reread
sudo supervisorctl update

# Start both services
sudo supervisorctl start all

# Verify both are running
sudo supervisorctl status
```

You should see:
```
backend     RUNNING   pid 12345, uptime 0:00:05
frontend    RUNNING   pid 12346, uptime 0:00:04
```

If a service shows `FATAL` or `STOPPED`, check the logs:
```bash
tail -50 /var/log/supervisor/backend.err.log
tail -50 /var/log/supervisor/frontend.err.log
```

### Step 9: Open Firewall Ports (if UFW is enabled)

If your server has UFW firewall active, open the required ports:

```bash
# Check if UFW is active
sudo ufw status

# Open frontend and backend ports
sudo ufw allow 3000/tcp    # Frontend (TV Guide)
sudo ufw allow 8001/tcp    # Backend API

# For production with Nginx Proxy Manager or reverse proxy:
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS

# Verify open ports
sudo ufw status numbered
```

**Do NOT expose MongoDB externally.** It listens on `localhost:27017` by default and should stay that way. No UFW rule needed for MongoDB.

---

## Configuration

The `.env` files come pre-populated with working localhost defaults. After cloning, you only need to update the IP/domain to match your server.

### Backend Configuration

```bash
nano backend/.env
```

The file is already populated with:
```bash
MONGO_URL="mongodb://localhost:27017"
DB_NAME="iptv_service"
CORS_ORIGINS="*"
JWT_SECRET="iptv-secret-key-change-in-production-2025"
ACTIVATION_DOMAIN="http://localhost:3000"
ENVIRONMENT="development"
PUBLIC_BASE_URL="http://localhost:3000"
```

**What to change:**
- `JWT_SECRET` — Replace with a secure random string (required for production)
- `PUBLIC_BASE_URL` — Replace `localhost` with your server IP or domain
- `ACTIVATION_DOMAIN` — Same as PUBLIC_BASE_URL

**Generate a secure JWT secret:**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Frontend Configuration

```bash
nano frontend/.env
```

The file is already populated with:
```bash
REACT_APP_BACKEND_URL=http://localhost:3000
WDS_SOCKET_PORT=443
```

**What to change:**
- `REACT_APP_BACKEND_URL` — Replace `localhost` with your server IP or domain (e.g. `http://192.168.1.100:3000` or `https://streamvault.ca`)

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

If this shows nothing, Supervisor hasn't loaded the StreamVault config yet:
```bash
# Make sure the config file is in place
ls /etc/supervisor/conf.d/streamvault.conf

# If missing, copy it from the repo
sudo cp /home/streamvault/streamvault/streamvault-supervisor.conf /etc/supervisor/conf.d/streamvault.conf

# Reload and start
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start all
```

### Services Show FATAL or Won't Start

Check the error logs:
```bash
tail -50 /var/log/supervisor/backend.err.log
tail -50 /var/log/supervisor/frontend.err.log
```

Common causes:
- **Backend**: Python venv path wrong in supervisor config — update the `command` line
- **Backend**: Missing Python packages — run `cd backend && source venv/bin/activate && pip install -r requirements.txt`
- **Frontend**: Missing node_modules — run `cd frontend && yarn install`
- **Frontend**: Node version too old — need Node 20+ (see Node.js troubleshooting below)

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

### Node.js Version Too Old (yarn install fails)
If you see an error like:
```
error react-router-dom@7.x: The engine "node" is incompatible with this module. Expected version ">=20.0.0". Got "18.x.x"
```
You need Node.js 20 or higher. Upgrade:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # confirm v20.x
cd /home/streamvault/streamvault/frontend && yarn install
```

### npm Conflicts with NodeSource nodejs
If you see broken dependency errors when installing `npm`:
```
nodejs : Conflicts: npm
npm : Depends: node-agent-base but it is not going to be installed
```
**Do not install `npm` separately.** NodeSource's `nodejs` package already includes `npm`. Just install `nodejs` and skip `npm`:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Git Clone Permission Denied / Asks for Credentials
Skip git entirely. Download as a zip instead:
```bash
cd /home/streamvault
curl -L -o repo.zip https://github.com/OfficialMikeJ/Bell-Fibe-Clone/archive/refs/heads/main.zip
unzip repo.zip
mv Bell-Fibe-Clone-main streamvault
rm repo.zip
```

---

## Admin CLI Tools

### Reset Admin Password
Run from your server terminal (SSH/Termius):

```bash
cd /home/streamvault/streamvault/backend
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
