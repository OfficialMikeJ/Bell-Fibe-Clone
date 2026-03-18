"""
Health & Metrics endpoint
Returns system CPU, RAM, and load average so the Load Monitor
on the LB machine can make smart weight decisions.
"""
import os
import psutil
from fastapi import APIRouter

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("")
async def health_check():
    """Basic liveness check used by HAProxy health checks (expects 200)."""
    return {"status": "ok"}


@router.get("/metrics")
async def get_metrics():
    """
    Returns live system load metrics.
    Called every POLL_INTERVAL seconds by the Load Monitor on the LB machine.
    """
    cpu = psutil.cpu_percent(interval=0.5)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    # Load average (1 min) — Linux only; falls back to CPU % on Windows
    try:
        load_avg_1m = os.getloadavg()[0]
        load_avg_5m = os.getloadavg()[1]
    except AttributeError:
        load_avg_1m = cpu / 100
        load_avg_5m = cpu / 100

    return {
        "status": "ok",
        "cpu_percent": round(cpu, 1),
        "ram_percent": round(ram.percent, 1),
        "ram_used_gb": round(ram.used / (1024 ** 3), 2),
        "ram_total_gb": round(ram.total / (1024 ** 3), 2),
        "ram_available_gb": round(ram.available / (1024 ** 3), 2),
        "load_avg_1m": round(load_avg_1m, 2),
        "load_avg_5m": round(load_avg_5m, 2),
        "disk_used_gb": round(disk.used / (1024 ** 3), 2),
        "disk_total_gb": round(disk.total / (1024 ** 3), 2),
        "disk_percent": round(disk.percent, 1),
    }
