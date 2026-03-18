"""
StreamVault Load Monitor
Polls each backend node's /api/health/metrics endpoint every POLL_INTERVAL seconds,
calculates a weight based on CPU + RAM load, and updates HAProxy dynamically via
its Unix stats socket — no restart required.

Weight Algorithm (combined load score = CPU*0.65 + RAM*0.35):
  < 30%  →  weight 100  (full traffic)
  30-50% →  weight 75   (slightly reduced — approaching threshold)
  50-65% →  weight 40   (over threshold, significantly reduced)
  65-80% →  weight 15   (high load, minimal traffic)
  > 80%  →  weight 1    (critical load, emergency only)
  Down   →  weight 0    (removed from rotation entirely)
"""

import asyncio
import aiohttp
import logging
import os
import socket
import json
from datetime import datetime, timezone

# ── Configuration ────────────────────────────────────────────────────────────
NODE_A_HOST = os.environ.get("NODE_A_HOST", "192.168.2.101")
NODE_B_HOST = os.environ.get("NODE_B_HOST", "192.168.2.102")
BACKEND_PORT = int(os.environ.get("BACKEND_PORT", "8001"))
FRONTEND_PORT = int(os.environ.get("FRONTEND_PORT", "3000"))
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "10"))          # seconds
REQUEST_TIMEOUT = int(os.environ.get("REQUEST_TIMEOUT", "5"))       # seconds
HAPROXY_SOCKET = os.environ.get("HAPROXY_SOCKET", "/var/run/haproxy/haproxy.sock")
HIGH_LOAD_THRESHOLD = float(os.environ.get("HIGH_LOAD_THRESHOLD", "50.0"))

NODES = [
    {"name": "node_a", "host": NODE_A_HOST},
    {"name": "node_b", "host": NODE_B_HOST},
]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("loadmonitor")

# ── Weight Algorithm ──────────────────────────────────────────────────────────
def calculate_weight(cpu_pct: float, ram_pct: float) -> int:
    """
    Combined load score weighted toward CPU (more relevant for web workloads).
    Returns an integer weight 1–100 for HAProxy, or 0 if node should be removed.
    """
    load_score = (cpu_pct * 0.65) + (ram_pct * 0.35)

    if load_score >= 80:
        return 1    # Critical — keep in rotation as last resort only
    elif load_score >= 65:
        return 15   # High load — minimal traffic
    elif load_score >= 50:
        return 40   # Over threshold — significantly reduced
    elif load_score >= 30:
        return 75   # Approaching threshold — slightly reduced
    else:
        return 100  # Healthy — full traffic


# ── HAProxy Socket Control ────────────────────────────────────────────────────
def haproxy_cmd(command: str) -> str:
    """Send a command to HAProxy via its Unix stats socket."""
    try:
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.settimeout(3)
        sock.connect(HAPROXY_SOCKET)
        sock.send(f"{command}\n".encode())
        response = b""
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                break
            response += chunk
        sock.close()
        return response.decode().strip()
    except Exception as e:
        logger.error(f"HAProxy socket error [{command}]: {e}")
        return ""


def set_node_weight(node_name: str, backend: str, weight: int):
    """Set the weight of a server in an HAProxy backend."""
    result = haproxy_cmd(f"set weight {backend}/{node_name} {weight}")
    if result:
        logger.debug(f"  HAProxy: {backend}/{node_name} weight={weight} → {result}")


def get_haproxy_stats() -> dict:
    """Fetch current HAProxy stats for all servers."""
    raw = haproxy_cmd("show stat")
    stats = {}
    for line in raw.splitlines():
        if line.startswith("#") or not line.strip():
            continue
        parts = line.split(",")
        if len(parts) > 18:
            backend = parts[0]
            server = parts[1]
            status = parts[17] if len(parts) > 17 else "?"
            weight = parts[18] if len(parts) > 18 else "?"
            stats[f"{backend}/{server}"] = {"status": status, "weight": weight}
    return stats


# ── Node Metrics Fetch ────────────────────────────────────────────────────────
async def fetch_metrics(session: aiohttp.ClientSession, node: dict) -> dict | None:
    """
    Fetch live CPU/RAM metrics from a node's health endpoint.
    Returns None if the node is unreachable or returns an error.
    """
    url = f"http://{node['host']}:{BACKEND_PORT}/api/health/metrics"
    try:
        async with session.get(
            url, timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)
        ) as resp:
            if resp.status == 200:
                return await resp.json()
            logger.warning(f"{node['name']} returned HTTP {resp.status}")
            return None
    except asyncio.TimeoutError:
        logger.warning(f"{node['name']} timed out after {REQUEST_TIMEOUT}s")
        return None
    except aiohttp.ClientConnectorError:
        logger.warning(f"{node['name']} ({node['host']}) is unreachable")
        return None
    except Exception as e:
        logger.warning(f"{node['name']} metrics error: {e}")
        return None


# ── State Tracking ────────────────────────────────────────────────────────────
node_state: dict[str, dict] = {
    n["name"]: {"weight": 100, "status": "unknown", "last_seen": None}
    for n in NODES
}


def print_status_table():
    """Print a clean status table to the log."""
    lines = ["─" * 62]
    lines.append(f"  {'NODE':<12} {'CPU':>6} {'RAM':>6} {'LOAD':>6} {'WEIGHT':>8}  STATUS")
    lines.append("─" * 62)
    for name, state in node_state.items():
        cpu   = state.get("cpu_pct", 0)
        ram   = state.get("ram_pct", 0)
        load  = state.get("load_score", 0)
        wt    = state.get("weight", 0)
        st    = state.get("status", "unknown")
        bar   = "▓" * int(load / 10) + "░" * (10 - int(load / 10))
        lines.append(f"  {name:<12} {cpu:>5.1f}% {ram:>5.1f}% {load:>5.1f}% {wt:>8}  [{bar}] {st}")
    lines.append("─" * 62)
    for line in lines:
        logger.info(line)


# ── Main Monitor Loop ─────────────────────────────────────────────────────────
async def monitor_loop():
    logger.info("StreamVault Load Monitor started")
    logger.info(f"  Node A: {NODE_A_HOST}:{BACKEND_PORT}")
    logger.info(f"  Node B: {NODE_B_HOST}:{BACKEND_PORT}")
    logger.info(f"  Poll interval: {POLL_INTERVAL}s")
    logger.info(f"  High-load threshold: {HIGH_LOAD_THRESHOLD}%")
    logger.info(f"  HAProxy socket: {HAPROXY_SOCKET}")

    tick = 0
    async with aiohttp.ClientSession() as session:
        while True:
            tick += 1
            tasks = [fetch_metrics(session, node) for node in NODES]
            results = await asyncio.gather(*tasks)

            for node, metrics in zip(NODES, results):
                name = node["name"]

                if metrics is None:
                    # Node is down — pull it out of rotation
                    node_state[name].update({"status": "DOWN", "weight": 0, "cpu_pct": 0, "ram_pct": 0, "load_score": 0})
                    set_node_weight(name, "streamvault_backend", 0)
                    set_node_weight(name, "streamvault_frontend", 0)
                    continue

                cpu   = float(metrics.get("cpu_percent", 0))
                ram   = float(metrics.get("ram_percent", 0))
                load  = round((cpu * 0.65) + (ram * 0.35), 1)
                wt    = calculate_weight(cpu, ram)
                status = "CRITICAL" if wt <= 1 else "HIGH" if wt <= 15 else "BUSY" if wt <= 40 else "OK"

                node_state[name].update({
                    "cpu_pct": cpu,
                    "ram_pct": ram,
                    "load_score": load,
                    "weight": wt,
                    "status": status,
                    "last_seen": datetime.now(timezone.utc).isoformat(),
                })

                set_node_weight(name, "streamvault_backend", wt)
                set_node_weight(name, "streamvault_frontend", wt)

            # Print summary table every 6 ticks (~60s)
            if tick % 6 == 0:
                print_status_table()

            await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(monitor_loop())
