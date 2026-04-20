from fastapi import APIRouter, HTTPException, Depends, Request, Header
from models.device import Device, DeviceCreate, DeviceActivate
from models.admin import Admin
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from utils.qr_generator import generate_qr_code
from utils.geo_location import get_geo_location, is_canada_ip, get_client_ip
from utils.security import verify_token
from datetime import datetime, timedelta, timezone
import uuid

router = APIRouter(prefix="/api/devices", tags=["devices"])

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

@router.post("", response_model=Device)
async def create_device(device: DeviceCreate, db: AsyncIOMotorDatabase = Depends(get_db), admin: Admin = Depends(get_current_admin)):
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
async def get_devices(db: AsyncIOMotorDatabase = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    devices = await db.devices.find().sort("created_at", -1).to_list(1000)
    return [Device(**device) for device in devices]

@router.get("/{device_id}", response_model=Device)
async def get_device(device_id: str, db: AsyncIOMotorDatabase = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    device = await db.devices.find_one({"id": device_id})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return Device(**device)

@router.post("/refresh-qr")
async def refresh_device_qr(
    device_id: str,
    reset_code: bool = False,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """Refresh or reset QR code for a device"""
    import secrets
    from pathlib import Path
    
    device = await db.devices.find_one({"id": device_id})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Delete old QR code file
    if device.get("qr_code_path"):
        old_qr_path = Path(__file__).parent.parent / device['qr_code_path'].lstrip('/')
        if old_qr_path.exists():
            old_qr_path.unlink()
    
    if reset_code:
        # Generate new activation code
        new_code = secrets.token_urlsafe(16)
        new_qr_path = generate_qr_code(new_code, device_id)
        
        await db.devices.update_one(
            {"id": device_id},
            {"$set": {
                "activation_code": new_code,
                "qr_code_path": new_qr_path,
                "status": "pending",
                "activated_at": None
            }}
        )
        
        return {
            "message": "QR code and activation code reset",
            "activation_code": new_code,
            "qr_code_path": new_qr_path
        }
    else:
        # Regenerate QR with same code
        new_qr_path = generate_qr_code(device["activation_code"], device_id)
        
        await db.devices.update_one(
            {"id": device_id},
            {"$set": {"qr_code_path": new_qr_path}}
        )
        
        return {
            "message": "QR code refreshed",
            "activation_code": device["activation_code"],
            "qr_code_path": new_qr_path
        }


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
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "country": geo_data.get('country') if geo_data else None,
        "region": geo_data.get('region') if geo_data else None,
        "city": geo_data.get('city') if geo_data else None,
        "isp": geo_data.get('isp') if geo_data else None
    }
    
    # Update device
    update_data = {
        "status": "active",
        "activated_at": datetime.now(timezone.utc),
        "current_ip": client_ip,
        "last_geo_check": geo_data,
        "last_access": datetime.now(timezone.utc)
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

@router.get("/by-code/{activation_code}")
async def get_device_by_code(
    activation_code: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Public: look up a device by activation code (for the activation page preview)"""
    device = await db.devices.find_one({"activation_code": activation_code}, {"_id": 0})
    if not device:
        raise HTTPException(status_code=404, detail="Invalid activation code")
    return {
        "device_name": device.get("device_name"),
        "status": device.get("status"),
        "device_id": device.get("id"),
    }


@router.post("/portal-login")
async def portal_login(
    activation_code: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Public: portal login via activation code. Returns user_id for support portal session."""
    device = await db.devices.find_one({"activation_code": activation_code}, {"_id": 0})
    if not device:
        raise HTTPException(status_code=404, detail="Invalid activation code")
    if device.get("status") != "active":
        raise HTTPException(status_code=403, detail="Device is not yet activated. Please activate your device first.")

    user_id = device.get("user_id")
    if not user_id:
        # Auto-assign user_id based on device id if not set
        import uuid
        user_id = f"USR-{device['id'][:8].upper()}"
        await db.devices.update_one(
            {"id": device["id"]},
            {"$set": {"user_id": user_id}}
        )

    return {
        "user_id": user_id,
        "device_name": device.get("device_name"),
        "device_id": device.get("id"),
        "message": "Logged in successfully",
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
            "timestamp": datetime.now(timezone.utc).isoformat(),
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
                    "last_access": datetime.now(timezone.utc)
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
                    "last_access": datetime.now(timezone.utc)
                }
            }
        )
    
    # Get all channels (exclude MongoDB _id field)
    channels = await db.channels.find({}, {"_id": 0}).to_list(1000)
    
    # Get programs for next 7 days (exclude MongoDB _id field)
    today = datetime.now(timezone.utc).date()
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
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    }