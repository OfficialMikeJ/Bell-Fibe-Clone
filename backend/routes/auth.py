from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from models.admin import Admin, AdminCreate, AdminLogin, Token, PasswordReset, TwoFASetup
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from utils.security import verify_password, get_password_hash, create_access_token, verify_token, generate_random_password
from utils.two_factor import generate_2fa_secret, generate_2fa_qr_code, verify_2fa_code

router = APIRouter(prefix="/api/auth", tags=["auth"])

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

@router.post("/register")
async def register_admin(admin: AdminCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    email = admin.email.lower().strip()
    existing = await db.admins.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    raw_password = generate_random_password(10)
    
    admin_obj = Admin(
        email=email,
        password_hash=get_password_hash(raw_password)
    )
    await db.admins.insert_one(admin_obj.dict())
    return {
        "id": admin_obj.id,
        "email": admin_obj.email,
        "password": raw_password,
        "message": "Admin account created. Save this password — it will not be shown again."
    }

@router.post("/login", response_model=Token)
async def login(credentials: AdminLogin, db: AsyncIOMotorDatabase = Depends(get_db)):
    email = credentials.email.lower().strip()
    admin = await db.admins.find_one({"email": email})
    
    if not admin or not verify_password(credentials.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if admin.get("two_fa_enabled") and admin.get("two_fa_secret"):
        if not credentials.two_fa_code:
            raise HTTPException(status_code=401, detail="2FA code required")
        
        if not verify_2fa_code(admin["two_fa_secret"], credentials.two_fa_code):
            raise HTTPException(status_code=401, detail="Invalid 2FA code")
    
    access_token = create_access_token(data={"sub": admin["email"]})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/verify")
async def verify_auth(admin: Admin = Depends(get_current_admin)):
    return {"email": admin.email, "id": admin.id, "two_fa_enabled": admin.two_fa_enabled}

@router.post("/password-reset")
async def reset_password(reset_data: PasswordReset, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Reset password — generates a new random 10-char password."""
    email = reset_data.email.lower().strip()
    admin = await db.admins.find_one({"email": email})
    
    if not admin:
        raise HTTPException(status_code=404, detail="Account not found")
    
    new_password = generate_random_password(10)
    new_password_hash = get_password_hash(new_password)
    await db.admins.update_one(
        {"email": email},
        {"$set": {"password_hash": new_password_hash}}
    )
    
    return {
        "message": "Password has been reset.",
        "new_password": new_password,
        "note": "Save this password — it will not be shown again."
    }

class MasterPinRequest(BaseModel):
    current_pin: Optional[str] = None
    new_pin: str

@router.post("/master-pin")
async def set_master_pin(
    request: MasterPinRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """Set or update master admin PIN for sidebar locking"""
    config = await db.service_config.find_one({})
    if not config:
        raise HTTPException(status_code=400, detail="Service not configured")
    
    current_pin_hash = config.get("master_pin_hash")
    
    if current_pin_hash and request.current_pin:
        if not verify_password(request.current_pin, current_pin_hash):
            raise HTTPException(status_code=400, detail="Current PIN is incorrect")
    
    new_hash = get_password_hash(request.new_pin)
    await db.service_config.update_one(
        {"_id": config["_id"]},
        {"$set": {"master_pin_hash": new_hash}}
    )
    return {"message": "Master PIN updated successfully"}

@router.post("/2fa/setup")
async def setup_2fa(
    admin: Admin = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Setup 2FA for admin account"""
    secret = generate_2fa_secret()
    
    config = await db.service_config.find_one({})
    service_name = config.get("service_name", "TV Service") if config else "TV Service"
    
    qr_code = generate_2fa_qr_code(admin.email, secret, service_name)
    
    await db.admins.update_one(
        {"id": admin.id},
        {"$set": {"two_fa_secret": secret}}
    )
    
    return {
        "secret": secret,
        "qr_code": qr_code,
        "message": "Scan QR code with Google Authenticator app"
    }

@router.post("/2fa/enable")
async def enable_2fa(
    verification_code: str,
    admin: Admin = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Enable 2FA after verifying code"""
    admin_data = await db.admins.find_one({"id": admin.id})
    
    if not admin_data.get("two_fa_secret"):
        raise HTTPException(status_code=400, detail="2FA not setup. Call /2fa/setup first")
    
    if not verify_2fa_code(admin_data["two_fa_secret"], verification_code):
        raise HTTPException(status_code=401, detail="Invalid verification code")
    
    await db.admins.update_one(
        {"id": admin.id},
        {"$set": {"two_fa_enabled": True}}
    )
    
    return {"message": "2FA enabled successfully"}

@router.post("/2fa/disable")
async def disable_2fa(
    verification_code: str,
    admin: Admin = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Disable 2FA"""
    admin_data = await db.admins.find_one({"id": admin.id})
    
    if not admin_data.get("two_fa_enabled"):
        raise HTTPException(status_code=400, detail="2FA not enabled")
    
    if not verify_2fa_code(admin_data["two_fa_secret"], verification_code):
        raise HTTPException(status_code=401, detail="Invalid verification code")
    
    await db.admins.update_one(
        {"id": admin.id},
        {"$set": {
            "two_fa_enabled": False,
            "two_fa_secret": None
        }}
    )
    
    return {"message": "2FA disabled successfully"}
