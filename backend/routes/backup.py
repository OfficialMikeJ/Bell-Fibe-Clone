"""
StreamVault Backup Management
─────────────────────────────
Manages backup servers, triggers full backups (DB + media + config),
auto-switches servers at threshold, and streams progress via WebSocket.
"""

import os
import shutil
import asyncio
import tarfile
import tempfile
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, List

import httpx
import aiofiles
from fastapi import APIRouter, HTTPException, Depends, Header, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from models.admin import Admin
from utils.security import verify_token

router = APIRouter(prefix="/api/backup", tags=["backup"])

BACKEND_DIR = Path(__file__).parent.parent
UPLOADS_DIR = BACKEND_DIR / "uploads"

# Active WebSocket connections for log streaming
active_ws_connections: List[WebSocket] = []
backup_log: List[str] = []

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

# ── Models ────────────────────────────────────────────────────────────────────
class BackupServerAdd(BaseModel):
    address: str  # IP:port or hostname:port
    name: Optional[str] = None

class BackupServerUpdate(BaseModel):
    name: Optional[str] = None
    is_primary: Optional[bool] = None
    threshold_percent: Optional[float] = None

# ── Log Helper ────────────────────────────────────────────────────────────────
async def log(msg: str):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    entry = f"[{ts}] {msg}"
    backup_log.append(entry)
    if len(backup_log) > 500:
        backup_log.pop(0)
    for ws in active_ws_connections[:]:
        try:
            await ws.send_text(entry)
        except Exception:
            active_ws_connections.remove(ws)

# ── WebSocket for live logs ───────────────────────────────────────────────────
@router.websocket("/ws/logs")
async def backup_logs_ws(ws: WebSocket):
    await ws.accept()
    active_ws_connections.append(ws)
    try:
        # Send existing log history
        for entry in backup_log[-100:]:
            await ws.send_text(entry)
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if ws in active_ws_connections:
            active_ws_connections.remove(ws)

# ── Server Management ─────────────────────────────────────────────────────────
@router.post("/servers")
async def add_backup_server(
    server: BackupServerAdd,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """Add a backup server by address — auto-detects via /health endpoint."""
    address = server.address.strip().rstrip("/")
    if not address.startswith("http"):
        address = f"http://{address}"

    # Ping the agent
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{address}/health")
            resp.raise_for_status()
            info = resp.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot reach backup agent at {address}: {str(e)}")

    if info.get("service") != "streamvault-backup-agent":
        raise HTTPException(status_code=400, detail="Not a StreamVault backup agent")

    # Check if already registered
    existing = await db.backup_servers.find_one({"address": address})
    if existing:
        raise HTTPException(status_code=400, detail="Server already registered")

    # Count existing servers to set first as primary
    count = await db.backup_servers.count_documents({})

    doc = {
        "address": address,
        "name": server.name or info.get("hostname", address),
        "hostname": info.get("hostname", ""),
        "port": info.get("port", 9500),
        "backup_dir": info.get("backup_dir", ""),
        "is_primary": count == 0,
        "threshold_percent": 85.0,
        "disk": info.get("disk", {}),
        "backup_count": info.get("backup_count", 0),
        "status": "online",
        "added_at": datetime.now(timezone.utc).isoformat(),
        "last_seen": datetime.now(timezone.utc).isoformat(),
    }

    await db.backup_servers.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.get("/servers")
async def list_backup_servers(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """List all registered backup servers with live status."""
    servers = await db.backup_servers.find({}, {"_id": 0}).to_list(100)

    # Refresh status for each
    for srv in servers:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{srv['address']}/health")
                info = resp.json()
                srv["status"] = "online"
                srv["disk"] = info.get("disk", {})
                srv["backup_count"] = info.get("backup_count", 0)
                srv["last_seen"] = datetime.now(timezone.utc).isoformat()
                await db.backup_servers.update_one(
                    {"address": srv["address"]},
                    {"$set": {"status": "online", "disk": srv["disk"], "backup_count": srv["backup_count"], "last_seen": srv["last_seen"]}}
                )
        except Exception:
            srv["status"] = "offline"
            await db.backup_servers.update_one(
                {"address": srv["address"]},
                {"$set": {"status": "offline"}}
            )

    return servers

@router.put("/servers/{address_encoded}")
async def update_backup_server(
    address_encoded: str,
    update: BackupServerUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """Update server settings (name, primary, threshold)."""
    address = address_encoded.replace("|", "/")
    update_data = update.dict(exclude_unset=True)

    if update.is_primary:
        # Unset all others as primary
        await db.backup_servers.update_many({}, {"$set": {"is_primary": False}})

    await db.backup_servers.update_one({"address": address}, {"$set": update_data})
    return {"status": "updated"}

@router.delete("/servers/{address_encoded}")
async def remove_backup_server(
    address_encoded: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """Remove a backup server."""
    address = address_encoded.replace("|", "/")
    result = await db.backup_servers.delete_one({"address": address})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Server not found")
    return {"status": "removed"}

# ── Backup Execution ──────────────────────────────────────────────────────────
async def select_target_server(db) -> dict:
    """Pick the primary server, or auto-switch if over threshold."""
    servers = await db.backup_servers.find({}, {"_id": 0}).sort("added_at", 1).to_list(100)
    if not servers:
        return None

    primary = next((s for s in servers if s.get("is_primary")), servers[0])

    # Check if primary is over threshold
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{primary['address']}/health")
            info = resp.json()
            used_pct = info.get("disk", {}).get("used_percent", 0)
            threshold = primary.get("threshold_percent", 85.0)

            if used_pct >= threshold:
                # Find next available server under threshold
                for srv in servers:
                    if srv["address"] == primary["address"]:
                        continue
                    try:
                        resp2 = await client.get(f"{srv['address']}/health")
                        info2 = resp2.json()
                        if info2.get("disk", {}).get("used_percent", 0) < srv.get("threshold_percent", 85.0):
                            await log(f"Primary server at {used_pct}% — auto-switching to {srv['name']}")
                            await db.backup_servers.update_many({}, {"$set": {"is_primary": False}})
                            await db.backup_servers.update_one({"address": srv["address"]}, {"$set": {"is_primary": True}})
                            return srv
                    except Exception:
                        continue
                await log("WARNING: All backup servers above threshold!")
    except Exception:
        await log(f"WARNING: Cannot reach primary server {primary['name']}")

    return primary

backup_in_progress = False

@router.post("/run")
async def run_backup(
    target_address: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """Trigger a full backup (DB + media + config). Runs in background."""
    global backup_in_progress
    if backup_in_progress:
        raise HTTPException(status_code=409, detail="Backup already in progress")

    if target_address:
        target_address = target_address.strip().rstrip("/")
        if not target_address.startswith("http"):
            target_address = f"http://{target_address}"
        srv = await db.backup_servers.find_one({"address": target_address}, {"_id": 0})
        if not srv:
            raise HTTPException(status_code=404, detail="Target server not registered")
    else:
        srv = await select_target_server(db)
        if not srv:
            raise HTTPException(status_code=400, detail="No backup servers configured")

    asyncio.create_task(execute_backup(srv, db))
    return {"status": "started", "target": srv["name"], "address": srv["address"]}

async def execute_backup(server: dict, db):
    """Full backup: mongodump + tar uploads + send to agent."""
    global backup_in_progress
    backup_in_progress = True
    backup_log.clear()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    archive_name = f"streamvault_backup_{timestamp}.tar.gz"
    tmp_dir = None

    try:
        await log(f"Starting full backup to {server['name']} ({server['address']})")

        tmp_dir = tempfile.mkdtemp(prefix="sv_backup_")
        backup_path = Path(tmp_dir)

        # 1. MongoDB dump
        await log("Dumping MongoDB database...")
        db_name = os.environ.get("DB_NAME", "iptv_service")
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        dump_dir = backup_path / "mongodump"
        dump_dir.mkdir()

        proc = await asyncio.create_subprocess_exec(
            "mongodump", f"--uri={mongo_url}", f"--db={db_name}", f"--out={dump_dir}",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            await log(f"ERROR: mongodump failed: {stderr.decode()}")
            return
        await log("MongoDB dump complete")

        # 2. Copy uploads
        await log("Copying media files...")
        if UPLOADS_DIR.exists():
            uploads_dest = backup_path / "uploads"
            shutil.copytree(str(UPLOADS_DIR), str(uploads_dest))
            total_files = sum(1 for _ in uploads_dest.rglob("*") if _.is_file())
            total_size = sum(f.stat().st_size for f in uploads_dest.rglob("*") if f.is_file())
            await log(f"Copied {total_files} files ({round(total_size / (1024**2), 1)} MB)")
        else:
            await log("No uploads directory found — skipping")

        # 3. Copy .env files
        await log("Copying configuration files...")
        config_dir = backup_path / "config"
        config_dir.mkdir()
        for env_file in [BACKEND_DIR / ".env", BACKEND_DIR.parent / "frontend" / ".env"]:
            if env_file.exists():
                shutil.copy2(str(env_file), str(config_dir / env_file.name))
        await log("Config files copied")

        # 4. Create tar.gz archive
        await log(f"Compressing backup archive: {archive_name}")
        archive_path = Path(tmp_dir) / archive_name
        with tarfile.open(str(archive_path), "w:gz") as tar:
            tar.add(str(backup_path / "mongodump"), arcname="mongodump")
            if (backup_path / "uploads").exists():
                tar.add(str(backup_path / "uploads"), arcname="uploads")
            tar.add(str(backup_path / "config"), arcname="config")

        archive_size = archive_path.stat().st_size
        await log(f"Archive created: {round(archive_size / (1024**2), 1)} MB")

        # 5. Upload to backup server
        await log(f"Uploading to {server['name']}...")
        async with httpx.AsyncClient(timeout=httpx.Timeout(600.0, connect=30.0)) as client:
            with open(str(archive_path), "rb") as f:
                resp = await client.post(
                    f"{server['address']}/backups/receive",
                    files={"file": (archive_name, f, "application/gzip")}
                )
                resp.raise_for_status()
                result = resp.json()

        await log(f"Upload complete — SHA256: {result.get('sha256', 'n/a')}")
        await log("Backup finished successfully!")

        # Record in DB
        await db.backup_history.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "archive_name": archive_name,
            "size_bytes": archive_size,
            "target_server": server["name"],
            "target_address": server["address"],
            "sha256": result.get("sha256", ""),
            "status": "success",
        })

    except Exception as e:
        await log(f"ERROR: Backup failed — {str(e)}")
        await db.backup_history.insert_one({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "archive_name": archive_name,
            "target_server": server.get("name", "unknown"),
            "target_address": server.get("address", "unknown"),
            "status": "failed",
            "error": str(e),
        })
    finally:
        if tmp_dir and os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir, ignore_errors=True)
        backup_in_progress = False

# ── Restore ───────────────────────────────────────────────────────────────────
@router.post("/restore")
async def restore_backup(
    server_address: str,
    filename: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """Download a backup from a server and restore it."""
    global backup_in_progress
    if backup_in_progress:
        raise HTTPException(status_code=409, detail="Backup/restore already in progress")

    if not server_address.startswith("http"):
        server_address = f"http://{server_address}"

    asyncio.create_task(execute_restore(server_address, filename, db))
    return {"status": "restore_started", "filename": filename}

async def execute_restore(server_address: str, filename: str, db):
    global backup_in_progress
    backup_in_progress = True
    backup_log.clear()
    tmp_dir = None

    try:
        await log(f"Starting restore of {filename} from {server_address}")

        tmp_dir = tempfile.mkdtemp(prefix="sv_restore_")

        # 1. Download archive
        await log("Downloading backup archive...")
        archive_path = Path(tmp_dir) / filename
        async with httpx.AsyncClient(timeout=httpx.Timeout(600.0, connect=30.0)) as client:
            async with client.stream("GET", f"{server_address}/backups/{filename}/download") as resp:
                resp.raise_for_status()
                async with aiofiles.open(str(archive_path), "wb") as out:
                    async for chunk in resp.aiter_bytes(1024 * 1024):
                        await out.write(chunk)

        await log(f"Downloaded: {round(archive_path.stat().st_size / (1024**2), 1)} MB")

        # 2. Extract
        await log("Extracting archive...")
        extract_dir = Path(tmp_dir) / "extracted"
        extract_dir.mkdir()
        with tarfile.open(str(archive_path), "r:gz") as tar:
            tar.extractall(str(extract_dir))
        await log("Extraction complete")

        # 3. Restore MongoDB
        dump_dir = extract_dir / "mongodump"
        if dump_dir.exists():
            await log("Restoring MongoDB database...")
            db_name = os.environ.get("DB_NAME", "iptv_service")
            mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
            dump_subdir = dump_dir / db_name
            if dump_subdir.exists():
                proc = await asyncio.create_subprocess_exec(
                    "mongorestore", f"--uri={mongo_url}", f"--db={db_name}",
                    "--drop", str(dump_subdir),
                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
                )
                stdout, stderr = await proc.communicate()
                if proc.returncode != 0:
                    await log(f"ERROR: mongorestore failed: {stderr.decode()}")
                else:
                    await log("MongoDB restore complete")
            else:
                await log(f"WARNING: No dump found for database '{db_name}'")

        # 4. Restore uploads
        uploads_src = extract_dir / "uploads"
        if uploads_src.exists():
            await log("Restoring media files...")
            if UPLOADS_DIR.exists():
                shutil.rmtree(str(UPLOADS_DIR))
            shutil.copytree(str(uploads_src), str(UPLOADS_DIR))
            await log("Media files restored")

        # 5. Restore config
        config_src = extract_dir / "config"
        if config_src.exists():
            await log("Restoring configuration...")
            for cfg in config_src.iterdir():
                if cfg.name == ".env":
                    shutil.copy2(str(cfg), str(BACKEND_DIR / ".env"))
            await log("Configuration restored")

        await log("Restore completed successfully!")

    except Exception as e:
        await log(f"ERROR: Restore failed — {str(e)}")
    finally:
        if tmp_dir and os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir, ignore_errors=True)
        backup_in_progress = False

# ── Status & History ──────────────────────────────────────────────────────────
@router.get("/status")
async def backup_status(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    return {
        "in_progress": backup_in_progress,
        "log": backup_log[-100:],
    }

@router.get("/history")
async def backup_history(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    history = await db.backup_history.find({}, {"_id": 0}).sort("timestamp", -1).to_list(50)
    return history

@router.get("/server-backups/{address_encoded}")
async def list_server_backups(
    address_encoded: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """List backups stored on a specific server."""
    address = address_encoded.replace("|", "/")
    if not address.startswith("http"):
        address = f"http://{address}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{address}/backups")
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Cannot reach server: {str(e)}")
