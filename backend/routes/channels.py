from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Header
from models.channel import Channel, ChannelCreate, ChannelUpdate
from models.admin import Admin
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
import os
import uuid
from pathlib import Path
import shutil
from utils.security import sign_media_url, verify_token

router = APIRouter(prefix="/api/channels", tags=["channels"])

BACKEND_DIR = Path(__file__).parent.parent
UPLOAD_DIR = BACKEND_DIR / "uploads" / "logos"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

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

@router.post("", response_model=Channel)
async def create_channel(channel: ChannelCreate, db: AsyncIOMotorDatabase = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    channel_dict = channel.dict()
    channel_obj = Channel(**channel_dict)
    await db.channels.insert_one(channel_obj.dict())
    return channel_obj

@router.get("", response_model=List[Channel])
async def get_channels(db: AsyncIOMotorDatabase = Depends(get_db)):
    """Public: returns visible channels only"""
    channels = await db.channels.find({"hidden": {"$ne": True}}).sort("number", 1).to_list(1000)
    result = []
    for ch in channels:
        obj = Channel(**ch)
        if ch.get("media_id"):
            media = await db.media_items.find_one({"id": ch["media_id"]}, {"_id": 0})
            if media:
                raw_path = media.get("file_path", "")
                fname = raw_path.split("/")[-1]
                obj.media_file_path = f"/uploads/media/{fname}" + sign_media_url(fname)
        result.append(obj)
    return result

@router.get("/admin/all", response_model=List[Channel])
async def get_all_channels(db: AsyncIOMotorDatabase = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    """Admin: returns ALL channels including hidden ones"""
    channels = await db.channels.find().sort("number", 1).to_list(1000)
    result = []
    for ch in channels:
        obj = Channel(**ch)
        if ch.get("media_id"):
            media = await db.media_items.find_one({"id": ch["media_id"]}, {"_id": 0})
            if media:
                raw_path = media.get("file_path", "")
                fname = raw_path.split("/")[-1]
                obj.media_file_path = f"/uploads/media/{fname}" + sign_media_url(fname)
        result.append(obj)
    return result

@router.get("/{channel_id}", response_model=Channel)
async def get_channel(channel_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    channel = await db.channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    obj = Channel(**channel)
    if channel.get("media_id"):
        media = await db.media_items.find_one({"id": channel["media_id"]}, {"_id": 0})
        if media:
            raw_path = media.get("file_path", "")
            fname = raw_path.split("/")[-1]
            obj.media_file_path = f"/uploads/media/{fname}" + sign_media_url(fname)
    return obj

@router.put("/{channel_id}", response_model=Channel)
async def update_channel(
    channel_id: str, 
    channel_update: ChannelUpdate, 
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    channel = await db.channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    update_data = channel_update.dict(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.channels.update_one({"id": channel_id}, {"$set": update_data})
    
    updated_channel = await db.channels.find_one({"id": channel_id})
    return Channel(**updated_channel)

@router.delete("/{channel_id}")
async def delete_channel(channel_id: str, db: AsyncIOMotorDatabase = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    result = await db.channels.delete_one({"id": channel_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Channel not found")
    return {"message": "Channel deleted successfully"}

@router.post("/upload-logo")
async def upload_logo(file: UploadFile = File(...), admin: Admin = Depends(get_current_admin)):
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    file_extension = file.filename.split('.')[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = UPLOAD_DIR / unique_filename
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"logo_path": f"/uploads/logos/{unique_filename}"}
