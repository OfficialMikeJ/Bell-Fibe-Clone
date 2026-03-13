"""
APK version management — OTA (over-the-air) update system for the Android guide app.

Admin uploads a new .apk via POST /api/apk/upload.
Android app polls GET /api/apk/latest on startup and compares version_code.
If server version_code > app's hardcoded version_code → show native update dialog.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Header, Request
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorClient
from models.admin import Admin
from utils.security import verify_token
from datetime import datetime, timezone
from pathlib import Path
import shutil
import os

router = APIRouter(prefix="/api/apk", tags=["apk"])

APK_DIR = Path("/app/backend/uploads/apk")
APK_DIR.mkdir(parents=True, exist_ok=True)

_mongo = None


def get_client():
    global _mongo
    if _mongo is None:
        _mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return _mongo


async def get_db() -> AsyncIOMotorDatabase:
    return get_client()[os.environ.get("DB_NAME", "iptv_service")]


async def get_current_admin(authorization: str = Header(None), db: AsyncIOMotorDatabase = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    admin = await db.admins.find_one({"username": payload.get("sub")})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    return Admin(**admin)


# ─── Public: Android app checks this on startup ──────────────────────────────

@router.get("/latest")
async def get_latest_apk(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """
    Android app calls this on startup.
    Returns latest APK version info; app compares version_code to its own.
    """
    latest = await db.apk_releases.find_one(
        {}, {"_id": 0}, sort=[("version_code", -1)]
    )
    if not latest:
        return {"has_release": False}

    # Build absolute download URL so Android can download directly
    base = str(request.base_url).rstrip("/")
    relative = latest.get("download_url", "")
    absolute_url = f"{base}{relative}" if relative.startswith("/") else relative

    return {
        "has_release": True,
        "version": latest.get("version", "1.0.0"),
        "version_code": latest.get("version_code", 1),
        "download_url": absolute_url,
        "release_notes": latest.get("release_notes", ""),
        "required": latest.get("required", False),
        "uploaded_at": latest.get("uploaded_at", ""),
    }


# ─── Admin: upload a new APK release ─────────────────────────────────────────

@router.post("/upload")
async def upload_apk(
    file: UploadFile = File(...),
    version: str = Form(...),
    version_code: int = Form(...),
    release_notes: str = Form(default=""),
    required: bool = Form(default=False),
    admin: Admin = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Admin uploads a new APK file.
    Once uploaded, Android devices will be prompted to update within 30 seconds.
    """
    if not file.filename.endswith(".apk"):
        raise HTTPException(status_code=400, detail="File must be an .apk")

    # Check no duplicate version_code
    existing = await db.apk_releases.find_one({"version_code": version_code})
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Version code {version_code} already exists. Increment the version code."
        )

    filename = f"streamvault-v{version}.apk"
    dest = APK_DIR / filename

    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    download_url = f"/uploads/apk/{filename}"

    record = {
        "version": version,
        "version_code": version_code,
        "filename": filename,
        "download_url": download_url,
        "release_notes": release_notes,
        "required": required,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": admin.username,
        "file_size_bytes": dest.stat().st_size,
    }
    await db.apk_releases.insert_one(record)

    return {
        "message": f"APK v{version} uploaded. Android devices will be prompted to update.",
        "version": version,
        "version_code": version_code,
        "download_url": download_url,
        "file_size_mb": round(dest.stat().st_size / 1_048_576, 2),
    }


@router.get("/releases")
async def list_releases(
    admin: Admin = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Admin: list all uploaded APK releases."""
    releases = await db.apk_releases.find({}, {"_id": 0}).sort("version_code", -1).to_list(50)
    return releases


@router.delete("/release/{version_code}")
async def delete_release(
    version_code: int,
    admin: Admin = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Admin: delete an APK release record (does not delete the file)."""
    result = await db.apk_releases.delete_one({"version_code": version_code})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Release not found")
    return {"message": f"Release v{version_code} deleted"}
