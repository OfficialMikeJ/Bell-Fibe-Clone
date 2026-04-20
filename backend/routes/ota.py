"""
OTA (Over-The-Air) Android Auto-Update System
Extends the existing APK management with:
- Device version reporting
- Update status dashboard
- Push notification tracking
"""
from fastapi import APIRouter, HTTPException, Depends, Header, UploadFile, File
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from typing import Optional, List
from models.admin import Admin
from utils.security import verify_token
from datetime import datetime, timezone
from pathlib import Path
import os
import uuid
import shutil

router = APIRouter(prefix="/api/ota", tags=["ota"])

BACKEND_DIR = Path(__file__).parent.parent
APK_DIR = BACKEND_DIR / "uploads" / "apk"
APK_DIR.mkdir(parents=True, exist_ok=True)


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


class APKRelease(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    version_name: str          # e.g. "0.94.0.1"
    version_code: int          # Integer build number, e.g. 1
    release_notes: str = ""
    file_path: Optional[str] = None
    file_size_bytes: Optional[int] = None
    is_active: bool = False    # Only one release is active at a time
    released_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class VersionReport(BaseModel):
    device_id: str
    installed_version: str     # e.g. "0.94.0.1"
    version_code: int


# ── APK Management ────────────────────────────────────────────────────────────

@router.get("/releases")
async def list_releases(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    docs = await db.apk_releases.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return docs


@router.post("/releases")
async def create_release(
    version_name: str,
    version_code: int,
    release_notes: str = "",
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    release = APKRelease(
        version_name=version_name,
        version_code=version_code,
        release_notes=release_notes,
    )
    doc = release.dict()
    await db.apk_releases.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.post("/releases/{release_id}/upload")
async def upload_apk(
    release_id: str,
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if not file.filename.endswith(".apk"):
        raise HTTPException(status_code=400, detail="File must be an .apk")

    release = await db.apk_releases.find_one({"id": release_id}, {"_id": 0})
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")

    safe_name = f"streamvault_{release['version_name'].replace('.', '_')}.apk"
    dest = APK_DIR / safe_name
    with dest.open("wb") as buf:
        shutil.copyfileobj(file.file, buf)

    file_size = dest.stat().st_size
    await db.apk_releases.update_one(
        {"id": release_id},
        {"$set": {"file_path": f"/uploads/apk/{safe_name}", "file_size_bytes": file_size}}
    )
    doc = await db.apk_releases.find_one({"id": release_id}, {"_id": 0})
    return doc


@router.post("/releases/{release_id}/activate")
async def activate_release(
    release_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Mark a release as the active version — all devices will be prompted to update"""
    release = await db.apk_releases.find_one({"id": release_id}, {"_id": 0})
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")
    if not release.get("file_path"):
        raise HTTPException(status_code=400, detail="APK file must be uploaded before activating")

    # Deactivate all others
    await db.apk_releases.update_many({}, {"$set": {"is_active": False}})
    # Activate this one
    now = datetime.now(timezone.utc).isoformat()
    await db.apk_releases.update_one(
        {"id": release_id},
        {"$set": {"is_active": True, "released_at": now}}
    )
    doc = await db.apk_releases.find_one({"id": release_id}, {"_id": 0})
    return doc


@router.delete("/releases/{release_id}")
async def delete_release(
    release_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    await db.apk_releases.delete_one({"id": release_id})
    return {"message": "Release deleted"}


# ── Public endpoint — Android app polls this ──────────────────────────────────

@router.get("/latest")
async def get_latest_release(db: AsyncIOMotorDatabase = Depends(get_db)):
    """Android app polls this to check for updates"""
    doc = await db.apk_releases.find_one({"is_active": True}, {"_id": 0})
    if not doc:
        return {"has_update": False, "version_name": None, "version_code": 0, "download_url": None}

    backend_url = os.environ.get("BACKEND_URL", "")
    download_url = f"{backend_url}/api{doc['file_path']}" if doc.get("file_path") else None

    return {
        "has_update": True,
        "version_name": doc["version_name"],
        "version_code": doc["version_code"],
        "release_notes": doc.get("release_notes", ""),
        "download_url": download_url,
        "released_at": doc.get("released_at"),
    }


# ── Device version reporting ─────────────────────────────────────────────────

@router.post("/report-version")
async def report_installed_version(
    data: VersionReport,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Called by Android app after install to report its current version"""
    await db.devices.update_one(
        {"device_id": data.device_id},
        {"$set": {
            "installed_app_version": data.installed_version,
            "installed_version_code": data.version_code,
            "version_reported_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"message": "Version reported"}


# ── Admin status dashboard ────────────────────────────────────────────────────

@router.get("/status")
async def get_update_status(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Shows how many devices are on the latest version"""
    active = await db.apk_releases.find_one({"is_active": True}, {"_id": 0})
    if not active:
        return {"active_version": None, "total_devices": 0, "up_to_date": 0, "needs_update": 0, "unknown": 0}

    devices = await db.devices.find({}, {"_id": 0, "device_id": 1, "installed_app_version": 1, "installed_version_code": 1}).to_list(10000)
    total = len(devices)
    up_to_date = sum(1 for d in devices if d.get("installed_version_code") == active["version_code"])
    has_old = sum(1 for d in devices if d.get("installed_version_code") and d.get("installed_version_code") != active["version_code"])
    unknown = total - up_to_date - has_old

    return {
        "active_version": active["version_name"],
        "active_version_code": active["version_code"],
        "total_devices": total,
        "up_to_date": up_to_date,
        "needs_update": has_old,
        "unknown": unknown,
    }

