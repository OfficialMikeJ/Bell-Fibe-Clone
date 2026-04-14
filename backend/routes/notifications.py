from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Header
from models.notification import Notification, NotificationCreate, NotificationUpdate
from models.admin import Admin
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from utils.security import verify_token
from datetime import datetime
from pathlib import Path
import shutil
import uuid

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

NOTIF_IMG_DIR = Path("/app/backend/uploads/notifications")
NOTIF_IMG_DIR.mkdir(parents=True, exist_ok=True)

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

@router.get("", response_model=List[Notification])
async def get_notifications(
    active_only: bool = True,
    type: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Public endpoint - get notifications"""
    query = {}
    if active_only:
        query["is_active"] = True
    if type:
        query["type"] = type
    items = await db.notifications.find(query).sort("created_at", -1).to_list(100)
    return [Notification(**item) for item in items]

@router.post("", response_model=Notification)
async def create_notification(
    notif: NotificationCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    item = Notification(**notif.dict())
    await db.notifications.insert_one(item.dict())
    return item

@router.put("/{notif_id}", response_model=Notification)
async def update_notification(
    notif_id: str,
    update: NotificationUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    item = await db.notifications.find_one({"id": notif_id})
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found")
    update_data = update.dict(exclude_unset=True)
    await db.notifications.update_one({"id": notif_id}, {"$set": update_data})
    updated = await db.notifications.find_one({"id": notif_id})
    return Notification(**updated)

@router.post("/upload-image/{notif_id}")
async def upload_notification_image(
    notif_id: str,
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    suffix = Path(file.filename).suffix.lower()
    filename = f"{uuid.uuid4()}{suffix}"
    file_path = NOTIF_IMG_DIR / filename
    server_path = f"/uploads/notifications/{filename}"
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    await db.notifications.update_one({"id": notif_id}, {"$set": {"image_path": server_path}})
    return {"image_path": server_path}

@router.delete("/{notif_id}")
async def delete_notification(
    notif_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    result = await db.notifications.delete_one({"id": notif_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification deleted"}
