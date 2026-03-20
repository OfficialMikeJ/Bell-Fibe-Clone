# StreamVault — Multi-Server Deployment Checklist

Complete step-by-step guide to deploying StreamVault across two application
nodes (Node A + Node B) with TrueNAS Scale shared storage, Nginx Proxy
Manager, and the HAProxy load balancer.

---

## Infrastructure Overview

```
Internet
    │  (port 80/443)
    ▼
[NPM Machine]       192.168.2.50
    │  (HAProxy or direct proxy)
    ├──────────────────────────────────────┐
    ▼                                      ▼
[Node A]  192.168.2.101          [Node B]  192.168.2.102
  StreamVault Docker               StreamVault Docker
  Backend :8001                    Backend :8001
  Frontend :3000                   Frontend :3000
    │                                      │
    └──────────────┬───────────────────────┘
                   │  NFS (NFSv4.1)
                   ▼
         [TrueNAS Scale]  192.168.2.200
           /mnt/tank/streamvault-uploads
                   │
                   │  (optional)
                   ▼
            [MongoDB VM]  192.168.2.201
             Port 27017
```

---

## Pre-Deployment Checklist

- [ ] TrueNAS Scale is online and NFS share is created
- [ ] MongoDB is running (either on TrueNAS Scale VM or dedicated VM)
- [ ] NPM machine is running (`docker compose up -d` in `~/npm/`)
- [ ] Port 80 and 443 are forwarded on your router to the NPM machine IP
- [ ] Your domain's DNS A record points to your public IP

---

## Step 1 — TrueNAS Scale (One Time)

1. Login to TrueNAS Scale web UI → **Datasets → Add Dataset**
   - Name: `streamvault-uploads`
   - Share Type: Generic

2. **Shares → Unix Shares (NFS) → Add**
   - Path: `/mnt/tank/streamvault-uploads`
   - Allowed Hosts: `192.168.2.0/24` (or specific node IPs)
   - NFS Version: NFSv4

3. **System → Services → NFS** → ensure it's Running + Auto-start

4. Note the NFS path (you'll need it in Step 3):
   ```
   /mnt/tank/streamvault-uploads
   ```

---

## Step 2 — MongoDB (One Time)

If running MongoDB on TrueNAS Scale as a VM or on a dedicated machine:

```bash
# On the MongoDB machine
docker run -d \
  --name streamvault_mongo \
  --restart unless-stopped \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=streamvault \
  -e MONGO_INITDB_ROOT_PASSWORD=YOUR_STRONG_PASSWORD \
  -v mongo_data:/data/db \
  mongo:7
```

Note the connection string:
```
mongodb://streamvault:YOUR_STRONG_PASSWORD@192.168.2.201:27017/iptv_service?authSource=admin
```

---

## Step 3 — Deploy Node A (First Application Node)

```bash
# 1. Clone repo
git clone YOUR_REPO_URL /opt/streamvault
cd /opt/streamvault

# 2. Create .env
cp .env.example .env
nano .env
```

Key `.env` values for Node A:
```env
# MongoDB (point to your central MongoDB VM)
MONGO_URL=mongodb://streamvault:PASSWORD@192.168.2.201:27017/iptv_service?authSource=admin
DB_NAME=iptv_service

# Public URLs (set after NPM is configured)
REACT_APP_BACKEND_URL=https://api.yourdomain.com

# TrueNAS shared storage
TRUENAS_IP=192.168.2.200
TRUENAS_NFS_PATH=/mnt/tank/streamvault-uploads

# Security (change these!)
JWT_SECRET=generate-a-strong-random-secret-here
CORS_ORIGINS=https://tv.yourdomain.com

# Service name
SERVICE_NAME=StreamVault TV
```

```bash
# 3. Run storage attach script (installs NFS client + creates systemd automount)
sudo bash attach-storage.sh

# 4. Start stack with NFS storage
docker compose -f docker-compose.yml -f docker-compose.storage.yml up -d

# 5. Verify everything is running
docker ps
curl http://localhost:8001/api/health
curl http://localhost:3000
```

---

## Step 4 — Deploy Node B (Second Application Node)

Same as Node A — **use the exact same `.env` file** (same `JWT_SECRET`, same `MONGO_URL`, same `REACT_APP_BACKEND_URL`):

```bash
git clone YOUR_REPO_URL /opt/streamvault
cd /opt/streamvault
# Copy .env from Node A (scp or paste manually)
scp user@192.168.2.101:/opt/streamvault/.env .

sudo bash attach-storage.sh
docker compose -f docker-compose.yml -f docker-compose.storage.yml up -d

docker ps
curl http://localhost:8001/api/health
```

---

## Step 5 — Deploy Portainer (on each node or one dedicated machine)

```bash
cd /opt/streamvault/portainer
docker compose up -d
# Open: http://192.168.2.101:9000
```

---

## Step 6 — Configure Nginx Proxy Manager

See `NginxProxyManagerGuide.md` for full details.

**Minimum setup — two proxy hosts in NPM:**

1. `api.yourdomain.com` → `http://192.168.2.101:8001` (or HAProxy VIP)
2. `tv.yourdomain.com`  → `http://192.168.2.101:3000`

Both with Let's Encrypt SSL, Force HTTPS, Websockets enabled.

---

## Step 7 — (Optional) Enable Load Balancer

The HAProxy load balancer in `/app/loadbalancer/` distributes traffic across both nodes.

On the **NPM/LB machine** (or a separate machine):

```bash
cd /opt/streamvault/loadbalancer
cp .env.example .env
nano .env
```

Set:
```env
NODE_A_HOST=192.168.2.101
NODE_B_HOST=192.168.2.102
BACKEND_PORT=8001
FRONTEND_PORT=3000
```

```bash
docker compose up -d
```

Then update NPM proxy hosts to point to the HAProxy machine IP instead of a specific node IP.

---

## Step 8 — Final Verification

Run these checks after full deployment:

```bash
# From any machine on the network:

# 1. Backend health
curl https://api.yourdomain.com/api/health

# 2. Storage is shared — upload a file via Node A, then check it exists on Node B
# (do this via the Admin Dashboard → Media Library)

# 3. Both nodes respond to health checks
curl http://192.168.2.101:8001/api/health/metrics
curl http://192.168.2.102:8001/api/health/metrics

# 4. Check Admin Dashboard → Statistics → Storage
# Both nodes should show the same upload folder sizes (same NFS share)
```

---

## Adding a Third Node Later

1. Provision the machine
2. Clone the repo + copy `.env`
3. `sudo bash attach-storage.sh`
4. `docker compose -f docker-compose.yml -f docker-compose.storage.yml up -d`
5. In `loadbalancer/.env`, add `NODE_C_HOST=192.168.2.103` and restart the LB stack
6. Update NPM if pointing directly to individual nodes

That's it — the node immediately joins the cluster.

---

## Troubleshooting

### Container keeps restarting
```bash
docker logs streamvault_backend --tail 50
docker logs streamvault_frontend --tail 50
```

### NFS mount not working
```bash
mount | grep streamvault      # Check if mounted
showmount -e 192.168.2.200    # Check TrueNAS exports
sudo systemctl status mnt-streamvault\\x2duploads.automount
```

### MongoDB connection refused
```bash
# On MongoDB machine
docker ps | grep mongo
docker logs streamvault_mongo --tail 20
# Verify firewall allows port 27017 from node IPs
```

### Media playback failing (403 token error)
- Media tokens expire after 4 hours
- Reload the page to get fresh signed URLs
- Check server time is correct: `date` on both nodes (NTP sync required)

### Time drift between nodes causes token failures
```bash
sudo apt install -y ntp
sudo systemctl enable --now ntp
```

---

## Quick Reference

| Component | IP | Port | Start Command |
|-----------|-----|------|---------------|
| NPM | 192.168.2.50 | 80/443/81 | `cd ~/npm && docker compose up -d` |
| Node A | 192.168.2.101 | 8001/3000 | `docker compose -f docker-compose.yml -f docker-compose.storage.yml up -d` |
| Node B | 192.168.2.102 | 8001/3000 | same as Node A |
| TrueNAS Scale | 192.168.2.200 | UI:80 | (always on) |
| MongoDB | 192.168.2.201 | 27017 | `docker run mongo:7 ...` |
| HAProxy LB | 192.168.2.50 | 9001 | `cd loadbalancer && docker compose up -d` |
| Portainer | any node | 9000 | `cd portainer && docker compose up -d` |
