from fastapi import APIRouter, HTTPException, Depends, Request, Header
from models.security import SecurityLog, HoursRequest, HoursRequestCreate, HoursRequestUpdate
from models.admin import Admin
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from utils.security import verify_token
from datetime import datetime

router = APIRouter(prefix="/api/security", tags=["security"])

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

@router.post("/log-access-attempt")
async def log_access_attempt(
    attempt_type: str,
    message: str = "Unauthorized settings access attempt",
    request: Request = None,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Public endpoint - log unauthorized access attempts from guide sidebar"""
    ip = request.client.host if request and request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown") if request else "unknown"
    log = SecurityLog(
        type=attempt_type,
        ip_address=ip,
        user_agent=user_agent,
        message=message
    )
    await db.security_logs.insert_one(log.dict())
    return {"logged": True, "message": "Access attempt logged"}

@router.get("/logs", response_model=List[SecurityLog])
async def get_security_logs(
    limit: int = 100,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    logs = await db.security_logs.find({}).sort("created_at", -1).to_list(limit)
    return [SecurityLog(**log) for log in logs]

@router.delete("/logs")
async def clear_security_logs(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    result = await db.security_logs.delete_many({})
    return {"deleted": result.deleted_count}

# ---- Recording Hours Requests ----

@router.get("/hours-requests", response_model=List[HoursRequest])
async def get_hours_requests(
    status: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    query = {"status": status} if status else {}
    items = await db.hours_requests.find(query).sort("created_at", -1).to_list(500)
    return [HoursRequest(**item) for item in items]

@router.post("/hours-requests", response_model=HoursRequest)
async def create_hours_request(
    req: HoursRequestCreate,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Public endpoint - users submit recording hours requests"""
    # Get system min/max limits
    config = await db.service_config.find_one({})
    max_hours = config.get("hours_request_max", 105) if config else 105
    min_hours = config.get("hours_request_min", 96) if config else 96

    if req.requested_hours < min_hours or req.requested_hours > max_hours:
        raise HTTPException(status_code=400, detail=f"Requested hours must be between {min_hours} and {max_hours}")

    # Check for existing pending request from same user
    existing = await db.hours_requests.find_one({"user_id": req.user_id, "status": "pending"})
    if existing:
        raise HTTPException(status_code=409, detail="You already have a pending hours request")

    item = HoursRequest(**req.dict())
    await db.hours_requests.insert_one(item.dict())
    return item

@router.put("/hours-requests/{request_id}", response_model=HoursRequest)
async def update_hours_request(
    request_id: str,
    update: HoursRequestUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    item = await db.hours_requests.find_one({"id": request_id})
    if not item:
        raise HTTPException(status_code=404, detail="Request not found")

    update_data = {
        "status": update.status,
        "updated_at": datetime.utcnow()
    }
    if update.admin_note:
        update_data["admin_note"] = update.admin_note

    # If approved, update user's recording hours limit
    if update.status == "approved":
        user = await db.users.find_one({"id": item["user_id"]})
        if user:
            await db.users.update_one(
                {"id": item["user_id"]},
                {"$set": {"recording_hours_limit": item["requested_hours"]}}
            )

    await db.hours_requests.update_one({"id": request_id}, {"$set": update_data})
    updated = await db.hours_requests.find_one({"id": request_id})
    return HoursRequest(**updated)
