# StreamVault Backup Agent

Lightweight API service that runs on each backup server in your network.

## Quick Install

```bash
# On each backup server:
sudo apt-get install -y python3 python3-venv python3-pip
mkdir -p /home/streamvault/backup-agent
cd /home/streamvault/backup-agent

# Copy agent.py and requirements.txt here, then:
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run the agent
python3 agent.py
```

## Configuration (Environment Variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKUP_DIR` | `/home/streamvault/backups` | Where backups are stored |
| `AGENT_PORT` | `9500` | Port the agent listens on |
| `AGENT_NAME` | (hostname) | Friendly name for this server |

Example:
```bash
AGENT_NAME="NAS-01" BACKUP_DIR="/mnt/backups" python3 agent.py
```

## Run as a Service (Supervisor)

```bash
sudo tee /etc/supervisor/conf.d/backup-agent.conf << 'EOF'
[program:backup-agent]
command=/home/streamvault/backup-agent/venv/bin/python3 agent.py
directory=/home/streamvault/backup-agent
environment=AGENT_NAME="Backup-Server-1",BACKUP_DIR="/home/streamvault/backups"
autostart=true
autorestart=true
stderr_logfile=/var/log/supervisor/backup-agent.err.log
stdout_logfile=/var/log/supervisor/backup-agent.out.log
EOF

sudo supervisorctl reload
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Auto-discovery + disk stats |
| GET | `/backups` | List all stored backups |
| POST | `/backups/receive` | Upload a backup archive |
| GET | `/backups/{filename}/download` | Download a backup (for restore) |
| DELETE | `/backups/{filename}` | Delete a backup |

## Firewall

Open port 9500 only on your **internal network** — do NOT expose to the internet:
```bash
sudo ufw allow from 10.0.0.0/8 to any port 9500
sudo ufw allow from 192.168.0.0/16 to any port 9500
```
