from fastapi import APIRouter, Depends, Header
from models.admin import Admin
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from utils.security import verify_token
from pathlib import Path
import os

router = APIRouter(prefix="/api/stats", tags=["stats"])

async def get_db():
    from server import db
    return db

async def get_current_admin(authorization: Optional[str] = Header(None), db: AsyncIOMotorDatabase = Depends(get_db)):
    from fastapi import HTTPException
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

def get_dir_size_gb(path: str) -> float:
    """Get directory size in GB"""
    total = 0
    try:
        for dirpath, dirnames, filenames in os.walk(path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                if os.path.exists(fp):
                    total += os.path.getsize(fp)
    except Exception:
        pass
    return round(total / (1024 ** 3), 2)

def get_disk_free_gb(path: str) -> float:
    """Get free disk space in GB for partition containing path"""
    try:
        stat = os.statvfs(path)
        return round((stat.f_bavail * stat.f_frsize) / (1024 ** 3), 2)
    except Exception:
        return 0.0

@router.get("/analytics")
async def get_analytics(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin)
):
    """Comprehensive analytics for admin dashboard charts"""

    # 1. Content type distribution (media library)
    media_pipeline = [
        {"$group": {"_id": "$media_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    media_type_dist = await db.media_items.aggregate(media_pipeline).to_list(100)
    content_types = [{"type": d["_id"] or "unknown", "count": d["count"]} for d in media_type_dist]

    # 2. Genre distribution across media library + VOD
    genre_pipeline = [
        {"$match": {"genre": {"$ne": None, "$ne": ""}}},
        {"$group": {"_id": "$genre", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 12}
    ]
    genre_media = await db.media_items.aggregate(genre_pipeline).to_list(100)
    genre_vod = await db.vod_items.aggregate(genre_pipeline).to_list(100)
    genre_merged = {}
    for g in genre_media + genre_vod:
        genre_merged[g["_id"]] = genre_merged.get(g["_id"], 0) + g["count"]
    genres = [{"genre": k, "count": v} for k, v in sorted(genre_merged.items(), key=lambda x: -x[1])[:12]]

    # 3. Channel popularity (by number of recordings)
    channel_rec_pipeline = [
        {"$match": {"channel_name": {"$ne": None}}},
        {"$group": {"_id": "$channel_name", "recordings": {"$sum": 1}}},
        {"$sort": {"recordings": -1}},
        {"$limit": 10}
    ]
    channel_popularity = await db.recordings.aggregate(channel_rec_pipeline).to_list(100)
    channels_chart = [{"channel": d["_id"], "recordings": d["recordings"]} for d in channel_popularity]

    # 4. Most watched VOD (by view_count)
    popular_vod = await db.vod_items.find(
        {"view_count": {"$gt": 0}},
        {"title": 1, "view_count": 1, "category": 1, "_id": 0}
    ).sort("view_count", -1).to_list(10)
    vod_chart = [{"title": v.get("title", "?")[:30], "views": v.get("view_count", 0), "category": v.get("category", "")} for v in popular_vod]

    # 5. Storage calculations
    media_path = "/app/backend/uploads/media"
    cvr_path = "/app/backend/uploads/cvr"
    posters_path = "/app/backend/uploads/posters"

    media_used_gb = get_dir_size_gb(media_path)
    cvr_used_gb = get_dir_size_gb(cvr_path)
    posters_used_gb = get_dir_size_gb(posters_path)
    total_uploads_gb = get_dir_size_gb("/app/backend/uploads")
    disk_free_gb = get_disk_free_gb("/app/backend/uploads")

    config = await db.service_config.find_one({})
    cvr_total_gb = config.get("cvr_total_storage_gb", 500) if config else 500

    # 6. Recording status distribution
    rec_status_pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    rec_statuses = await db.recordings.aggregate(rec_status_pipeline).to_list(20)
    recording_statuses = [{"status": d["_id"], "count": d["count"]} for d in rec_statuses]

    # 7. User recording hours overview
    total_users = await db.users.count_documents({})
    users_data = await db.users.find({}, {"recording_hours_limit": 1, "recording_hours_used": 1, "_id": 0}).to_list(1000)
    total_allocated_hours = sum(u.get("recording_hours_limit", 95) for u in users_data)
    total_used_hours = sum(u.get("recording_hours_used", 0) for u in users_data)

    # 8. General counts
    total_channels = await db.channels.count_documents({})
    total_media = await db.media_items.count_documents({})
    total_vod = await db.vod_items.count_documents({})
    total_recordings = await db.recordings.count_documents({})
    pending_requests = await db.hours_requests.count_documents({"status": "pending"})

    return {
        "content_types": content_types,
        "genres": genres,
        "channel_popularity": channels_chart,
        "popular_vod": vod_chart,
        "recording_statuses": recording_statuses,
        "storage": {
            "media_uploaded_gb": media_used_gb,
            "cvr_used_gb": cvr_used_gb,
            "cvr_total_gb": cvr_total_gb,
            "cvr_available_gb": max(0, cvr_total_gb - cvr_used_gb),
            "posters_gb": posters_used_gb,
            "total_uploads_gb": total_uploads_gb,
            "disk_free_gb": disk_free_gb,
        },
        "recording_hours": {
            "total_allocated_hours": round(total_allocated_hours, 1),
            "total_used_hours": round(total_used_hours, 1),
            "average_per_user": round(total_used_hours / max(total_users, 1), 2),
        },
        "counts": {
            "channels": total_channels,
            "media_files": total_media,
            "vod_items": total_vod,
            "total_recordings": total_recordings,
            "pending_hours_requests": pending_requests,
        }
    }
