from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Header
from motor.motor_asyncio import AsyncIOMotorDatabase
from models.service_config import ServiceConfig, ServiceConfigUpdate
from models.admin import AdminCreate, Admin
from utils.security import get_password_hash, verify_token
from utils.system_check import get_setup_status
from typing import Optional
import shutil
from pathlib import Path
import uuid

router = APIRouter(prefix="/api/setup", tags=["setup"])

async def get_db():
    from server import db
    return db

async def get_current_admin_optional(authorization: Optional[str] = Header(None), db: AsyncIOMotorDatabase = Depends(get_db)):
    """Optional auth - returns admin if authenticated, None otherwise"""
    if not authorization or not authorization.startswith('Bearer '):
        return None
    token = authorization.replace('Bearer ', '')
    payload = verify_token(token)
    if not payload:
        return None
    admin = await db.admins.find_one({"username": payload.get("sub")})
    return Admin(**admin) if admin else None

async def get_current_admin(authorization: Optional[str] = Header(None), db: AsyncIOMotorDatabase = Depends(get_db)):
    """Require admin auth"""
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

@router.get("/status")
async def check_setup_status(db: AsyncIOMotorDatabase = Depends(get_db)):
    """Check if setup is completed and system requirements"""
    # Get system requirements
    system_status = get_setup_status()
    
    # Check if service is configured
    config = await db.service_config.find_one({})
    service_configured = config is not None and config.get('setup_completed', False)
    
    # Check if admin exists
    admin_exists = await db.admins.find_one({}) is not None
    
    # Check channel count
    channel_count = await db.channels.count_documents({})
    
    return {
        "setup_completed": service_configured and admin_exists,
        "service_configured": service_configured,
        "admin_configured": admin_exists,
        "channels_configured": channel_count >= 1,
        "channel_count": channel_count,
        "system_requirements": system_status
    }

@router.post("/service-config")
async def configure_service(
    service_name: Optional[str] = None,
    domain_name: Optional[str] = None,
    cvr_total_storage_gb: Optional[int] = None,
    hours_request_min: Optional[int] = None,
    hours_request_max: Optional[int] = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """Configure basic service settings - all fields optional, only provided fields updated"""
    config = await db.service_config.find_one({})

    update_fields = {}
    if service_name is not None:
        update_fields["service_name"] = service_name
    if domain_name is not None:
        update_fields["domain_name"] = domain_name
    if cvr_total_storage_gb is not None:
        update_fields["cvr_total_storage_gb"] = cvr_total_storage_gb
    if hours_request_min is not None:
        update_fields["hours_request_min"] = hours_request_min
    if hours_request_max is not None:
        update_fields["hours_request_max"] = hours_request_max

    if config:
        if update_fields:
            await db.service_config.update_one(
                {"_id": config["_id"]},
                {"$set": update_fields}
            )
    else:
        new_config = ServiceConfig(service_name=service_name or "TV Service")
        doc = new_config.dict()
        doc.update(update_fields)
        await db.service_config.insert_one(doc)

    return {"message": "Service configured successfully"}

@router.post("/admin")
async def create_initial_admin(
    username: str,
    password: str,
    security_questions: list,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Create initial admin account with security questions"""
    # Check if admin already exists
    existing = await db.admins.find_one({})
    if existing:
        raise HTTPException(status_code=400, detail="Admin already configured")
    
    # Hash security answers
    hashed_questions = []
    for sq in security_questions:
        hashed_questions.append({
            "question": sq["question"],
            "answer_hash": get_password_hash(sq["answer"].lower().strip())
        })
    
    # Create admin
    admin = Admin(
        username=username,
        password_hash=get_password_hash(password),
        security_questions=hashed_questions
    )
    
    await db.admins.insert_one(admin.dict())
    
    # Mark admin as configured
    await db.service_config.update_one(
        {},
        {"$set": {"admin_configured": True}}
    )
    
    return {"message": "Admin account created successfully"}

@router.post("/complete")
async def complete_setup(db: AsyncIOMotorDatabase = Depends(get_db)):
    """Mark setup as completed"""
    config = await db.service_config.find_one({})
    
    if not config:
        raise HTTPException(status_code=400, detail="Service not configured")
    
    # Verify requirements
    admin_exists = await db.admins.find_one({}) is not None
    
    if not admin_exists:
        raise HTTPException(status_code=400, detail="Admin not configured")
    
    # Mark as completed
    await db.service_config.update_one(
        {"_id": config["_id"]},
        {"$set": {
            "setup_completed": True,
            "min_channels_configured": True
        }}
    )
    
    return {"message": "Setup completed successfully"}

@router.post("/upload-logo")
async def upload_service_logo(
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """Upload service branding logo"""
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image (.png, .jpg, .jpeg, .webp)")
    
    branding_dir = Path("/app/backend/uploads/branding")
    branding_dir.mkdir(parents=True, exist_ok=True)
    
    suffix = Path(file.filename).suffix.lower()
    filename = f"logo{suffix}"
    file_path = branding_dir / filename
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    logo_path = f"/uploads/branding/{filename}"
    await db.service_config.update_one(
        {},
        {"$set": {"logo_path": logo_path}},
        upsert=True
    )
    return {"logo_path": logo_path}

@router.get("/config")
async def get_service_config(db: AsyncIOMotorDatabase = Depends(get_db)):
    """Get current service configuration"""
    config = await db.service_config.find_one({}, {"_id": 0})
    if not config:
        return {"service_name": "TV Service", "domain_name": None, "logo_path": None}
    return {
        "service_name": config.get("service_name", "TV Service"),
        "domain_name": config.get("domain_name"),
        "logo_path": config.get("logo_path"),
        "cvr_total_storage_gb": config.get("cvr_total_storage_gb", 500),
        "hours_request_min": config.get("hours_request_min", 96),
        "hours_request_max": config.get("hours_request_max", 105),
    }

@router.post("/bulk-channels")
async def create_bulk_channels(
    count: int,
    starting_number: int = 100,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Create multiple channels at once"""
    from models.channel import Channel
    from datetime import datetime
    
    if count < 25 or count > 100:
        raise HTTPException(status_code=400, detail="Count must be between 25 and 100")
    
    channels = []
    for i in range(count):
        channel = Channel(
            name=f"Channel {i+1}",
            number=str(starting_number + i),
            description="Configure this channel with your content"
        )
        channels.append(channel.dict())
    
    await db.channels.insert_many(channels)
    
    return {
        "message": f"Created {count} channels",
        "channels_created": count,
        "starting_number": starting_number,
        "ending_number": starting_number + count - 1
    }
