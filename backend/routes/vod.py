from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Header
from models.vod import VODItem, VODCreate, VODUpdate
from models.admin import Admin
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from utils.security import verify_token, sign_media_url
from datetime import datetime
from pathlib import Path
import shutil
import uuid

router = APIRouter(prefix="/api/vod", tags=["vod"])

BACKEND_DIR = Path(__file__).parent.parent
POSTER_DIR = BACKEND_DIR / "uploads" / "posters"
POSTER_DIR.mkdir(parents=True, exist_ok=True)

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

@router.get("", response_model=List[VODItem])
async def get_vod(
    category: Optional[str] = None,
    featured: Optional[bool] = None,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Public endpoint - list VOD catalog"""
    query = {}
    if category:
        query["category"] = category
    if featured is not None:
        query["is_featured"] = featured
    items = await db.vod_items.find(query).sort("created_at", -1).to_list(1000)
    result = []
    for item in items:
        vod = VODItem(**item)
        # Attach media info with signed URL
        if item.get('media_id'):
            media = await db.media_items.find_one({"id": item['media_id']})
            if media:
                vod.duration_formatted = media.get('duration_formatted')
                if not vod.poster_path:
                    vod.poster_path = media.get('poster_path')
                raw_path = media.get('file_path', '')
                fname = raw_path.split('/')[-1]
                if fname:
                    vod.media_file_path = f"/uploads/media/{fname}" + sign_media_url(fname)
        # Attach catalog poster if available
        if item.get('catalog_id') and not vod.poster_path:
            catalog = await db.media_catalog.find_one({"id": item['catalog_id']})
            if catalog:
                vod.poster_path = catalog.get('poster_path')
        result.append(vod)
    return result

@router.post("", response_model=VODItem)
async def create_vod(
    vod: VODCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    # Inherit poster from media if not set
    vod_item = VODItem(**vod.dict())
    if vod.media_id:
        media = await db.media_items.find_one({"id": vod.media_id})
        if media:
            vod_item.duration_formatted = media.get('duration_formatted')
            if not vod_item.poster_path:
                vod_item.poster_path = media.get('poster_path')
    await db.vod_items.insert_one(vod_item.dict())
    return vod_item

@router.put("/{vod_id}", response_model=VODItem)
async def update_vod(
    vod_id: str,
    update: VODUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    item = await db.vod_items.find_one({"id": vod_id})
    if not item:
        raise HTTPException(status_code=404, detail="VOD item not found")
    update_data = update.dict(exclude_unset=True)
    await db.vod_items.update_one({"id": vod_id}, {"$set": update_data})
    updated = await db.vod_items.find_one({"id": vod_id})
    return VODItem(**updated)

@router.post("/upload-poster/{vod_id}")
async def upload_vod_poster(
    vod_id: str,
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    suffix = Path(file.filename).suffix.lower()
    filename = f"{uuid.uuid4()}{suffix}"
    file_path = POSTER_DIR / filename
    server_path = f"/uploads/posters/{filename}"
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    await db.vod_items.update_one({"id": vod_id}, {"$set": {"poster_path": server_path}})
    return {"poster_path": server_path}

@router.delete("/{vod_id}")
async def delete_vod(
    vod_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    result = await db.vod_items.delete_one({"id": vod_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="VOD item not found")
    return {"message": "VOD item deleted"}
