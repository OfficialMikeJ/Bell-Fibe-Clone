"""
Server Migration / Backup & Restore System
- GET  /api/admin/backup        → download full system backup (.tar.gz)
- POST /api/admin/restore       → upload backup archive and restore
- GET  /api/admin/backup-status → check restore progress
"""
import os
import io
import json
import tarfile
import tempfile
import shutil
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends, Header, UploadFile, File
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from models.admin import Admin
from utils.security import verify_token
from typing import Optional

router = APIRouter(prefix="/api/admin", tags=["migration"])

UPLOADS_DIR = Path("/app/backend/uploads")
_restore_status = {"running": False, "message": "", "done": False, "error": ""}


async def get_db():
    from server import db
    return db


async def get_current_admin(
    authorization: Optional[str] = Header(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    admin = await db.admins.find_one({"email": payload.get("sub")})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    return Admin(**admin)


# Collections to include in backup (exclude system collections)
BACKUP_COLLECTIONS = [
    "admins", "users", "customer_accounts", "channels", "epg_programs",
    "devices", "media_items", "vod_items", "notifications", "recordings",
    "tickets", "faqs", "portal_sessions", "home_posts", "media_catalog",
    "app_version", "apk_versions", "service_configs", "guide_state",
    "pin_attempt_log",
]


@router.get("/backup")
async def create_backup(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Create and download a full system backup as .tar.gz"""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    archive_name = f"streamvault_backup_{timestamp}.tar.gz"

    # Export all MongoDB collections to JSON in memory
    db_export = {}
    for col_name in BACKUP_COLLECTIONS:
        try:
            docs = await db[col_name].find({}, {"_id": 0}).to_list(100000)
            db_export[col_name] = docs
        except Exception:
            db_export[col_name] = []

    # Build tar.gz in memory
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        # Add database JSON
        db_json = json.dumps(db_export, default=str, indent=2).encode("utf-8")
        db_info = tarfile.TarInfo(name="database/collections.json")
        db_info.size = len(db_json)
        tar.addfile(db_info, io.BytesIO(db_json))

        # Add manifest
        manifest = {
            "version": "1.0",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "collections": {k: len(v) for k, v in db_export.items()},
            "uploads_included": UPLOADS_DIR.exists(),
        }
        manifest_json = json.dumps(manifest, indent=2).encode("utf-8")
        mf_info = tarfile.TarInfo(name="manifest.json")
        mf_info.size = len(manifest_json)
        tar.addfile(mf_info, io.BytesIO(manifest_json))

        # Add uploads directory (media, logos, APKs, catalog images, etc.)
        if UPLOADS_DIR.exists():
            for file_path in UPLOADS_DIR.rglob("*"):
                if file_path.is_file():
                    arcname = f"uploads/{file_path.relative_to(UPLOADS_DIR)}"
                    tar.add(str(file_path), arcname=arcname)

    buf.seek(0)
    content = buf.read()

    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/gzip",
        headers={
            "Content-Disposition": f'attachment; filename="{archive_name}"',
            "Content-Length": str(len(content)),
            "X-Backup-Size": str(len(content)),
        },
    )


@router.post("/restore")
async def restore_backup(
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Restore system from a backup archive"""
    global _restore_status
    if _restore_status["running"]:
        raise HTTPException(status_code=409, detail="Restore already in progress")

    if not file.filename.endswith((".tar.gz", ".tgz")):
        raise HTTPException(status_code=400, detail="File must be a .tar.gz archive")

    _restore_status = {"running": True, "message": "Reading archive...", "done": False, "error": ""}

    try:
        content = await file.read()
        buf = io.BytesIO(content)

        with tarfile.open(fileobj=buf, mode="r:gz") as tar:
            # Validate manifest
            try:
                mf = tar.getmember("manifest.json")
                json.loads(tar.extractfile(mf).read())  # validate manifest exists
            except KeyError:
                raise HTTPException(status_code=400, detail="Invalid backup: missing manifest.json")

            _restore_status["message"] = "Restoring database..."

            # Restore database
            try:
                db_member = tar.getmember("database/collections.json")
                db_export = json.loads(tar.extractfile(db_member).read())
                for col_name, docs in db_export.items():
                    if not docs:
                        continue
                    await db[col_name].delete_many({})
                    await db[col_name].insert_many(docs)
            except KeyError:
                pass

            _restore_status["message"] = "Restoring uploads..."

            # Restore uploads
            if UPLOADS_DIR.exists():
                shutil.rmtree(str(UPLOADS_DIR))
            UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

            for member in tar.getmembers():
                if member.name.startswith("uploads/") and member.isfile():
                    rel = member.name[len("uploads/"):]
                    dest = UPLOADS_DIR / rel
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    with tar.extractfile(member) as src_f:
                        dest.write_bytes(src_f.read())

        _restore_status = {
            "running": False, "done": True,
            "message": f"Restore complete. {len(db_export)} collections restored.",
            "error": ""
        }
        return {"message": "Restore complete", "collections": len(db_export)}

    except HTTPException:
        raise
    except Exception as e:
        _restore_status = {"running": False, "done": False, "message": "", "error": str(e)}
        raise HTTPException(status_code=500, detail=f"Restore failed: {e}")


@router.get("/backup-status")
async def get_restore_status(admin: Admin = Depends(get_current_admin)):
    return _restore_status


@router.get("/auto-backups")
async def list_auto_backups(admin: Admin = Depends(get_current_admin)):
    """List all auto-generated nightly backups stored on disk."""
    from utils.scheduler import BACKUPS_DIR
    if not BACKUPS_DIR.exists():
        return []
    backups = sorted(BACKUPS_DIR.glob("auto_backup_*.tar.gz"), reverse=True)
    result = []
    for b in backups:
        stat = b.stat()
        result.append({
            "filename": b.name,
            "size_bytes": stat.st_size,
            "size_mb": round(stat.st_size / (1024 * 1024), 2),
            "created_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        })
    return result


@router.get("/auto-backups/{filename}")
async def download_auto_backup(filename: str, admin: Admin = Depends(get_current_admin)):
    """Download a specific auto-backup file."""
    from utils.scheduler import BACKUPS_DIR
    file_path = BACKUPS_DIR / filename
    if not file_path.exists() or not filename.endswith(".tar.gz"):
        raise HTTPException(status_code=404, detail="Backup file not found")
    content = file_path.read_bytes()
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/gzip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(content)),
        },
    )


@router.post("/auto-backups/run-now")
async def run_backup_now(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Trigger the auto-backup immediately (without downloading)."""
    from utils.scheduler import run_scheduled_backup
    await run_scheduled_backup(db)
    from utils.scheduler import BACKUPS_DIR
    backups = sorted(BACKUPS_DIR.glob("auto_backup_*.tar.gz"), reverse=True)
    latest = backups[0].name if backups else None
    return {"message": "Backup created successfully", "filename": latest}
