# StreamVault — Nginx Proxy Manager Setup Guide

This guide covers the complete Nginx Proxy Manager (NPM) configuration for
StreamVault. NPM handles HTTPS termination, domain routing, and SSL certificates
(via Let's Encrypt). It runs on a separate machine or alongside the app.

---

## Architecture Overview

```
Internet
    │
    ▼
[Router] — port 80/443 forwarded to NPM machine
    │
    ▼
[NPM Machine]  192.168.2.50
    │
    ├── api.streamvault.ca        →  Node A/B :8001  (StreamVault Backend)
    ├── streamvault.ca            →  Node A/B :3000  (Frontend — Admin + TV Guide)
    ├── portainer.streamvault.ca  → Any Node :9000  (Docker Manager)
    └── lb.streamvault.ca         →  NPM itself      (NPM Admin UI — local only)
```

> With the load balancer in place, NPM points to the HAProxy VIP, and HAProxy
> distributes across Node A and Node B. During testing with a single node, point
> directly to that node's IP.

---

## 1. Install Nginx Proxy Manager

Run on a dedicated machine or the same machine as StreamVault:

```bash
mkdir ~/npm && cd ~/npm

cat > docker-compose.yml << 'EOF'
services:
  npm:
    image: jc21/nginx-proxy-manager:latest
    container_name: nginx_proxy_manager
    restart: unless-stopped
    ports:
      - "80:80"       # HTTP (auto-redirected to HTTPS)
      - "443:443"     # HTTPS
      - "81:81"       # NPM Admin UI (local only — do NOT forward externally)
    volumes:
      - npm_data:/data
      - npm_letsencrypt:/etc/letsencrypt

volumes:
  npm_data:
  npm_letsencrypt:
EOF

docker compose up -d
```

**NPM Admin UI:** http://YOUR_NPM_IP:81
Default login: `admin@example.com` / `changeme`
Change these immediately on first login.

---

## 2. Router Port Forwarding

In your router (e.g. Bell Home Hub), forward:

| External Port | Internal IP      | Internal Port | Purpose          |
|---------------|------------------|---------------|-----------------|
| 80            | 192.168.2.50     | 80            | HTTP (ACME/redirect) |
| 443           | 192.168.2.50     | 443           | HTTPS            |

> Port 81 (NPM Admin UI) should NOT be forwarded externally.

---

## 3. Proxy Hosts

### 3a. StreamVault Backend API

| Field | Value |
|-------|-------|
| Domain | `api.streamvault.ca` |
| Scheme | `http` |
| Forward Hostname / IP | `192.168.2.101` (Node A) or HAProxy VIP |
| Forward Port | `8001` |
| Block Common Exploits | ✓ |
| Websockets Support | ✓ |

**SSL tab:**
- SSL Certificate: Request new → Let's Encrypt
- Force HTTPS: ✓
- HTTP/2 Support: ✓
- HSTS Enabled: ✓

**Advanced tab — Custom Nginx Config:**
```nginx
# Increase body size for media file uploads
client_max_body_size 10G;
client_body_timeout 600s;
proxy_read_timeout 600s;
proxy_send_timeout 600s;
proxy_connect_timeout 75s;

# WebSocket passthrough
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";

# Pass real client IP to FastAPI
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

---

### 3b. StreamVault Frontend (Admin + TV Guide)

| Field | Value |
|-------|-------|
| Domain | `streamvault.ca` |
| Scheme | `http` |
| Forward Hostname / IP | `192.168.2.101` (Node A) or HAProxy VIP |
| Forward Port | `3000` |
| Block Common Exploits | ✓ |
| Websockets Support | ✓ |

**SSL tab:** Same as API (Let's Encrypt, Force HTTPS, HSTS).

**Advanced tab — Custom Nginx Config:**
```nginx
# React Router support — serve index.html for all non-file paths
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;

# Cache static assets aggressively, never cache HTML
location ~* \.(js|css|png|jpg|jpeg|ico|svg|woff2|ttf)$ {
    proxy_pass http://192.168.2.101:3000;
    proxy_cache_bypass $http_upgrade;
    add_header Cache-Control "public, max-age=31536000, immutable";
}
```

---

### 3c. Portainer Docker Manager

| Field | Value |
|-------|-------|
| Domain | `portainer.streamvault.ca` |
| Scheme | `http` |
| Forward Hostname / IP | `192.168.2.101` (whichever node runs Portainer) |
| Forward Port | `9000` |
| Block Common Exploits | ✓ |
| Websockets Support | ✓ |

**SSL tab:** Let's Encrypt, Force HTTPS, HSTS.

> **Security:** Add an Access List in NPM to restrict this to your IP address only.
> Portainer should never be publicly accessible.

**Advanced tab — IP Allowlist (replace with your home IP):**
```nginx
allow YOUR.HOME.IP.ADDRESS;
deny all;
```

---

### 3d. NPM Admin UI (Optional — local access only)

Do not create a proxy host for port 81. Access it directly on your LAN:
`http://192.168.2.50:81`

---

## 4. Update StreamVault .env After NPM Setup

Once NPM is live with HTTPS, update your `.env` on each application node:

```env
# Public-facing URLs (used by the React frontend build)
REACT_APP_BACKEND_URL=https://api.streamvault.ca

# CORS — allow the frontend domain to call the API
CORS_ORIGINS=https://streamvault.ca,https://api.streamvault.ca

# Force HTTPS in FastAPI responses
HTTPS_REDIRECT=true
```

Then rebuild and restart:
```bash
docker compose down
docker compose -f docker-compose.yml -f docker-compose.storage.yml up -d --build
```

Also update the Android app's `MainActivity.java`:
```java
private static final String BASE_URL  = "https://api.streamvault.ca";
private static final String GUIDE_URL = "https://streamvault.ca";
```

And change `usesCleartextTraffic="false"` in `AndroidManifest.xml` once HTTPS is live.

---

## 5. SSL Certificate Auto-Renewal

Let's Encrypt certificates expire every 90 days. NPM renews them automatically.

Verify renewal is working:
```bash
# Check certificate expiry dates
docker exec nginx_proxy_manager cat /etc/letsencrypt/renewal-hooks/deploy/10-nginx-reload.sh
```

---

## 6. Security Headers (Optional — Advanced)

For extra hardening, add these to each proxy host's Advanced config:

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

---

## 7. Quick Reference — All Services

| Service | Local Access | External (via NPM) |
|---------|-------------|-------------------|
| Backend API | http://192.168.2.101:8001 | https://api.streamvault.ca |
| Frontend | http://192.168.2.101:3000 | https://streamvault.ca |
| Portainer | http://192.168.2.101:9000 | https://portainer.streamvault.ca (IP restricted) |
| NPM Admin | http://192.168.2.50:81 | Do NOT expose externally |
| Load Balancer | http://192.168.2.50:80 | via NPM (handles routing) |

---

## 8. Troubleshooting

### 502 Bad Gateway
- Verify the StreamVault container is running: `docker ps`
- Verify port 8001/3000 is listening: `ss -tlnp | grep 8001`
- Check container logs: `docker logs streamvault_backend`

### SSL Certificate Not Issuing
- Ensure port 80 is forwarded from your router to the NPM machine
- Temporarily disable any firewall on port 80
- Check NPM logs: `docker logs nginx_proxy_manager`

### File Uploads Failing (413 Request Entity Too Large)
- Add `client_max_body_size 10G;` to the API proxy host's Advanced config (already included above)

### WebSocket Disconnecting
- Add `proxy_read_timeout 3600s;` to the proxy host config
