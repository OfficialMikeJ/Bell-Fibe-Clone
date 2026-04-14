from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Header
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from typing import Optional, List
from models.admin import Admin
from utils.security import verify_token
from datetime import datetime, timezone
import uuid
import shutil
from pathlib import Path

router = APIRouter(prefix="/api/catalog", tags=["catalog"])

CATALOG_DIR = Path("/app/backend/uploads/catalog")
for _d in ["posters", "backdrops", "cast", "gallery"]:
    (CATALOG_DIR / _d).mkdir(parents=True, exist_ok=True)


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
    admin = await db.admins.find_one({"email": payload.get("sub")})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    return Admin(**admin)


# ── Models ────────────────────────────────────────────────────────────────────

class CastMember(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    character: Optional[str] = None
    photo_path: Optional[str] = None


class CatalogEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    tagline: Optional[str] = None
    content_type: str = "movie"
    genres: List[str] = Field(default_factory=list)
    release_date: Optional[str] = None
    runtime_minutes: Optional[int] = None
    description: Optional[str] = ""
    director: Optional[str] = None
    producers: List[str] = Field(default_factory=list)
    cast: List[CastMember] = Field(default_factory=list)
    studio: Optional[str] = None
    rating: Optional[str] = None
    language: str = "English"
    country: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    poster_path: Optional[str] = None
    backdrop_path: Optional[str] = None
    additional_images: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CatalogCreate(BaseModel):
    title: str
    tagline: Optional[str] = None
    content_type: str = "movie"
    genres: List[str] = Field(default_factory=list)
    release_date: Optional[str] = None
    runtime_minutes: Optional[int] = None
    description: Optional[str] = ""
    director: Optional[str] = None
    producers: List[str] = Field(default_factory=list)
    studio: Optional[str] = None
    rating: Optional[str] = None
    language: str = "English"
    country: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class CatalogUpdate(BaseModel):
    title: Optional[str] = None
    tagline: Optional[str] = None
    content_type: Optional[str] = None
    genres: Optional[List[str]] = None
    release_date: Optional[str] = None
    runtime_minutes: Optional[int] = None
    description: Optional[str] = None
    director: Optional[str] = None
    producers: Optional[List[str]] = None
    cast: Optional[List[CastMember]] = None
    studio: Optional[str] = None
    rating: Optional[str] = None
    language: Optional[str] = None
    country: Optional[str] = None
    tags: Optional[List[str]] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _save_upload(file: UploadFile, subdir: str) -> str:
    suffix = Path(file.filename).suffix.lower() or ".jpg"
    filename = f"{uuid.uuid4()}{suffix}"
    dest = CATALOG_DIR / subdir / filename
    with dest.open("wb") as buf:
        shutil.copyfileobj(file.file, buf)
    return f"/uploads/catalog/{subdir}/{filename}"


# ── Public endpoints ──────────────────────────────────────────────────────────

@router.get("")
async def list_catalog(
    content_type: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    query = {}
    if content_type:
        query["content_type"] = content_type
    docs = await db.media_catalog.find(query, {"_id": 0}).sort("title", 1).to_list(1000)
    return docs


@router.get("/{entry_id}")
async def get_catalog_entry(
    entry_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = await db.media_catalog.find_one({"id": entry_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Catalog entry not found")
    return doc


# ── Admin endpoints ───────────────────────────────────────────────────────────

@router.post("")
async def create_catalog_entry(
    data: CatalogCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    entry = CatalogEntry(**data.dict())
    doc = entry.dict()
    await db.media_catalog.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{entry_id}")
async def update_catalog_entry(
    entry_id: str,
    data: CatalogUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    updates = {k: v for k, v in data.dict(exclude_none=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.media_catalog.update_one({"id": entry_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Catalog entry not found")
    doc = await db.media_catalog.find_one({"id": entry_id}, {"_id": 0})
    return doc


@router.delete("/{entry_id}")
async def delete_catalog_entry(
    entry_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    result = await db.media_catalog.delete_one({"id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Catalog entry not found")
    return {"message": "Catalog entry deleted"}


# ── Image Upload endpoints ────────────────────────────────────────────────────

@router.post("/{entry_id}/poster")
async def upload_poster(
    entry_id: str,
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Must be an image")
    path = _save_upload(file, "posters")
    await db.media_catalog.update_one(
        {"id": entry_id},
        {"$set": {"poster_path": path, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"poster_path": path}


@router.post("/{entry_id}/backdrop")
async def upload_backdrop(
    entry_id: str,
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Must be an image")
    path = _save_upload(file, "backdrops")
    await db.media_catalog.update_one(
        {"id": entry_id},
        {"$set": {"backdrop_path": path, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"backdrop_path": path}


@router.post("/{entry_id}/gallery")
async def upload_gallery_image(
    entry_id: str,
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Must be an image")
    path = _save_upload(file, "gallery")
    await db.media_catalog.update_one(
        {"id": entry_id},
        {"$push": {"additional_images": path},
         "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"image_path": path}


@router.delete("/{entry_id}/gallery")
async def remove_gallery_image(
    entry_id: str,
    image_path: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    await db.media_catalog.update_one(
        {"id": entry_id},
        {"$pull": {"additional_images": image_path},
         "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Image removed"}


# ── Cast endpoints ────────────────────────────────────────────────────────────

@router.post("/{entry_id}/cast")
async def add_cast_member(
    entry_id: str,
    name: str,
    character: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    member = CastMember(name=name, character=character)
    await db.media_catalog.update_one(
        {"id": entry_id},
        {"$push": {"cast": member.dict()},
         "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return member.dict()


@router.delete("/{entry_id}/cast/{cast_id}")
async def remove_cast_member(
    entry_id: str,
    cast_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    await db.media_catalog.update_one(
        {"id": entry_id},
        {"$pull": {"cast": {"id": cast_id}},
         "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Cast member removed"}


@router.post("/{entry_id}/cast/{cast_id}/photo")
async def upload_cast_photo(
    entry_id: str,
    cast_id: str,
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Must be an image")
    path = _save_upload(file, "cast")
    await db.media_catalog.update_one(
        {"id": entry_id, "cast.id": cast_id},
        {"$set": {"cast.$.photo_path": path,
                  "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"photo_path": path}
