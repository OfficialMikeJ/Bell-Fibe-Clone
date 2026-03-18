# StreamVault — Port Configuration Guide

This document covers every port used by StreamVault and tells you exactly which ones to open on your firewall/router, which protocol they use, and whether they should be public or internal-only.

---

## Quick Reference Table

| Port  | Protocol | Direction      | Service                        | Open on Firewall? |
|-------|----------|----------------|--------------------------------|-------------------|
| 443   | TCP      | Public inbound | HTTPS — main access (via NPM)  | YES               |
| 80    | TCP      | Public inbound | HTTP → redirects to 443 (NPM) | YES               |
| 81    | TCP      | Restricted     | Nginx Proxy Manager Admin UI   | RESTRICTED *      |
| 3000  | TCP      | Internal only  | React Frontend                 | NO (proxied)      |
| 8001  | TCP      | Internal only  | FastAPI Backend API            | NO (proxied)      |
| 27017 | TCP      | Internal only  | MongoDB                        | NEVER             |
| 554   | TCP/UDP  | Optional       | RTSP stream input (TV tuner)   | Only if needed    |
| 1935  | TCP      | Optional       | RTMP stream input              | Only if needed    |

> * Port 81 (NPM Admin) should be restricted to your own IP address only, not open to the public internet.

---

## Detailed Breakdown

### Port 443 — HTTPS (TCP)
- **What it is:** The main entry point for all users. Nginx Proxy Manager handles SSL/TLS termination here and forwards traffic to the correct internal service.
- **Protocol:** TCP only
- **Open on router/firewall:** YES — this is the only port your users ever touch
- **Handles traffic to:**
  - `streamvault.yourdomain.com` → forwards to frontend on port 3000
  - `api.streamvault.yourdomain.com` (or `/api/` path) → forwards to backend on port 8001

---

### Port 80 — HTTP (TCP)
- **What it is:** Standard HTTP. Nginx Proxy Manager catches this and auto-redirects all traffic to HTTPS (port 443). Required for Let's Encrypt certificate renewal (ACME HTTP-01 challenge).
- **Protocol:** TCP only
- **Open on router/firewall:** YES
- **Note:** No actual app traffic flows over port 80 in normal use — it exists only to redirect and for SSL cert renewal.

---

### Port 81 — NPM Admin UI (TCP)
- **What it is:** The Nginx Proxy Manager web-based admin dashboard. Used by you to create proxy hosts, set up SSL certificates, and manage routing.
- **Protocol:** TCP only
- **Open on router/firewall:** RESTRICTED — whitelist your own IP only. Do NOT open this to the public internet.
- **Tip:** After initial setup, you can block this port at the firewall level and only open it temporarily when you need to make changes.

---

### Port 3000 — React Frontend (TCP)
- **What it is:** The StreamVault customer-facing guide app (React). Runs inside Docker.
- **Protocol:** TCP only
- **Open on router/firewall:** NO — Nginx Proxy Manager forwards to this port internally over the Docker network. End users never connect to port 3000 directly.
- **Access pattern:** Internet → NPM (443) → Docker network → Frontend (3000)

---

### Port 8001 — FastAPI Backend (TCP)
- **What it is:** The StreamVault REST API. Handles all data, authentication, media serving, EPG, VOD, admin, and file uploads.
- **Protocol:** TCP only
- **Open on router/firewall:** NO — Nginx Proxy Manager forwards `/api/` requests to this port internally. End users never connect to port 8001 directly.
- **Access pattern:** Internet → NPM (443) → Docker network → Backend (8001)

---

### Port 27017 — MongoDB (TCP)
- **What it is:** The database engine used to store all StreamVault data (channels, programs, users, devices, etc.).
- **Protocol:** TCP only
- **Open on router/firewall:** NEVER — this port must remain completely closed and internal. It is only accessed by the FastAPI backend within the Docker network.
- **Security note:** Exposing MongoDB to the internet is a critical security risk regardless of whether a password is set.

---

### Port 554 — RTSP (TCP + UDP) *(Optional — future use)*
- **What it is:** Real-Time Streaming Protocol. Used if you connect a TV tuner or RTSP source (e.g., a network camera, HDHomeRun tuner, or Wowza server) directly to the StreamVault backend.
- **Protocol:** TCP AND UDP (RTSP uses TCP for control; RTP/RTCP use UDP for the actual media data)
- **Open on router/firewall:** Only if you are pulling RTSP streams from a device outside your local network. If your tuner is on the same LAN as your server, this port does not need to be open externally.

---

### Port 1935 — RTMP (TCP) *(Optional — future use)*
- **What it is:** Real-Time Messaging Protocol. Used for pushing a live stream *into* StreamVault from an encoder (e.g., OBS Studio, hardware encoder).
- **Protocol:** TCP only
- **Open on router/firewall:** Only if you plan to broadcast live content into StreamVault from an external location.

---

## Your NPM Proxy Host Setup (Summary)

When setting up Nginx Proxy Manager, create these two proxy hosts:

| Domain / Subdomain                  | Scheme | Forward Hostname | Forward Port | SSL            |
|-------------------------------------|--------|------------------|--------------|----------------|
| `streamvault.yourdomain.com`        | http   | `frontend`       | `3000`       | Let's Encrypt  |
| `api.streamvault.yourdomain.com`    | http   | `backend`        | `8001`       | Let's Encrypt  |

> Alternatively, use a single domain with path-based routing:
> - `streamvault.yourdomain.com/` → frontend:3000
> - `streamvault.yourdomain.com/api/` → backend:8001

---

## On Encrypted Media Delivery

Since Nginx Proxy Manager terminates SSL on port 443, **all media files (HLS streams, VOD files, posters, logos) are served to users over an encrypted HTTPS connection** automatically — no extra configuration needed. The encryption happens at the NPM layer before data leaves your server.

The internal path (NPM → backend:8001 → disk) is unencrypted, but this traffic never leaves your server, so it is safe.

---

## Firewall Rule Summary (Linux `ufw` example)

```bash
# Allow public web traffic
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow NPM admin — replace YOUR_IP with your actual IP
sudo ufw allow from YOUR_IP to any port 81 proto tcp

# Block everything else by default
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw enable
```

---

*Last updated: March 2026*
