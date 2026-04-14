"""
Health & Metrics endpoint
Returns system CPU, RAM, and load average so the Load Monitor
on the LB machine can make smart weight decisions.
"""
import os
import psutil
from fastapi import APIRouter, Depends, Header, HTTPException
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from models.admin import Admin
from utils.security import verify_token

router = APIRouter(prefix="/api/health", tags=["health"])

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")

async def get_db():
    from server import db
    return db

async def get_current_admin(authorization: Optional[str] = Header(None), db: AsyncIOMotorDatabase = Depends(get_db)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.replace('Bearer ', '')
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    admin = await db.admins.find_one({"email": payload.get("sub")})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    return Admin(**admin)

# Sub-folders inside the uploads directory and their display names
UPLOAD_FOLDERS = [
    ("media",         "Media Files"),
    ("posters",       "Posters"),
    ("logos",         "Channel Logos"),
    ("thumbnails",    "Thumbnails"),
    ("branding",      "Branding"),
    ("apk",           "APK Updates"),
    ("cvr",           "CVR Recordings"),
    ("notifications", "Notification Images"),
    ("qr_codes",      "QR Codes"),
]


def _fmt_bytes(num_bytes: int) -> str:
    """Return a human-readable size string (B → KB → MB → GB → TB)."""
    for unit in ("B", "KB", "MB", "GB"):
        if abs(num_bytes) < 1024:
            return f"{num_bytes:.1f} {unit}"
        num_bytes /= 1024
    return f"{num_bytes:.2f} TB"


def _folder_stats(path: str) -> dict:
    """Return total bytes and file count for a directory tree."""
    total_bytes = 0
    file_count = 0
    try:
        for dirpath, _dirs, files in os.walk(path):
            for f in files:
                fp = os.path.join(dirpath, f)
                try:
                    total_bytes += os.path.getsize(fp)
                    file_count += 1
                except OSError:
                    pass
    except OSError:
        pass
    return {"bytes": total_bytes, "human": _fmt_bytes(total_bytes), "files": file_count}


@router.get("")
async def health_check():
    """Basic liveness check used by HAProxy health checks (expects 200)."""
    return {"status": "ok"}


@router.get("/metrics")
async def get_metrics(admin: Admin = Depends(get_current_admin)):
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


@router.get("/storage")
async def get_storage_stats(admin: Admin = Depends(get_current_admin)):
    """
    Admin storage overview.
    Returns full server disk stats + per-folder StreamVault upload sizes.
    All sizes are returned as raw bytes AND as human-readable strings so the
    frontend can render visual bars without doing its own unit conversion.
    """
    disk = psutil.disk_usage("/")

    # Per-folder breakdown of the uploads directory
    folders = []
    uploads_total_bytes = 0
    for folder_slug, label in UPLOAD_FOLDERS:
        path = os.path.join(UPLOADS_DIR, folder_slug)
        stats = _folder_stats(path)
        uploads_total_bytes += stats["bytes"]
        folders.append({
            "slug":   folder_slug,
            "label":  label,
            "bytes":  stats["bytes"],
            "human":  stats["human"],
            "files":  stats["files"],
        })

    # Sort biggest folder first for display
    folders.sort(key=lambda x: x["bytes"], reverse=True)

    # Warning levels: NORMAL → WATCH (70%) → WARN (85%) → CRITICAL (95%)
    pct = disk.percent
    if pct >= 95:
        level = "critical"
    elif pct >= 85:
        level = "warn"
    elif pct >= 70:
        level = "watch"
    else:
        level = "ok"

    return {
        "disk": {
            "total_bytes": disk.total,
            "used_bytes":  disk.used,
            "free_bytes":  disk.free,
            "percent":     round(pct, 1),
            "total_human": _fmt_bytes(disk.total),
            "used_human":  _fmt_bytes(disk.used),
            "free_human":  _fmt_bytes(disk.free),
            "level":       level,
        },
        "uploads": {
            "total_bytes": uploads_total_bytes,
            "total_human": _fmt_bytes(uploads_total_bytes),
            "folders": folders,
        },
    }
