# StreamVault — Storage Setup Guide

How to attach TrueNAS Scale shared storage to every server or VM running
the StreamVault Docker stack, so all nodes read and write the same media files.

---

## Why Shared Storage?

Without it, a video file uploaded through **Node A** doesn't exist on **Node B**.
The HAProxy load balancer would randomly send playback requests to the node that
doesn't have the file, causing instant playback failures.

The fix: every node mounts the same NFS share from TrueNAS Scale.
Docker handles the mount automatically on every start/restart.

---

## TrueNAS Scale — One-time NFS Setup

Do this once on your TrueNAS Scale server before setting up any application nodes.

### 1. Create a Dataset

In the TrueNAS Scale web UI:
1. **Storage → Datasets → Add Dataset**
2. Name: `streamvault-uploads`
3. Share Type: `Generic` (or `Apps` — both work)

### 2. Create the NFS Share

1. **Shares → Unix Shares (NFS) → Add**
2. Path: `/mnt/tank/streamvault-uploads` *(your actual pool name may differ)*
3. Tick **Enabled**
4. Under **Advanced Options**:
   - Hosts (allowed): add each node's IP, e.g. `192.168.2.101` and `192.168.2.102`
   - Or allow the whole subnet: `192.168.2.0/24`
5. NFS Version: **NFSv4** (TrueNAS Scale default)
6. Save

### 3. Note the Path

The NFS path you'll use is usually:
```
/mnt/<pool-name>/streamvault-uploads
```
Example: `/mnt/tank/streamvault-uploads`

---

## Application Nodes — Per-Server Setup (Run Once Per Node)

For each server or VM that will run StreamVault, do this once:

### Step 1 — Add TrueNAS variables to your .env

```env
TRUENAS_IP=192.168.2.200
TRUENAS_NFS_PATH=/mnt/tank/streamvault-uploads
```

### Step 2 — Run the attach script

```bash
sudo bash attach-storage.sh
```

The script does everything automatically:
- Installs the NFS client
- Pings TrueNAS to verify network connectivity
- Tests the NFS export
- Creates a systemd automount unit (the share mounts at boot, outside Docker too)
- Adds the variables to your `.env`

Output looks like:
```
[OK]    NFS client ready
[OK]    TrueNAS is reachable on the local network
[OK]    NFS export /mnt/tank/streamvault-uploads is available
[OK]    Automount working — /mnt/streamvault-uploads is live

Storage setup complete!

  docker compose -f docker-compose.yml -f docker-compose.storage.yml up -d
```

### Step 3 — Start the stack

```bash
docker compose -f docker-compose.yml -f docker-compose.storage.yml up -d
```

That's it. Docker's NFS volume driver handles mounting the share into the
backend container on every `up`.

---

## How the Docker NFS Volume Works

The `docker-compose.storage.yml` override redefines the `uploads` named volume:

```yaml
volumes:
  uploads:
    driver: local
    driver_opts:
      type: nfs
      o: "addr=192.168.2.200,nfsvers=4.1,rw,soft,timeo=30,retrans=3,_netdev"
      device: ":/mnt/tank/streamvault-uploads"
```

When Docker Compose starts, it mounts this NFS share at
`/app/backend/uploads` inside the backend container — the same path the
app uses for all uploaded files.

**No code changes needed.** The backend doesn't know or care whether
`uploads/` is a local folder or a network share.

---

## Adding a New Node Later

1. Spin up the new server or VM
2. Clone your repo (or copy the folder)
3. Copy your `.env` from an existing node
4. Run `sudo bash attach-storage.sh`
5. `docker compose -f docker-compose.yml -f docker-compose.storage.yml up -d`

That's the full process for every new node going forward.

---

## Single-Server Mode (Testing / No TrueNAS)

During testing or on a single server, use the standard command — no NFS needed:

```bash
docker compose up -d
```

This uses a local Docker volume. Files stay on that machine only.
Switch to the NFS command when you go multi-server.

---

## Two-Layer Redundancy

The script sets up **two independent paths** to the shared storage:

| Layer | What it is | When it's used |
|-------|-----------|----------------|
| **Docker NFS volume** | `docker-compose.storage.yml` | Primary — Docker mounts it into containers |
| **systemd automount** | `/mnt/streamvault-uploads` | Fallback — also accessible at OS level for backups, rsync, etc. |

If Docker is down, the mount is still live at `/mnt/streamvault-uploads`.
If systemd has an issue, Docker's own NFS driver handles it independently.

---

## Troubleshooting

### "mount.nfs: Connection refused"
- Check that the NFS service is running on TrueNAS: **System → Services → NFS → Running**
- Check that this node's IP is in the NFS share's allowed hosts list

### "mount.nfs: access denied"
- TrueNAS allowed hosts list needs to include this server's IP
- Try the whole subnet: `192.168.2.0/24`

### NFSv4 vs NFSv3
If you hit version negotiation errors, change in `docker-compose.storage.yml`:
```yaml
o: "addr=${TRUENAS_IP},nfsvers=3,rw,soft,timeo=30"
```

### Check what's mounted
```bash
# See all active mounts
mount | grep streamvault

# Check Docker volume status
docker volume inspect streamvault_uploads
```

### Test write access manually
```bash
echo "test" > /mnt/streamvault-uploads/write_test.txt && echo "Write OK" || echo "Write FAILED"
rm /mnt/streamvault-uploads/write_test.txt
```

---

## iSCSI Alternative (Block Storage — VM Specific)

If you're running TrueNAS VMs and want **block-level storage** instead of file-level NFS
(slightly better performance for large sequential writes like video):

1. **TrueNAS: Sharing → iSCSI** — create an extent + target
2. On the VM: install `open-iscsi`, discover and attach the target
3. Format the block device: `mkfs.ext4 /dev/sdb`
4. Mount it at `/mnt/streamvault-uploads`

**Use NFS unless you have a specific reason for iSCSI** — NFS is simpler,
supports multiple simultaneous readers (better for playback), and works
equally well for this workload.

---

## Quick Reference

| Task | Command |
|------|---------|
| First-time setup | `sudo bash attach-storage.sh` |
| Start with NFS storage | `docker compose -f docker-compose.yml -f docker-compose.storage.yml up -d` |
| Start without NFS (testing) | `docker compose up -d` |
| Check storage stats | Admin Dashboard → Statistics → Storage |
| Check mount is live | `mount \| grep streamvault` |
| Remount after reboot | Automatic (systemd automount) |
