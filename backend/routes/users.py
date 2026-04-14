from fastapi import APIRouter, HTTPException, Depends, Header
from models.user import User, UserCreate, UserUpdate, UserLogin
from models.admin import Admin
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from utils.security import verify_password, get_password_hash, create_access_token, verify_token
from datetime import datetime

router = APIRouter(prefix="/api/users", tags=["users"])

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

@router.post("", response_model=User)
async def create_user(
    user: UserCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """Create a new user account"""
    # Check if username exists
    existing = await db.users.find_one({"username": user.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Check if email exists
    existing_email = await db.users.find_one({"email": user.email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    user_dict = user.dict()
    password = user_dict.pop('password')
    user_dict['password_hash'] = get_password_hash(password)
    
    user_obj = User(**user_dict)
    await db.users.insert_one(user_obj.dict())
    return user_obj

@router.get("", response_model=List[User])
async def get_users(db: AsyncIOMotorDatabase = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    """Get all users"""
    users = await db.users.find().sort("created_at", -1).to_list(1000)
    return [User(**user) for user in users]

@router.get("/{user_id}", response_model=User)
async def get_user(user_id: str, db: AsyncIOMotorDatabase = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    """Get user by ID"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**user)

@router.put("/{user_id}", response_model=User)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """Update user information"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user_update.dict(exclude_unset=True)
    if update_data:
        await db.users.update_one(
            {"id": user_id},
            {"$set": update_data}
        )
    
    updated_user = await db.users.find_one({"id": user_id})
    return User(**updated_user)

@router.delete("/{user_id}")
async def delete_user(user_id: str, db: AsyncIOMotorDatabase = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    """Delete a user"""
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

@router.get("/{user_id}/devices")
async def get_user_devices(user_id: str, db: AsyncIOMotorDatabase = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    """Get all devices for a user"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get devices associated with this user
    devices = await db.devices.find({"user_id": user_id}).to_list(100)
    
    return {
        "user_id": user_id,
        "username": user["username"],
        "devices": devices,
        "device_count": len(devices),
        "max_devices": user.get("max_devices", 3)
    }
