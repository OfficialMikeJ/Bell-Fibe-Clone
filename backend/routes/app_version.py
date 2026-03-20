from fastapi import APIRouter, HTTPException, Depends, Header
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, List
from models.admin import Admin
from utils.security import verify_token

router = APIRouter(prefix="/api/app-version", tags=["app-version"])

DEFAULT_VERSION = "0.97.1.3.B (Alpha build)"


async def get_db():
    from server import db
    return db


async def get_current_admin(
    authorization: Optional[str] = Header(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    admin = await db.admins.find_one({"username": payload.get("sub")})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    return Admin(**admin)


class VersionSection(BaseModel):
    heading: str
    items: List[str]


class AppVersionData(BaseModel):
    version: str = DEFAULT_VERSION
    sections: List[VersionSection] = []


@router.get("")
async def get_app_version(db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = await db.app_version.find_one({}, {"_id": 0})
    if not doc:
        return {"version": DEFAULT_VERSION, "sections": []}
    return doc


@router.put("")
async def update_app_version(
    data: AppVersionData,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    doc = data.dict()
    await db.app_version.replace_one({}, doc, upsert=True)
    return doc
