# Custom Domain & HTTPS Setup Guide

## Overview
The TV Service system supports custom domains with **HTTPS-only** enforcement for production environments.

## Architecture

### Domain Structure
```
Main Domain: yourdomain.com
├── Admin Dashboard: admin.yourdomain.com
├── TV Guide (Public): guide.yourdomain.com
└── Backend API: api.yourdomain.com (or yourdomain.com/api)
```

### Service Separation
- **Admin Dashboard** (`/app/frontend`) - Port 3000
- **TV Guide** (`/app/guide-app`) - Port 3001 (to be implemented)
- **Backend API** (`/app/backend`) - Port 8001

## Prerequisites

1. **Domain Name**: Registered domain (e.g., yourdomain.com)
2. **DNS Access**: Ability to create A/CNAME records
3. **Server**: Public IP address
4. **SSL Certificate**: Let's Encrypt (free) or commercial cert

## Step 1: DNS Configuration

### Create DNS Records

```dns
Type    Name     Value              TTL
A       @        YOUR_SERVER_IP     300
A       admin    YOUR_SERVER_IP     300
A       guide    YOUR_SERVER_IP     300
A       api      YOUR_SERVER_IP     300
```

Or using CNAME (if using CDN):
```dns
Type    Name     Value                      TTL
CNAME   admin    your-load-balancer.com     300
CNAME   guide    your-load-balancer.com     300
```

### Verify DNS Propagation
```bash
dig admin.yourdomain.com
dig guide.yourdomain.com

# Or
nslookup admin.yourdomain.com
```

## Step 2: SSL Certificate Setup (HTTPS Only)

### Option A: Let's Encrypt (Recommended - Free)

#### Install Certbot
```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
```

#### Obtain Certificates
```bash
# For all subdomains at once
sudo certbot certonly --nginx \
  -d yourdomain.com \
  -d admin.yourdomain.com \
  -d guide.yourdomain.com \
  -d api.yourdomain.com

# Certificates will be saved to:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

#### Auto-Renewal
```bash
# Test renewal
sudo certbot renew --dry-run

# Set up automatic renewal (already configured by default)
sudo systemctl status certbot.timer
```

### Option B: Commercial SSL Certificate

1. Purchase certificate from CA (DigiCert, Comodo, etc.)
2. Generate CSR:
```bash
openssl req -new -newkey rsa:2048 -nodes \
  -keyout yourdomain.com.key \
  -out yourdomain.com.csr
```
3. Submit CSR to CA
4. Download certificate files
5. Install on server

## Step 3: Nginx Configuration

### Install Nginx
```bash
sudo apt-get install -y nginx
```

### Create Configuration File

Create `/etc/nginx/sites-available/tv-service`:

```nginx
# HTTP to HTTPS Redirect (Required)
server {
    listen 80;
    server_name yourdomain.com admin.yourdomain.com guide.yourdomain.com api.yourdomain.com;
    
    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

# Admin Dashboard (HTTPS Only)
server {
    listen 443 ssl http2;
    server_name admin.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS (Enforce HTTPS)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    
    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend (Admin Dashboard)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# TV Guide (HTTPS Only) - For Android App
server {
    listen 443 ssl http2;
    server_name guide.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Guide App (Port 3001 - to be implemented)
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Backend API (HTTPS Only)
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Backend API
    location / {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers (if needed)
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
    }
    
    # File Uploads
    location /uploads/ {
        proxy_pass http://localhost:8001;
        client_max_body_size 50M;
    }
}
```

### Enable Configuration
```bash
sudo ln -s /etc/nginx/sites-available/tv-service /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 4: Update Application Configuration

### Backend Configuration

Edit `/app/backend/.env`:
```bash
# Set to production
ENVIRONMENT="production"

# Custom Domains
CUSTOM_DOMAIN="yourdomain.com"
GUIDE_DOMAIN="guide.yourdomain.com"
ADMIN_DOMAIN="admin.yourdomain.com"

# SSL Configuration
SSL_CERT_PATH="/etc/letsencrypt/live/yourdomain.com/fullchain.pem"
SSL_KEY_PATH="/etc/letsencrypt/live/yourdomain.com/privkey.pem"

# CORS - Update for specific domains
CORS_ORIGINS="https://admin.yourdomain.com,https://guide.yourdomain.com"

# Activation Domain (HTTPS)
ACTIVATION_DOMAIN="https://guide.yourdomain.com"
```

### Restart Services
```bash
sudo supervisorctl restart all
```

## Step 5: Firewall Configuration

### Open Required Ports
```bash
# HTTP (for redirect to HTTPS)
sudo ufw allow 80/tcp

# HTTPS
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
sudo ufw status
```

## Step 6: Verification

### Test HTTPS Enforcement
```bash
# Should redirect to HTTPS
curl -I http://admin.yourdomain.com

# Should return 200 OK
curl -I https://admin.yourdomain.com

# Check SSL certificate
openssl s_client -connect admin.yourdomain.com:443 -servername admin.yourdomain.com
```

### Test Security Headers
```bash
curl -I https://admin.yourdomain.com

# Should see:
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
```

### Browser Test
1. Visit `http://admin.yourdomain.com` - Should redirect to HTTPS
2. Visit `https://admin.yourdomain.com` - Should load admin dashboard
3. Check for green padlock in browser
4. Verify certificate details

## Step 7: Android App Configuration

### Update WebView URL
Edit `/app/android/app/src/main/java/MainActivity.java`:
```java
private static final String GUIDE_URL = "https://guide.yourdomain.com";
```

### Rebuild APK
```bash
cd /app/android
./gradlew clean assembleRelease
```

## Security Checklist

- [ ] All HTTP traffic redirects to HTTPS
- [ ] SSL certificate valid and not expired
- [ ] HSTS header present
- [ ] Security headers configured
- [ ] CORS properly configured
- [ ] Firewall rules in place
- [ ] SSL certificate auto-renewal working
- [ ] Backend ENVIRONMENT set to "production"
- [ ] Default admin credentials changed
- [ ] MongoDB authentication enabled
- [ ] JWT secret changed from default

## Monitoring

### SSL Certificate Expiry
```bash
# Check certificate expiry
echo | openssl s_client -servername admin.yourdomain.com -connect admin.yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates
```

### Auto-Renewal Logs
```bash
sudo journalctl -u certbot.timer
```

### Nginx Logs
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Troubleshooting

### SSL Certificate Issues
```bash
# Test certificate renewal
sudo certbot renew --dry-run

# Force renewal
sudo certbot renew --force-renewal

# Check certificate files
ls -la /etc/letsencrypt/live/yourdomain.com/
```

### HTTPS Not Working
```bash
# Check Nginx configuration
sudo nginx -t

# Check Nginx status
sudo systemctl status nginx

# Check port 443
sudo netstat -tlnp | grep :443

# Check firewall
sudo ufw status
```

### Mixed Content Warnings
- Ensure all assets (images, CSS, JS) are loaded via HTTPS
- Update REACT_APP_BACKEND_URL to use HTTPS
- Check browser console for mixed content errors

## Performance Optimization

### Enable HTTP/2
Already enabled in Nginx config with `http2` directive

### Enable Gzip Compression
Add to Nginx config:
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
```

### Enable Caching
```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

## Production Deployment Checklist

Before going live:

1. **DNS**: All records pointing to server
2. **SSL**: Certificate obtained and installed
3. **HTTPS**: All services accessible via HTTPS only
4. **Security**: All headers configured
5. **Firewall**: Only ports 80, 443 open
6. **Credentials**: All defaults changed
7. **Database**: Authentication enabled
8. **Backups**: Automated backups configured
9. **Monitoring**: Logs and alerts set up
10. **Testing**: All features tested on HTTPS

---

**Status**: HTTPS-only enforcement ready, custom domain support implemented, awaiting guide-app separation for Android deployment.
