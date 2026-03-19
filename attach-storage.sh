#!/usr/bin/env bash
# =============================================================================
#  StreamVault — attach-storage.sh
#  Run this ONCE on each new server or VM before starting the Docker stack.
#
#  What it does:
#    1. Installs the NFS client package (if not already installed)
#    2. Pings TrueNAS to verify network connectivity
#    3. Tests that the NFS export is actually reachable
#    4. (Optional) Creates a systemd automount unit as a fallback,
#       so the share also mounts at boot outside of Docker
#    5. Prints the exact docker compose command to use going forward
#
#  Usage:
#    sudo bash attach-storage.sh
#
#  Or with explicit values (skips interactive prompts):
#    TRUENAS_IP=192.168.2.200 TRUENAS_NFS_PATH=/mnt/tank/streamvault-uploads \
#      sudo bash attach-storage.sh
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Require root ──────────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || error "Run this script with sudo: sudo bash attach-storage.sh"

# ── Gather inputs ─────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  StreamVault — Storage Attach Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [[ -z "${TRUENAS_IP:-}" ]]; then
  read -rp "  TrueNAS Scale IP address      [e.g. 192.168.2.200]: " TRUENAS_IP
fi
if [[ -z "${TRUENAS_NFS_PATH:-}" ]]; then
  read -rp "  NFS export path on TrueNAS    [e.g. /mnt/tank/streamvault-uploads]: " TRUENAS_NFS_PATH
fi

MOUNT_POINT="/mnt/streamvault-uploads"

echo ""
info "TrueNAS IP:   $TRUENAS_IP"
info "NFS Path:     $TRUENAS_NFS_PATH"
info "Local mount:  $MOUNT_POINT"
echo ""

# ── Step 1: Install NFS client ────────────────────────────────────────────────
info "Step 1/4 — Installing NFS client..."
if command -v apt-get &>/dev/null; then
  apt-get update -qq && apt-get install -y -qq nfs-common
elif command -v dnf &>/dev/null; then
  dnf install -y -q nfs-utils
elif command -v yum &>/dev/null; then
  yum install -y -q nfs-utils
else
  warn "Could not detect package manager. Install nfs-common / nfs-utils manually."
fi
success "NFS client ready"

# ── Step 2: Ping TrueNAS ──────────────────────────────────────────────────────
info "Step 2/4 — Checking network connectivity to TrueNAS ($TRUENAS_IP)..."
if ping -c 2 -W 2 "$TRUENAS_IP" &>/dev/null; then
  success "TrueNAS is reachable on the local network"
else
  error "Cannot reach $TRUENAS_IP — check your network/firewall settings"
fi

# ── Step 3: Test NFS export ───────────────────────────────────────────────────
info "Step 3/4 — Verifying NFS export is accessible..."
if showmount -e "$TRUENAS_IP" 2>/dev/null | grep -q "$TRUENAS_NFS_PATH"; then
  success "NFS export $TRUENAS_NFS_PATH is available"
else
  warn "showmount did not find $TRUENAS_NFS_PATH — this may be normal if rpcbind is disabled."
  warn "Will attempt a test mount to confirm..."
  mkdir -p /tmp/sv_nfs_test
  if mount -t nfs4 "$TRUENAS_IP:$TRUENAS_NFS_PATH" /tmp/sv_nfs_test -o soft,timeo=10; then
    success "Test mount succeeded — NFS export is reachable"
    umount /tmp/sv_nfs_test
    rmdir /tmp/sv_nfs_test
  else
    error "Test mount failed. Check TrueNAS NFS share settings and ensure this server's IP is allowed."
  fi
fi

# ── Step 4: Optional systemd automount (belt-and-suspenders) ─────────────────
info "Step 4/4 — Setting up systemd automount (fallback for system-level access)..."

mkdir -p "$MOUNT_POINT"

# Escape the mount point path for systemd unit names
# e.g. /mnt/streamvault-uploads → mnt-streamvault\x2duploads
UNIT_NAME=$(systemd-escape --path "$MOUNT_POINT")

cat > "/etc/systemd/system/${UNIT_NAME}.mount" <<EOF
[Unit]
Description=StreamVault shared uploads mount (TrueNAS Scale NFS)
After=network-online.target
Wants=network-online.target

[Mount]
What=${TRUENAS_IP}:${TRUENAS_NFS_PATH}
Where=${MOUNT_POINT}
Type=nfs4
Options=rw,soft,timeo=30,retrans=3,_netdev,nfsvers=4.1

[Install]
WantedBy=multi-user.target
EOF

cat > "/etc/systemd/system/${UNIT_NAME}.automount" <<EOF
[Unit]
Description=Automount StreamVault shared uploads (TrueNAS Scale NFS)
After=network-online.target
Wants=network-online.target

[Automount]
Where=${MOUNT_POINT}
TimeoutIdleSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable  "${UNIT_NAME}.automount"
systemctl start   "${UNIT_NAME}.automount"

# Verify it actually mounted by touching it
if touch "$MOUNT_POINT/.sv_test" 2>/dev/null; then
  rm -f "$MOUNT_POINT/.sv_test"
  success "Automount working — $MOUNT_POINT is live"
else
  warn "Automount unit created but write test failed. The Docker NFS volume will still work independently."
fi

# ── Write env vars to .env if present ────────────────────────────────────────
ENV_FILE="$(dirname "$(realpath "$0")")/.env"
if [[ -f "$ENV_FILE" ]]; then
  if ! grep -q "TRUENAS_IP" "$ENV_FILE"; then
    echo "" >> "$ENV_FILE"
    echo "# TrueNAS Scale shared storage" >> "$ENV_FILE"
    echo "TRUENAS_IP=${TRUENAS_IP}" >> "$ENV_FILE"
    echo "TRUENAS_NFS_PATH=${TRUENAS_NFS_PATH}" >> "$ENV_FILE"
    success "Added TRUENAS_IP and TRUENAS_NFS_PATH to .env"
  else
    info ".env already contains TRUENAS_IP — not modified"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}Storage setup complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  To start StreamVault with shared NFS storage:"
echo ""
echo -e "  ${CYAN}docker compose -f docker-compose.yml -f docker-compose.storage.yml up -d${NC}"
echo ""
echo "  To stop:"
echo -e "  ${CYAN}docker compose -f docker-compose.yml -f docker-compose.storage.yml down${NC}"
echo ""
echo "  Every server/VM you add — just run this script once, then"
echo "  use the command above to start the stack."
echo ""
