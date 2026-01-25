from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from motor.motor_asyncio import AsyncIOMotorDatabase
from models.service_config import ServiceConfig, ServiceConfigUpdate
from models.admin import AdminCreate, Admin
from utils.security import get_password_hash
from utils.system_check import get_setup_status
import shutil
from pathlib import Path
import uuid

router = APIRouter(prefix="/api/setup", tags=["setup"])

async def get_db():
    from server import db
    return db

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
        "setup_completed": service_configured and admin_exists and channel_count >= 25,
        "service_configured": service_configured,
        "admin_configured": admin_exists,
        "channels_configured": channel_count >= 25,
        "channel_count": channel_count,
        "system_requirements": system_status
    }

@router.post("/service-config")
async def configure_service(
    service_name: str,
    domain_name: str = None,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Configure basic service settings"""
    config = await db.service_config.find_one({})
    
    if config:
        # Update existing
        await db.service_config.update_one(
            {"_id": config["_id"]},
            {"$set": {
                "service_name": service_name,
                "domain_name": domain_name
            }}
        )
    else:
        # Create new
        service_config = ServiceConfig(
            service_name=service_name,
            domain_name=domain_name
        )
        await db.service_config.insert_one(service_config.dict())
    
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
    channel_count = await db.channels.count_documents({})
    
    if not admin_exists:
        raise HTTPException(status_code=400, detail="Admin not configured")
    
    if channel_count < 25:
        raise HTTPException(status_code=400, detail="Minimum 25 channels required")
    
    # Mark as completed
    await db.service_config.update_one(
        {"_id": config["_id"]},
        {"$set": {
            "setup_completed": True,
            "min_channels_configured": True
        }}
    )
    
    return {"message": "Setup completed successfully"}

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
