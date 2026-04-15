# TV Service System - Complete Installation Guide

A comprehensive TV service management platform with IPTV functionality, EPG guide, device activation, user management, and geo-location validation.

## 📋 Table of Contents

- [System Requirements](#system-requirements)
- [Quick Start](#quick-start)
- [Detailed Installation](#detailed-installation)
- [Configuration](#configuration)
- [First-Time Setup](#first-time-setup)
- [Features](#features)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)
- [Production Deployment](#production-deployment)

---

## 🖥️ System Requirements

### Minimum Requirements
- **OS**: Ubuntu 20.04+ / Debian 11+ / macOS 12+ / Windows 10+ (with WSL2)
- **CPU**: 2 cores
- **RAM**: 4GB
- **Disk**: 10GB free space
- **Network**: Stable internet connection

### Required Software
- **Python**: 3.11 or higher
- **Node.js**: 18.x or higher
- **Yarn**: 1.22.x or higher
- **MongoDB**: 5.0 or higher
- **Supervisor**: For process management (Linux/macOS)

### Optional
- **SSL Certificate**: For HTTPS (Let's Encrypt recommended)
- **Reverse Proxy**: Nginx or Apache (for production)

---

## 🚀 Quick Start

### For Development (Linux/macOS)

```bash
# Clone or navigate to project directory
cd /path/to/app

# 1. Install System Dependencies
sudo apt-get update
sudo apt-get install -y python3.11 python3.11-venv python3-pip nodejs npm mongodb supervisor

# Install Yarn
sudo npm install -g yarn

# 2. Setup Backend
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. Setup Frontend
cd ../frontend
yarn install

# 4. Start MongoDB
sudo systemctl start mongodb
sudo systemctl enable mongodb

# 5. Configure Environment
cd ../backend
cp .env.example .env
# Edit .env with your settings

# 6. Start Services
sudo supervisorctl reload
sudo supervisorctl start all

# 7. Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8001
# API Docs: http://localhost:8001/docs
```

---

## 📦 Detailed Installation

### Step 1: Install Python 3.11+

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install -y software-properties-common
sudo add-apt-repository ppa:deadsnakes/ppa
sudo apt-get update
sudo apt-get install -y python3.11 python3.11-venv python3.11-dev
```

#### macOS
```bash
brew install python@3.11
```

### Step 2: Install Node.js and Yarn

#### Ubuntu/Debian
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g yarn
```

#### macOS
```bash
brew install node@18
brew install yarn
```

### Step 3: Install MongoDB

#### Ubuntu/Debian
```bash
# Install dependencies
sudo apt-get install -y gnupg curl

# Import MongoDB 8.0 GPG key (modern method — apt-key is deprecated)
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor

# Add repository (replace 'noble' with your Ubuntu codename: jammy=22.04, noble=24.04)
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list

# Install
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

### Step 4: Install Supervisor

#### Ubuntu/Debian
```bash
sudo apt-get install -y supervisor
sudo systemctl enable supervisor
sudo systemctl start supervisor
```

#### macOS
```bash
brew install supervisor
brew services start supervisor
```

---

## ⚙️ Configuration

### Backend Configuration

Edit `/app/backend/.env`:

```bash
MONGO_URL="mongodb://localhost:27017"
DB_NAME="tv_service"
JWT_SECRET="change-this-to-secure-random-string"
CORS_ORIGINS="*"
ACTIVATION_DOMAIN="http://localhost:3000"
```

**Generate Secure JWT Secret:**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## 🎯 First-Time Setup

1. Navigate to `http://localhost:3000`
2. Complete 5-step setup wizard:
   - Step 1: System requirements check
   - Step 2: Service name configuration
   - Step 3: Admin account creation
   - Step 4: Bulk channel creation (25-100)
   - Step 5: Completion
3. Login at `/admin/login` with your credentials

---

## ✨ Features

### Admin Dashboard
- Channel management with logo upload
- EPG program scheduling (7-day, 30-min intervals)
- Device management with QR codes
- User account management
- Device QR refresh/reset
- Statistics overview
- 2FA with Google Authenticator

### Device Management
- Auto-generate activation QR codes
- **Refresh QR**: Regenerate QR (same code)
- **Reset Code**: New code + QR
- Canada geo-location validation
- IP tracking and history
- MAC address binding

### Security
- JWT authentication
- 2FA support
- Security question password reset
- Session management

---

## 📡 API Documentation

Interactive docs: `http://localhost:8001/docs`

### Key Endpoints
- `/api/setup/*` - Setup wizard
- `/api/auth/*` - Authentication & 2FA
- `/api/channels/*` - Channel management
- `/api/programs/*` - EPG management
- `/api/devices/*` - Device & QR management
- `/api/users/*` - User management

---

## 🔧 Troubleshooting

### Check Service Status
```bash
sudo supervisorctl status
```

### View Logs
```bash
# Backend
tail -f /var/log/supervisor/backend.err.log

# Frontend
tail -f /var/log/supervisor/frontend.out.log
```

### Restart Services
```bash
sudo supervisorctl restart all
```

### Reset to Default Admin
```bash
mongosh tv_service --eval "db.admins.deleteMany({})"
sudo supervisorctl restart backend
# Login: admin / admin123
```

---

## 🚀 Production Deployment

### 1. Update Security Settings
```bash
# Change JWT secret
JWT_SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"

# Configure CORS
CORS_ORIGINS="https://yourdomain.com"
```

### 2. Setup SSL with Let's Encrypt
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### 3. Configure Nginx
See detailed Nginx configuration in full documentation.

### 4. Enable MongoDB Authentication
```bash
mongosh
use admin
db.createUser({user:"admin", pwd:"strongpass", roles:["root"]})
```

### 5. Setup Automated Backups
```bash
# MongoDB backup script
mongodump --db tv_service --out /backup/$(date +%Y%m%d)

# Schedule with cron
0 2 * * * /opt/backup_mongodb.sh
```

---

## 📞 Support & Documentation

### Files
- Implementation Status: `/app/IMPLEMENTATION_STATUS.md`
- Device Auth: `/app/DEVICE_AUTHENTICATION.md`
- Future Features: `/app/FUTURE_DEVELOPMENT.md`

### Common Commands
```bash
# Restart all
sudo supervisorctl restart all

# View status
sudo supervisorctl status

# Check MongoDB
sudo systemctl status mongod
```

---

## 🎉 Quick Reference

| Component | URL | Default Login |
|-----------|-----|---------------|
| Frontend | http://localhost:3000 | N/A |
| Admin | http://localhost:3000/admin/login | admin / admin123 |
| API | http://localhost:8001 | N/A |
| Docs | http://localhost:8001/docs | N/A |

**⚠️ Change default credentials after first login!**
