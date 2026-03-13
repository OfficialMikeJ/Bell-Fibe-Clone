from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorClient
from datetime import datetime, timezone
import os

router = APIRouter(prefix="/api/guide", tags=["guide"])


def _client():
    return AsyncIOMotorClient(os.environ["MONGO_URL"])


_mongo = None


def get_client():
    global _mongo
    if _mongo is None:
        _mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return _mongo


async def get_db() -> AsyncIOMotorDatabase:
    return get_client()[os.environ.get("DB_NAME", "iptv_service")]


@router.get("/last-updated")
async def get_guide_last_updated(db: AsyncIOMotorDatabase = Depends(get_db)):
    """
    Guide-app polls this endpoint every 30 s.
    Returns the timestamp of the last content change plus total program count
    so the client can detect new additions.
    """
    state = await db.guide_refresh_state.find_one(
        {"key": "last_updated"}, {"_id": 0}
    )
    if not state:
        # Nothing has been published yet — return epoch so any real timestamp will trigger a refresh
        return {
            "timestamp": "1970-01-01T00:00:00+00:00",
            "program_count": await db.programs.count_documents({}),
        }

    program_count = await db.programs.count_documents({})
    return {
        "timestamp": state.get("timestamp", "1970-01-01T00:00:00+00:00"),
        "program_count": program_count,
    }
