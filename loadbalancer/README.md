# StreamVault Load Balancer

A self-contained load balancing stack for StreamVault, designed to run on a
dedicated lightweight machine on your local network.

## What's In This Stack

| Container         | Role                                                       |
|-------------------|------------------------------------------------------------|
| `haproxy`         | Receives all incoming traffic, SSL termination, routing    |
| `monitor`         | Polls each node every 10 s, adjusts HAProxy weights live   |
| `certbot`         | Manages Let's Encrypt SSL certificates automatically        |

---

## Full Architecture

```
Internet
    │  ports 80 & 443
    ▼
Bell Home Hub
    │  forwards 80 & 443 to LB machine local IP
    ▼
┌─────────────────────────────────────────────────────┐
│  Load Balancer Machine  (cheap desktop, Linux)      │
│                                                     │
│  ┌──────────┐     ┌──────────────────────────────┐  │
│  │ HAProxy  │◄────│  Load Monitor (Python agent) │  │
│  │ :80/:443 │     │  polls /api/health/metrics   │  │
│  └────┬─────┘     │  every 10 s via local LAN    │  │
│       │           └──────────────────────────────┘  │
└───────┼─────────────────────────────────────────────┘
        │
        │  Routes over local network (192.168.2.x)
        │
        ├──────────────────────┐
        ▼                      ▼
┌──────────────┐      ┌──────────────┐
│   Node A     │      │   Node B     │
│  8c / 96GB   │      │  8c / 96GB   │
│              │      │              │
│ FastAPI:8001 │      │ FastAPI:8001 │
│ React:3000   │      │ React:3000   │
└──────┬───────┘      └──────┬───────┘
       │                     │
       └──────────┬──────────┘
                  │  NFS mount (shared uploads)
                  ▼
        ┌──────────────────┐
        │   TrueNAS Core   │
        │  Shared Storage  │
        │  + MongoDB VM    │
        └──────────────────┘
```

---

## Load Weight Algorithm

The Load Monitor calculates a **combined load score** every 10 seconds:

```
load_score = (cpu_percent × 0.65) + (ram_percent × 0.35)
```

CPU is weighted more than RAM because web workloads are typically CPU-bound.

| Load Score | HAProxy Weight | Effect on Traffic         |
|------------|----------------|---------------------------|
| < 30%      | **100**        | Full traffic              |
| 30 – 50%   | **75**         | Slightly reduced          |
| 50 – 65%   | **40**         | Over threshold, reduced   |
| 65 – 80%   | **15**         | High load, minimal        |
| > 80%      | **1**          | Critical, last resort     |
| Down       | **0**          | Removed from rotation     |

**Example:** Node A is at 70% load (weight 15), Node B is at 25% load (weight 100).
HAProxy sends roughly 87% of traffic to Node B and 13% to Node A.

**If a node goes completely down** (unreachable / not responding), its weight is
set to 0 and HAProxy automatically sends 100% of traffic to the healthy node.
When it comes back up, the monitor detects it and restores its weight.

---

## Setup Instructions

### Step 1 — Install Docker on the LB Machine

```bash
# Ubuntu / Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### Step 2 — Copy Files to LB Machine

```bash
# From your dev machine, copy this folder to the LB machine
scp -r /app/loadbalancer/ user@192.168.2.100:/home/user/streamvault-lb/
```

### Step 3 — Create Your .env File

```bash
cd /home/user/streamvault-lb/
cp .env.example .env
nano .env
```

Fill in the real local IPs of your two beefy servers:
```
NODE_A_HOST=192.168.2.101
NODE_B_HOST=192.168.2.102
```

### Step 4 — Get Your SSL Certificate (First Time Only)

Before HAProxy can start with SSL, you need a certificate.

```bash
# Temporarily run certbot standalone to get the first cert
docker run --rm -p 80:80 \
  -v ./certs:/etc/letsencrypt \
  certbot/certbot certonly \
  --standalone \
  --email your@email.com \
  --agree-tos \
  --no-eff-email \
  -d streamvault.yourdomain.com

# Combine the cert files into the format HAProxy expects
cat ./certs/live/streamvault.yourdomain.com/fullchain.pem \
    ./certs/live/streamvault.yourdomain.com/privkey.pem \
    > ./certs/streamvault.pem
```

### Step 5 — Start the Stack

```bash
docker compose up -d

# Watch the monitor logs to see weights adjusting live
docker logs -f streamvault_monitor
```

### Step 6 — Point Your Domain to the LB Machine

In your DNS settings (or router), update your domain's A record to point to
your **public IP** (as before). The Bell Home Hub forwards 80/443 to the LB
machine's local IP instead of the old single server.

Update your Bell Home Hub port forwards:
- Port 80  → LB machine local IP  (e.g. 192.168.2.100)
- Port 443 → LB machine local IP  (e.g. 192.168.2.100)

---

## Stats Dashboard

HAProxy has a built-in stats page. From inside your local network:

```
http://192.168.2.100:8404/stats
Username: admin
Password: streamvault_stats
```

You'll see live connection counts, request rates, health check status,
and the current weight of each node — all updating every 10 seconds.

> Do NOT open port 8404 on your router. This is internal LAN only.

---

## What Ports the LB Machine Needs Open

On the LB machine's firewall:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# Stats dashboard — local network only
sudo ufw allow from 192.168.2.0/24 to any port 8404 proto tcp
sudo ufw enable
```

On the Bell Home Hub (router):
- Forward port 80  → LB machine IP
- Forward port 443 → LB machine IP
- Do NOT forward 8001, 3000, 8404, or 27017

---

## Shared Storage (TrueNAS NFS Mount)

Both Node A and Node B must read and write media files from the **same location**.
Without shared storage, a file uploaded through Node A would not be visible through Node B.

### On TrueNAS
1. Create a dataset: `tank/streamvault-uploads`
2. Add an NFS share for that dataset
3. Allow access from both node IPs: `192.168.2.101` and `192.168.2.102`

### On Each Node (A and B)
```bash
# Install NFS client
sudo apt install nfs-common

# Create mount point
sudo mkdir -p /mnt/streamvault-uploads

# Add to /etc/fstab for auto-mount on boot
# Replace 192.168.2.200 with your TrueNAS server IP
echo "192.168.2.200:/mnt/tank/streamvault-uploads /mnt/streamvault-uploads nfs defaults,_netdev 0 0" \
  | sudo tee -a /etc/fstab

# Mount now without rebooting
sudo mount -a

# Verify
df -h | grep streamvault
```

### In StreamVault's docker-compose (on each node)
Mount the NFS share into the backend container:
```yaml
backend:
  volumes:
    - /mnt/streamvault-uploads:/app/backend/uploads
```

---

## MongoDB (TrueNAS VM)

Run MongoDB on a TrueNAS VM. Both backend nodes connect to it over the local network.

### On the MongoDB VM
```bash
docker run -d \
  --name mongodb \
  --restart unless-stopped \
  -p 27017:27017 \
  -v /mnt/tank/mongodb-data:/data/db \
  -e MONGO_INITDB_ROOT_USERNAME=streamvault \
  -e MONGO_INITDB_ROOT_PASSWORD=CHANGE_THIS_PASSWORD \
  mongo:7
```

### On Each Node — backend/.env
```
MONGO_URL=mongodb://streamvault:CHANGE_THIS_PASSWORD@192.168.2.200:27017/iptv_service?authSource=admin
```

> MongoDB's port 27017 should only be accessible within your local network.
> Never forward it through the router.

---

## Node Firewall Rules (Each Beefy Server)

The beefy servers only need to be reachable from the LB machine and each other.
They should NOT be reachable from the internet directly.

```bash
# Allow LB machine to reach the app
sudo ufw allow from 192.168.2.100 to any port 8001 proto tcp   # Backend
sudo ufw allow from 192.168.2.100 to any port 3000 proto tcp   # Frontend

# Allow local network for admin/management
sudo ufw allow from 192.168.2.0/24 to any port 22 proto tcp    # SSH

# Block everything else from internet
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw enable
```
