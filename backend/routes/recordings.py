from fastapi import APIRouter, HTTPException, Depends, Header
from models.recording import Recording, RecordingCreate, RecordingUpdate
from models.admin import Admin
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from utils.security import verify_token, sign_media_url
from datetime import datetime

router = APIRouter(prefix="/api/recordings", tags=["recordings"])

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

@router.get("", response_model=List[Recording])
async def get_recordings(
    user_id: Optional[str] = None,
    device_id: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    query = {}
    if user_id:
        query["user_id"] = user_id
    if device_id:
        query["device_id"] = device_id
    if status:
        query["status"] = status
    items = await db.recordings.find(query).sort("created_at", -1).to_list(1000)
    return [Recording(**item) for item in items]

@router.get("/user/{user_id}", response_model=List[Recording])
async def get_user_recordings(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Public endpoint for users to fetch their recordings with signed playback URLs"""
    items = await db.recordings.find({"user_id": user_id}).sort("created_at", -1).to_list(100)
    result = []
    for item in items:
        rec = Recording(**item)
        # Sign file_path so the browser can stream CVR/media recordings securely
        if rec.file_path:
            base_path = rec.file_path.split('?')[0]   # strip any old token
            fname = base_path.split('/')[-1]
            if fname:
                rec.file_path = base_path + sign_media_url(fname)
        result.append(rec)
    return result

@router.post("", response_model=Recording)
async def create_recording(
    recording: RecordingCreate,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Create a CVR recording schedule (accessible by device/user)"""
    item = Recording(**recording.dict())
    await db.recordings.insert_one(item.dict())
    return item

@router.put("/{recording_id}", response_model=Recording)
async def update_recording(
    recording_id: str,
    update: RecordingUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    item = await db.recordings.find_one({"id": recording_id})
    if not item:
        raise HTTPException(status_code=404, detail="Recording not found")
    update_data = update.dict(exclude_unset=True)
    await db.recordings.update_one({"id": recording_id}, {"$set": update_data})
    updated = await db.recordings.find_one({"id": recording_id})
    return Recording(**updated)

@router.delete("/{recording_id}")
async def delete_recording(
    recording_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Delete recording - accessible by user or admin"""
    result = await db.recordings.delete_one({"id": recording_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recording not found")
    return {"message": "Recording deleted"}

@router.get("/stats/summary")
async def get_recording_stats(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    total = await db.recordings.count_documents({})
    scheduled = await db.recordings.count_documents({"status": "scheduled"})
    completed = await db.recordings.count_documents({"status": "completed"})
    failed = await db.recordings.count_documents({"status": "failed"})
    return {"total": total, "scheduled": scheduled, "completed": completed, "failed": failed}
