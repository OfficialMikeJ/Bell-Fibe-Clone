from fastapi import APIRouter, HTTPException, Depends, Header
from models.admin import Admin, AdminCreate, AdminLogin, Token
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from utils.security import verify_password, get_password_hash, create_access_token, verify_token

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
    
    admin_obj = Admin(**admin_dict)
    await db.admins.insert_one(admin_obj.dict())
    return admin_obj

@router.post("/login", response_model=Token)
async def login(credentials: AdminLogin, db: AsyncIOMotorDatabase = Depends(get_db)):
    admin = await db.admins.find_one({"username": credentials.username})
    
    if not admin or not verify_password(credentials.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": admin["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/verify")
async def verify_auth(admin: Admin = Depends(get_current_admin)):
    return {"username": admin.username, "id": admin.id}