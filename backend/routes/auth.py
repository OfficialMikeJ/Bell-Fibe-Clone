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
    # Check if username exists
    existing = await db.admins.find_one({"username": admin.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    admin_dict = admin.dict()
    password = admin_dict.pop('password')
    admin_dict['password_hash'] = get_password_hash(password)
    
    # Hash security answers if provided
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
    
    # Check 2FA if enabled
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
    \"\"\"Reset password using security questions\"\"\"\n    admin = await db.admins.find_one({\"username\": reset_data.username})\n    \n    if not admin:\n        raise HTTPException(status_code=404, detail=\"User not found\")\n    \n    if not admin.get(\"security_questions\"):\n        raise HTTPException(status_code=400, detail=\"No security questions configured\")\n    \n    # Verify security answers\n    correct_answers = 0\n    for provided in reset_data.security_answers:\n        for stored in admin[\"security_questions\"]:\n            if stored[\"question\"] == provided[\"question\"]:\n                if verify_password(provided[\"answer\"].lower().strip(), stored[\"answer_hash\"]):\n                    correct_answers += 1\n                    break\n    \n    if correct_answers < len(admin[\"security_questions\"]):\n        raise HTTPException(status_code=401, detail=\"Security answers incorrect\")\n    \n    # Update password\n    new_password_hash = get_password_hash(reset_data.new_password)\n    await db.admins.update_one(\n        {\"username\": reset_data.username},\n        {\"$set\": {\"password_hash\": new_password_hash}}\n    )\n    \n    return {\"message\": \"Password reset successfully\"}\n\n@router.post(\"/2fa/setup\")\nasync def setup_2fa(\n    admin: Admin = Depends(get_current_admin),\n    db: AsyncIOMotorDatabase = Depends(get_db)\n):\n    \"\"\"Setup 2FA for admin account\"\"\"\n    # Generate secret\n    secret = generate_2fa_secret()\n    \n    # Get service name\n    config = await db.service_config.find_one({})\n    service_name = config.get(\"service_name\", \"TV Service\") if config else \"TV Service\"\n    \n    # Generate QR code\n    qr_code = generate_2fa_qr_code(admin.username, secret, service_name)\n    \n    # Store secret temporarily (not enabled yet)\n    await db.admins.update_one(\n        {\"id\": admin.id},\n        {\"$set\": {\"two_fa_secret\": secret}}\n    )\n    \n    return {\n        \"secret\": secret,\n        \"qr_code\": qr_code,\n        \"message\": \"Scan QR code with Google Authenticator app\"\n    }\n\n@router.post(\"/2fa/enable\")\nasync def enable_2fa(\n    verification_code: str,\n    admin: Admin = Depends(get_current_admin),\n    db: AsyncIOMotorDatabase = Depends(get_db)\n):\n    \"\"\"Enable 2FA after verifying code\"\"\"\n    admin_data = await db.admins.find_one({\"id\": admin.id})\n    \n    if not admin_data.get(\"two_fa_secret\"):\n        raise HTTPException(status_code=400, detail=\"2FA not setup. Call /2fa/setup first\")\n    \n    # Verify the code\n    if not verify_2fa_code(admin_data[\"two_fa_secret\"], verification_code):\n        raise HTTPException(status_code=401, detail=\"Invalid verification code\")\n    \n    # Enable 2FA\n    await db.admins.update_one(\n        {\"id\": admin.id},\n        {\"$set\": {\"two_fa_enabled\": True}}\n    )\n    \n    return {\"message\": \"2FA enabled successfully\"}\n\n@router.post(\"/2fa/disable\")\nasync def disable_2fa(\n    verification_code: str,\n    admin: Admin = Depends(get_current_admin),\n    db: AsyncIOMotorDatabase = Depends(get_db)\n):\n    \"\"\"Disable 2FA\"\"\"\n    admin_data = await db.admins.find_one({\"id\": admin.id})\n    \n    if not admin_data.get(\"two_fa_enabled\"):\n        raise HTTPException(status_code=400, detail=\"2FA not enabled\")\n    \n    # Verify the code\n    if not verify_2fa_code(admin_data[\"two_fa_secret\"], verification_code):\n        raise HTTPException(status_code=401, detail=\"Invalid verification code\")\n    \n    # Disable 2FA\n    await db.admins.update_one(\n        {\"id\": admin.id},\n        {\"$set\": {\n            \"two_fa_enabled\": False,\n            \"two_fa_secret\": None\n        }}\n    )\n    \n    return {\"message\": \"2FA disabled successfully\"}