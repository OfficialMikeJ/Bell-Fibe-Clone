# StreamVault — How It Works

## Traffic Flow Diagram

```
Internet
    │
    │  (only ports 80 and 443 come in from outside)
    ▼
Bell Home Hub  ──── forwards 80 & 443 ────►  Your Server
                                                    │
                                         Nginx Proxy Manager
                                         (listens on 80 & 443)
                                                    │
                              ┌─────────────────────┴──────────────────────┐
                              │                                             │
                              ▼                                             ▼
                     Frontend :3000                               Backend :8001
                   (inside Docker)                              (inside Docker)
```

## Why You Do NOT Open Ports 3000 or 8001 on Your Router

Nginx Proxy Manager sits in the middle. It receives all outside traffic on port 443,
looks at the domain name in the request, and internally forwards it to the right
service — all within Docker's private network on your server.

That internal hop (NPM → 3000 or NPM → 8001) never leaves your machine,
so your router never needs to know those ports exist.

Opening 3000 and 8001 on your router would be a security risk — it would let
anyone on the internet bypass Nginx Proxy Manager and hit your app directly
without SSL or any of NPM's protections.

## Port Summary

| Port  | Open on Router? | Why                                      |
|-------|-----------------|------------------------------------------|
| 443   | YES             | HTTPS — all real user traffic            |
| 80    | YES             | HTTP redirect to HTTPS + SSL cert renewal|
| 81    | Your IP only    | NPM Admin UI (for you to manage)         |
| 3000  | NO              | Frontend — internal, NPM proxies it      |
| 8001  | NO              | Backend — internal, NPM proxies it       |
| 27017 | NEVER           | MongoDB — must never be exposed          |

## Data Flow (per request)

```
User's browser
      │
      │ HTTPS request to streamvault.yourdomain.com
      ▼
Bell Home Hub (port 443 forwarded to your server)
      │
      ▼
Nginx Proxy Manager
      │
      ├─ streamvault.yourdomain.com  →  Frontend (React) :3000
      │       └─ Static pages, EPG, VOD browser, Guide
      │
      └─ streamvault.yourdomain.com/api/*  →  Backend (FastAPI) :8001
              ├─ /api/channels      — channel list & EPG data
              ├─ /api/auth          — login / JWT tokens
              ├─ /api/media         — media file serving (HLS, VOD)
              ├─ /api/vod           — on-demand catalog
              ├─ /api/catalog       — media metadata (IMDB-style)
              ├─ /api/customer      — device activation
              └─ /api/admin/*       — admin dashboard APIs
                      │
                      ▼
                  MongoDB :27017
                (inside Docker, never exposed)
```

## Media File Encryption in Transit

Since Nginx Proxy Manager terminates SSL on port 443, all media files
(HLS streams, VOD files, posters, logos) are served to users over an
encrypted HTTPS connection automatically — no extra configuration needed.

The internal path (NPM → backend:8001 → disk) is unencrypted, but this
traffic never leaves your server machine, so it is safe.

---
*Last updated: March 2026*
