from fastapi import APIRouter, HTTPException, Depends, Header
from models.faq import FAQ, FAQCreate, FAQUpdate
from models.admin import Admin
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from utils.security import verify_token
from datetime import datetime

router = APIRouter(prefix="/api/faq", tags=["faq"])


async def get_db():
    from server import db
    return db


async def get_current_admin(
    authorization: Optional[str] = Header(None),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    admin = await db.admins.find_one({"email": payload.get("sub")})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    return Admin(**admin)


@router.get("", response_model=List[FAQ])
async def get_faqs(
    all: bool = False,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Public: get all active FAQ items (sorted by category and order)"""
    query = {} if all else {"is_active": True}
    faqs = await db.faq.find(query, {"_id": 0}).sort([("category", 1), ("order", 1)]).to_list(500)
    return [FAQ(**f) for f in faqs]


@router.post("", response_model=FAQ)
async def create_faq(
    faq_data: FAQCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    faq = FAQ(**faq_data.dict())
    await db.faq.insert_one(faq.dict())
    return faq


@router.put("/{faq_id}", response_model=FAQ)
async def update_faq(
    faq_id: str,
    update: FAQUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    existing = await db.faq.find_one({"id": faq_id})
    if not existing:
        raise HTTPException(status_code=404, detail="FAQ item not found")

    update_fields = {k: v for k, v in update.dict().items() if v is not None}
    update_fields["updated_at"] = datetime.utcnow()

    await db.faq.update_one({"id": faq_id}, {"$set": update_fields})
    updated = await db.faq.find_one({"id": faq_id}, {"_id": 0})
    return FAQ(**updated)


@router.delete("/{faq_id}")
async def delete_faq(
    faq_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    result = await db.faq.delete_one({"id": faq_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="FAQ item not found")
    return {"message": "FAQ item deleted"}
