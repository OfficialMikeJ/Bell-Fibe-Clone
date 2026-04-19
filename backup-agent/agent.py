#!/usr/bin/env python3
"""
StreamVault Backup Agent
========================
Lightweight API that runs on each backup server.
Receives, stores, lists, and sends back backups for StreamVault.

Install:
    pip install fastapi uvicorn aiofiles

Run:
    python3 agent.py

Default port: 9500
"""

import os
import sys
import json
import shutil
import asyncio
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from starlette.middleware.cors import CORSMiddleware
import aiofiles
import uvicorn

# ── Config ────────────────────────────────────────────────────────────────────
BACKUP_DIR = Path(os.environ.get("BACKUP_DIR", "/home/streamvault/backups"))
AGENT_PORT = int(os.environ.get("AGENT_PORT", "9500"))
AGENT_NAME = os.environ.get("AGENT_NAME", "")

BACKUP_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="StreamVault Backup Agent", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Helpers ───────────────────────────────────────────────────────────────────
def get_disk_stats():
    usage = shutil.disk_usage(str(BACKUP_DIR))
    return {
        "total_bytes": usage.total,
        "used_bytes": usage.used,
        "free_bytes": usage.free,
        "used_percent": round((usage.used / usage.total) * 100, 1),
        "total_gb": round(usage.total / (1024**3), 1),
        "used_gb": round(usage.used / (1024**3), 1),
        "free_gb": round(usage.free / (1024**3), 1),
    }

def get_hostname():
    import socket
    return AGENT_NAME or socket.gethostname()

def list_backup_files():
    backups = []
    for f in sorted(BACKUP_DIR.glob("*.tar.gz"), key=os.path.getmtime, reverse=True):
        stat = f.stat()
        backups.append({
            "filename": f.name,
            "size_bytes": stat.st_size,
            "size_mb": round(stat.st_size / (1024**2), 1),
            "created_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        })
    return backups

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"service": "streamvault-backup-agent", "version": "1.0.0"}

@app.get("/health")
async def health():
    """Auto-discovery endpoint. StreamVault pings this to detect the agent."""
    return {
        "status": "ok",
        "service": "streamvault-backup-agent",
        "hostname": get_hostname(),
        "port": AGENT_PORT,
        "backup_dir": str(BACKUP_DIR),
        "disk": get_disk_stats(),
        "backup_count": len(list_backup_files()),
    }

@app.get("/backups")
async def list_backups():
    """List all backups stored on this server."""
    return {
        "hostname": get_hostname(),
        "disk": get_disk_stats(),
        "backups": list_backup_files(),
    }

@app.post("/backups/receive")
async def receive_backup(file: UploadFile = File(...)):
    """Receive a backup archive from StreamVault."""
    if not file.filename.endswith(".tar.gz"):
        raise HTTPException(status_code=400, detail="Only .tar.gz files accepted")

    dest = BACKUP_DIR / file.filename
    size = 0
    sha256 = hashlib.sha256()

    async with aiofiles.open(dest, "wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)  # 1MB chunks
            if not chunk:
                break
            await out.write(chunk)
            sha256.update(chunk)
            size += len(chunk)

    return {
        "status": "ok",
        "filename": file.filename,
        "size_bytes": size,
        "size_mb": round(size / (1024**2), 1),
        "sha256": sha256.hexdigest(),
        "stored_at": str(dest),
    }

@app.get("/backups/{filename}/download")
async def download_backup(filename: str):
    """Download a backup file (for restore)."""
    filepath = BACKUP_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Backup not found")
    return FileResponse(str(filepath), media_type="application/gzip", filename=filename)

@app.delete("/backups/{filename}")
async def delete_backup(filename: str):
    """Delete a specific backup."""
    filepath = BACKUP_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Backup not found")
    filepath.unlink()
    return {"status": "deleted", "filename": filename}

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"\n  StreamVault Backup Agent")
    print(f"  Listening on port {AGENT_PORT}")
    print(f"  Backup directory: {BACKUP_DIR}\n")
    uvicorn.run(app, host="0.0.0.0", port=AGENT_PORT, log_level="info")
