from fastapi import APIRouter, HTTPException, Depends, Header
from models.admin import Admin, AdminCreate, AdminLogin, Token, PasswordReset, TwoFASetup
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from utils.security import verify_password, get_password_hash, create_access_token, verify_token
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
    
    admin = await db.admins.find_one({"username": payload.get("sub")})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    
    return Admin(**admin)

@router.post("/register", response_model=Admin)
async def register_admin(admin: AdminCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    existing = await db.admins.find_one({"username": admin.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    admin_dict = admin.dict()
    password = admin_dict.pop('password')
    admin_dict['password_hash'] = get_password_hash(password)
    
    if admin_dict.get('security_questions'):
        hashed_questions = []
        for sq in admin_dict['security_questions']:
            hashed_questions.append({
                "question": sq["question"],
                "answer_hash": get_password_hash(sq["answer"].lower().strip())
            })
        admin_dict['security_questions'] = hashed_questions
    
    admin_obj = Admin(**admin_dict)
    await db.admins.insert_one(admin_obj.dict())
    return admin_obj

@router.post("/login", response_model=Token)
async def login(credentials: AdminLogin, db: AsyncIOMotorDatabase = Depends(get_db)):
    admin = await db.admins.find_one({"username": credentials.username})
    
    if not admin or not verify_password(credentials.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if admin.get("two_fa_enabled") and admin.get("two_fa_secret"):
        if not credentials.two_fa_code:
            raise HTTPException(status_code=401, detail="2FA code required")
        
        if not verify_2fa_code(admin["two_fa_secret"], credentials.two_fa_code):
            raise HTTPException(status_code=401, detail="Invalid 2FA code")
    
    access_token = create_access_token(data={"sub": admin["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/verify")
async def verify_auth(admin: Admin = Depends(get_current_admin)):
    return {"username": admin.username, "id": admin.id, "two_fa_enabled": admin.two_fa_enabled}

@router.post("/password-reset")
async def reset_password(reset_data: PasswordReset, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Reset password using security questions"""
    admin = await db.admins.find_one({"username": reset_data.username})
    
    if not admin:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not admin.get("security_questions"):
        raise HTTPException(status_code=400, detail="No security questions configured")
    
    correct_answers = 0
    for provided in reset_data.security_answers:
        for stored in admin["security_questions"]:
            if stored["question"] == provided["question"]:
                if verify_password(provided["answer"].lower().strip(), stored["answer_hash"]):
                    correct_answers += 1
                    break
    
    if correct_answers < len(admin["security_questions"]):
        raise HTTPException(status_code=401, detail="Security answers incorrect")
    
    new_password_hash = get_password_hash(reset_data.new_password)
    await db.admins.update_one(
        {"username": reset_data.username},
        {"$set": {"password_hash": new_password_hash}}
    )
    
    return {"message": "Password reset successfully"}

@router.get("/security-questions/{username}")
async def get_security_questions(username: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Get security questions for password reset (questions only, no answers)"""
    admin = await db.admins.find_one({"username": username})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin account not found")
    questions = admin.get("security_questions", [])
    if not questions:
        raise HTTPException(status_code=400, detail="No security questions configured for this account")
    return {
        "username": username,
        "questions": [sq["question"] for sq in questions]
    }

@router.post("/2fa/setup")
async def setup_2fa(
    admin: Admin = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Setup 2FA for admin account"""
    secret = generate_2fa_secret()
    
    config = await db.service_config.find_one({})
    service_name = config.get("service_name", "TV Service") if config else "TV Service"
    
    qr_code = generate_2fa_qr_code(admin.username, secret, service_name)
    
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
