from fastapi import APIRouter, HTTPException, Depends, Request
from models.device import Device, DeviceCreate, DeviceActivate
from typing import List
from motor.motor_asyncio import AsyncIOMotorDatabase
from utils.qr_generator import generate_qr_code
from utils.geo_location import get_geo_location, is_canada_ip, get_client_ip
from datetime import datetime, timedelta

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
    
    # If device_uuid not provided in creation, generate one
    if not device_dict.get('device_uuid'):
        device_dict['device_uuid'] = str(uuid.uuid4())
    
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
async def activate_device(
    activation: DeviceActivate,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    device = await db.devices.find_one({"activation_code": activation.activation_code})
    
    if not device:
        raise HTTPException(status_code=404, detail="Invalid activation code")
    
    if device["status"] == "active":
        raise HTTPException(status_code=400, detail="Device already activated")
    
    # Get client IP
    client_ip = activation.ip_address or get_client_ip(request)
    
    # Get geo-location data
    geo_data = get_geo_location(client_ip)
    
    # Check if IP is from Canada
    if not is_canada_ip(client_ip):
        country = geo_data.get('country', 'Unknown') if geo_data else 'Unknown'
        raise HTTPException(
            status_code=403,
            detail=f"IPTV boxes can only be activated within Canada. Detected location: {country}"
        )
    
    # Prepare IP history entry
    ip_entry = {
        "ip": client_ip,
        "timestamp": datetime.utcnow().isoformat(),
        "country": geo_data.get('country') if geo_data else None,
        "region": geo_data.get('region') if geo_data else None,
        "city": geo_data.get('city') if geo_data else None,
        "isp": geo_data.get('isp') if geo_data else None
    }
    
    # Update device
    update_data = {
        "status": "active",
        "activated_at": datetime.utcnow(),
        "current_ip": client_ip,
        "last_geo_check": geo_data,
        "last_access": datetime.utcnow()
    }
    
    # If device UUID provided during activation, update it
    if activation.device_uuid:
        update_data["device_uuid"] = activation.device_uuid
    
    # Add to IP history
    await db.devices.update_one(
        {"id": device["id"]},
        {
            "$set": update_data,
            "$push": {"ip_history": ip_entry}
        }
    )
    
    updated_device = await db.devices.find_one({"id": device["id"]})
    return {
        "message": "Device activated successfully",
        "device": Device(**updated_device)
    }

@router.get("/guide/{device_id}")
async def get_device_guide(
    device_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Public endpoint for IPTV boxes to fetch guide data with geo-validation"""
    device = await db.devices.find_one({"id": device_id})
    
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if device["status"] != "active":
        raise HTTPException(status_code=403, detail="Device not activated")
    
    # Get client IP
    client_ip = get_client_ip(request)
    
    # Check if IP is from Canada
    if not is_canada_ip(client_ip):
        geo_data = get_geo_location(client_ip)
        country = geo_data.get('country', 'Unknown') if geo_data else 'Unknown'
        
        # Suspend device if accessed from outside Canada
        await db.devices.update_one(
            {"id": device_id},
            {"$set": {"status": "suspended"}}
        )
        
        raise HTTPException(
            status_code=403,
            detail=f"IPTV boxes can only be used within Canada. Current location: {country}. Device has been suspended."
        )
    
    # Update device access info
    geo_data = get_geo_location(client_ip)
    
    # Log IP if it's different from current
    if client_ip != device.get("current_ip"):
        ip_entry = {
            "ip": client_ip,
            "timestamp": datetime.utcnow().isoformat(),
            "country": geo_data.get('country') if geo_data else None,
            "region": geo_data.get('region') if geo_data else None,
            "city": geo_data.get('city') if geo_data else None,
            "isp": geo_data.get('isp') if geo_data else None
        }
        
        await db.devices.update_one(
            {"id": device_id},
            {
                "$set": {
                    "current_ip": client_ip,
                    "last_geo_check": geo_data,
                    "last_access": datetime.utcnow()
                },
                "$push": {"ip_history": ip_entry}
            }
        )
    else:
        # Just update last access time
        await db.devices.update_one(
            {"id": device_id},
            {
                "$set": {
                    "last_geo_check": geo_data,
                    "last_access": datetime.utcnow()
                }
            }
        )
    
    # Get all channels (exclude MongoDB _id field)
    channels = await db.channels.find({}, {"_id": 0}).to_list(1000)
    
    # Get programs for next 7 days (exclude MongoDB _id field)
    today = datetime.now().date()
    date_list = [(today + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
    programs = await db.programs.find({"date": {"$in": date_list}}, {"_id": 0}).to_list(10000)
    
    # Remove _id from device as well
    device.pop("_id", None)
    
    return {
        "channels": channels,
        "programs": programs,
        "device": device,
        "access_info": {
            "ip": client_ip,
            "location": geo_data,
            "timestamp": datetime.utcnow().isoformat()
        }
    }