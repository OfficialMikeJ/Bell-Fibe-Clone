from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from models.channel import Channel, ChannelCreate, ChannelUpdate
from typing import List
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
import os
import uuid
from pathlib import Path
import shutil

router = APIRouter(prefix="/api/channels", tags=["channels"])

UPLOAD_DIR = Path("/app/backend/uploads/logos")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

async def get_db():
    from server import db
    return db

@router.post("", response_model=Channel)
async def create_channel(channel: ChannelCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    channel_dict = channel.dict()
    channel_obj = Channel(**channel_dict)
    await db.channels.insert_one(channel_obj.dict())
    return channel_obj

@router.get("", response_model=List[Channel])
async def get_channels(db: AsyncIOMotorDatabase = Depends(get_db)):
    channels = await db.channels.find().to_list(1000)
    return [Channel(**channel) for channel in channels]

@router.get("/{channel_id}", response_model=Channel)
async def get_channel(channel_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    channel = await db.channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    return Channel(**channel)

@router.put("/{channel_id}", response_model=Channel)
async def update_channel(
    channel_id: str, 
    channel_update: ChannelUpdate, 
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    channel = await db.channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    update_data = channel_update.dict(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.channels.update_one({"id": channel_id}, {"$set": update_data})
    
    updated_channel = await db.channels.find_one({"id": channel_id})
    return Channel(**updated_channel)

@router.delete("/{channel_id}")
async def delete_channel(channel_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    result = await db.channels.delete_one({"id": channel_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Channel not found")
    return {"message": "Channel deleted successfully"}

@router.post("/upload-logo")
async def upload_logo(file: UploadFile = File(...)):
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Generate unique filename
    file_extension = file.filename.split('.')[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = UPLOAD_DIR / unique_filename
    
    # Save file
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"logo_path": f"/uploads/logos/{unique_filename}"}