# StreamVault — Portainer CE (Docker Manager)

Portainer CE gives you a clean web UI to monitor and manage all your Docker
containers, view live logs, check per-container CPU/RAM, restart services,
inspect images and volumes — all from your browser.

The StreamVault Admin Dashboard has a **Docker Manager** button in the header
that opens Portainer automatically.

---

## Quick Start

Deploy Portainer on the same machine as StreamVault (or any machine that can
reach the Docker socket):

```bash
cd portainer
docker compose up -d
```

Then open: **http://YOUR_SERVER_IP:9000**

The first time you open it, Portainer asks you to create an admin password.
After that it's fully usable.

---

## What You Can Do in Portainer

| Feature | What it does |
|---------|-------------|
| **Containers** | See all running/stopped containers, restart, stop, kill |
| **Logs** | Live log tail for any container — great for debugging crashes |
| **Stats** | Per-container CPU%, RAM usage, network I/O |
| **Exec** | Open a shell inside a running container |
| **Images** | See all pulled Docker images and their sizes |
| **Volumes** | Inspect named volumes (including the `uploads` volume) |
| **Networks** | View internal/proxy network configs |
| **Stacks** | Manage docker-compose stacks visually |

---

## Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 9000 | HTTP | Local network access (use this for LAN admin) |
| 9443 | HTTPS | Proxied access via Nginx Proxy Manager |

> **Security tip:** Do NOT forward port 9000 on your router. Keep it local-network only.
> If you need external HTTPS access, proxy it through Nginx Proxy Manager.

---

## Nginx Proxy Manager Setup (Optional)

If you want to access Portainer securely from outside your network:

1. In NPM → **Proxy Hosts → Add Proxy Host**
2. Domain: `portainer.yourdomain.com`
3. Forward to: `http://YOUR_SERVER_IP:9000`
4. Enable SSL + Force HTTPS

---

## Updating Portainer

Portainer releases updates frequently. To update:

```bash
cd portainer
docker compose pull
docker compose up -d
```

Your settings and data are preserved in the `portainer_data` volume.

---

## Firewall Rules

On each server running Portainer, restrict port 9000 to your local network:

```bash
# Allow local network only
sudo ufw allow from 192.168.2.0/24 to any port 9000 proto tcp

# Block external access
sudo ufw deny 9000/tcp
sudo ufw enable
```
