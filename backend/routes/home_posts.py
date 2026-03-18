from fastapi import APIRouter, HTTPException, Depends, Header
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from typing import Optional
from models.admin import Admin
from utils.security import verify_token
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/home-posts", tags=["home-posts"])


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
    if not payload or payload.get("type") == "customer":
        raise HTTPException(status_code=401, detail="Admin token required")
    admin = await db.admins.find_one({"username": payload.get("sub")})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    return Admin(**admin)


class HomePostCreate(BaseModel):
    title: str
    body: str
    category: str  # 'app_update' | 'upcoming_feature'
    is_published: bool = True
    version_tag: Optional[str] = None  # e.g. "v1.2.0" for app updates


class HomePostUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    category: Optional[str] = None
    is_published: Optional[bool] = None
    version_tag: Optional[str] = None


# ── Public ────────────────────────────────────────────────────────────────────

@router.get("")
async def get_published_posts(db: AsyncIOMotorDatabase = Depends(get_db)):
    """Public: return all published posts, newest first."""
    posts = await db.home_posts.find(
        {"is_published": True}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return posts


# ── Admin ─────────────────────────────────────────────────────────────────────

@router.get("/admin/all")
async def admin_get_all_posts(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    posts = await db.home_posts.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return posts


@router.post("")
async def create_post(
    data: HomePostCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if data.category not in ("app_update", "upcoming_feature"):
        raise HTTPException(status_code=400, detail="category must be 'app_update' or 'upcoming_feature'")

    doc = {
        "id": str(uuid.uuid4()),
        "title": data.title.strip(),
        "body": data.body.strip(),
        "category": data.category,
        "is_published": data.is_published,
        "version_tag": data.version_tag,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.home_posts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{post_id}")
async def update_post(
    post_id: str,
    data: HomePostUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.home_posts.update_one({"id": post_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    updated = await db.home_posts.find_one({"id": post_id}, {"_id": 0})
    return updated


@router.delete("/{post_id}")
async def delete_post(
    post_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    result = await db.home_posts.delete_one({"id": post_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"message": "Post deleted"}
