from fastapi import APIRouter, HTTPException, Depends
from models.program import Program, ProgramCreate, ProgramUpdate
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/programs", tags=["programs"])

async def get_db():
    from server import db
    return db

@router.post("", response_model=Program)
async def create_program(program: ProgramCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    # Verify channel exists
    channel = await db.channels.find_one({"id": program.channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    program_dict = program.dict()
    program_obj = Program(**program_dict)
    await db.programs.insert_one(program_obj.dict())
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
    # Get programs for next 7 days
    today = datetime.now().date()
    date_list = [(today + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days)]
    
    programs = await db.programs.find({
        "channel_id": channel_id,
        "date": {"$in": date_list}
    }).sort([("date", 1), ("start_time", 1)]).to_list(10000)
    
    return [Program(**program) for program in programs]

@router.delete("/{program_id}")
async def delete_program(program_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    result = await db.programs.delete_one({"id": program_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Program not found")
    return {"message": "Program deleted successfully"}