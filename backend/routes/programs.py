from fastapi import APIRouter, HTTPException, Depends, Header
from models.program import Program, ProgramCreate, ProgramUpdate
from models.admin import Admin
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from utils.security import verify_token
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/programs", tags=["programs"])

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

from utils.guide_state import bump_guide_timestamp

@router.post("", response_model=Program)
async def create_program(
    program: ProgramCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    channel = await db.channels.find_one({"id": program.channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    program_dict = program.dict()

    # Auto-fill from catalog entry if provided (takes priority for title/description/poster)
    if program.catalog_id:
        catalog = await db.media_catalog.find_one({"id": program.catalog_id})
        if catalog:
            if not program_dict.get('title') or program_dict['title'] == program.title:
                program_dict['title'] = catalog.get('title', program_dict['title'])
            if not program_dict.get('description'):
                program_dict['description'] = catalog.get('description', '')
            if not program_dict.get('poster_path'):
                program_dict['poster_path'] = catalog.get('poster_path')
            if not program_dict.get('duration_minutes') or program_dict['duration_minutes'] == 0:
                program_dict['duration_minutes'] = catalog.get('runtime_minutes', 30)

    # Auto-fill duration and poster from media_id if provided (fallback)
    if program.media_id:
        media = await db.media_items.find_one({"id": program.media_id})
        if media:
            if program.duration_minutes == 0 or program.duration_minutes is None:
                program_dict['duration_minutes'] = media.get('duration_minutes', 30)
            if not program_dict.get('poster_path'):
                program_dict['poster_path'] = media.get('poster_path')
            if not program_dict.get('description'):
                program_dict['description'] = media.get('description', '')

    program_obj = Program(**program_dict)
    await db.programs.insert_one(program_obj.dict())
    await bump_guide_timestamp(db)
    return program_obj

@router.get("", response_model=List[Program])
async def get_programs(
    channel_id: Optional[str] = None,
    date: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    query = {}
    if channel_id:
        query["channel_id"] = channel_id
    if date:
        query["date"] = date
    programs = await db.programs.find(query).sort("start_time", 1).to_list(10000)
    return [Program(**program) for program in programs]

@router.get("/channel/{channel_id}", response_model=List[Program])
async def get_channel_programs(
    channel_id: str,
    days: int = 7,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    today = datetime.now().date()
    date_list = [(today + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days)]
    programs = await db.programs.find({
        "channel_id": channel_id,
        "date": {"$in": date_list}
    }).sort([("date", 1), ("start_time", 1)]).to_list(10000)
    return [Program(**program) for program in programs]

@router.get("/media/{media_id}/info")
async def get_media_program_info(
    media_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get program info from a media item (for auto-filling duration)"""
    media = await db.media_items.find_one({"id": media_id})
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    return {
        "title": media.get("title"),
        "description": media.get("description"),
        "duration_minutes": media.get("duration_minutes", 30),
        "duration_formatted": media.get("duration_formatted"),
        "poster_path": media.get("poster_path"),
        "quality_label": media.get("quality_label"),
    }

@router.put("/{program_id}", response_model=Program)
async def update_program(
    program_id: str,
    update: ProgramUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    program = await db.programs.find_one({"id": program_id})
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    update_data = update.dict(exclude_unset=True)
    await db.programs.update_one({"id": program_id}, {"$set": update_data})
    updated = await db.programs.find_one({"id": program_id})
    return Program(**updated)

@router.delete("/{program_id}")
async def delete_program(
    program_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    result = await db.programs.delete_one({"id": program_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Program not found")
    return {"message": "Program deleted successfully"}
