from fastapi import APIRouter, HTTPException, Depends
from models.device import Device, DeviceCreate, DeviceActivate
from typing import List
from motor.motor_asyncio import AsyncIOMotorDatabase
from utils.qr_generator import generate_qr_code
from datetime import datetime

router = APIRouter(prefix="/api/devices", tags=["devices"])

async def get_db():
    from server import db
    return db

@router.post("", response_model=Device)
async def create_device(device: DeviceCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    # Check if MAC address already exists
    existing = await db.devices.find_one({"mac_address": device.mac_address})
    if existing:
        raise HTTPException(status_code=400, detail="Device with this MAC address already exists")
    
    device_dict = device.dict()
    device_obj = Device(**device_dict)
    
    # Generate QR code
    qr_path = generate_qr_code(device_obj.activation_code, device_obj.id)
    device_obj.qr_code_path = qr_path
    
    await db.devices.insert_one(device_obj.dict())
    return device_obj

@router.get("", response_model=List[Device])
async def get_devices(db: AsyncIOMotorDatabase = Depends(get_db)):
    devices = await db.devices.find().sort("created_at", -1).to_list(1000)
    return [Device(**device) for device in devices]

@router.get("/{device_id}", response_model=Device)
async def get_device(device_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    device = await db.devices.find_one({"id": device_id})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return Device(**device)

@router.post("/activate")
async def activate_device(activation: DeviceActivate, db: AsyncIOMotorDatabase = Depends(get_db)):
    device = await db.devices.find_one({"activation_code": activation.activation_code})
    
    if not device:
        raise HTTPException(status_code=404, detail="Invalid activation code")
    
    if device["status"] == "active":
        raise HTTPException(status_code=400, detail="Device already activated")
    
    # Activate the device
    await db.devices.update_one(
        {"id": device["id"]},
        {
            "$set": {
                "status": "active",
                "activated_at": datetime.utcnow()
            }
        }
    )
    
    updated_device = await db.devices.find_one({"id": device["id"]})
    return {
        "message": "Device activated successfully",
        "device": Device(**updated_device)
    }

@router.get("/guide/{device_id}")
async def get_device_guide(device_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Public endpoint for IPTV boxes to fetch guide data"""
    device = await db.devices.find_one({"id": device_id})
    
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if device["status"] != "active":
        raise HTTPException(status_code=403, detail="Device not activated")
    
    # Get all channels
    channels = await db.channels.find().to_list(1000)
    
    # Get programs for next 7 days
    today = datetime.now().date()
    date_list = [(today + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
    programs = await db.programs.find({"date": {"$in": date_list}}).to_list(10000)
    
    return {
        "channels": channels,
        "programs": programs,
        "device": device
    }

from datetime import timedelta