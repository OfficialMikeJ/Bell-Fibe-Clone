from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Header
from models.media import MediaItem, MediaCreate, MediaUpdate
from models.admin import Admin
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from utils.security import verify_token
from utils.media_utils import analyze_media_file, is_ffmpeg_available
from datetime import datetime
from pathlib import Path
import shutil
import uuid

router = APIRouter(prefix="/api/media", tags=["media"])

MEDIA_DIR = Path("/app/backend/uploads/media")
POSTER_DIR = Path("/app/backend/uploads/posters")
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
POSTER_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_VIDEO = {'.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.m4v', '.ts', '.m3u8'}
ALLOWED_IMAGE = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}

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
    admin = await db.admins.find_one({"username": payload.get("sub")})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    return Admin(**admin)

@router.get("", response_model=List[MediaItem])
async def get_media(
    media_type: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    query = {}
    if media_type:
        query["media_type"] = media_type
    items = await db.media_items.find(query).sort("created_at", -1).to_list(1000)
    return [MediaItem(**item) for item in items]

@router.post("", response_model=MediaItem)
async def create_media(
    media: MediaCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    item = MediaItem(**media.dict())
    await db.media_items.insert_one(item.dict())
    return item

@router.post("/upload-file", response_model=MediaItem)
async def upload_media_file(
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_VIDEO:
        raise HTTPException(status_code=400, detail=f"Unsupported video format. Allowed: {', '.join(ALLOWED_VIDEO)}")

    file_id = str(uuid.uuid4())
    filename = f"{file_id}{suffix}"
    file_path = MEDIA_DIR / filename
    server_path = f"/uploads/media/{filename}"

    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Analyze with FFmpeg
    meta = analyze_media_file(str(file_path))

    title = Path(file.filename).stem.replace('_', ' ').replace('-', ' ').title()
    item = MediaItem(
        title=title,
        file_path=server_path,
        duration_seconds=meta.get('duration_seconds'),
        duration_formatted=meta.get('duration_formatted'),
        duration_minutes=meta.get('duration_minutes'),
        resolution=meta.get('resolution'),
        fps=meta.get('fps'),
        quality_label=meta.get('quality_label', '1080p'),
        file_size=meta.get('file_size'),
    )
    await db.media_items.insert_one(item.dict())
    return item

@router.post("/upload-poster/{media_id}")
async def upload_poster(
    media_id: str,
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_IMAGE:
        raise HTTPException(status_code=400, detail="File must be an image")

    filename = f"{uuid.uuid4()}{suffix}"
    file_path = POSTER_DIR / filename
    server_path = f"/uploads/posters/{filename}"

    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    await db.media_items.update_one(
        {"id": media_id},
        {"$set": {"poster_path": server_path, "updated_at": datetime.utcnow()}}
    )
    return {"poster_path": server_path}

@router.get("/{media_id}", response_model=MediaItem)
async def get_media_item(
    media_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    item = await db.media_items.find_one({"id": media_id})
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")
    return MediaItem(**item)

@router.put("/{media_id}", response_model=MediaItem)
async def update_media(
    media_id: str,
    update: MediaUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    item = await db.media_items.find_one({"id": media_id})
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")
    update_data = update.dict(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()
    await db.media_items.update_one({"id": media_id}, {"$set": update_data})
    updated = await db.media_items.find_one({"id": media_id})
    return MediaItem(**updated)

@router.delete("/{media_id}")
async def delete_media(
    media_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    item = await db.media_items.find_one({"id": media_id})
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")
    # Delete physical files
    for path_field in ['file_path', 'poster_path']:
        if item.get(path_field):
            full_path = Path(f"/app/backend{item[path_field]}")
            if full_path.exists():
                full_path.unlink()
    await db.media_items.delete_one({"id": media_id})
    return {"message": "Media deleted"}

@router.post("/{media_id}/reanalyze", response_model=MediaItem)
async def reanalyze_media(
    media_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    item = await db.media_items.find_one({"id": media_id})
    if not item or not item.get('file_path'):
        raise HTTPException(status_code=404, detail="Media item or file not found")
    full_path = f"/app/backend{item['file_path']}"
    meta = analyze_media_file(full_path)
    if meta:
        await db.media_items.update_one({"id": media_id}, {"$set": {**meta, "updated_at": datetime.utcnow()}})
    updated = await db.media_items.find_one({"id": media_id})
    return MediaItem(**updated)
