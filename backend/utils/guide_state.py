"""Shared helper — call this whenever new guide content is added."""
from datetime import datetime, timezone


async def bump_guide_timestamp(db) -> None:
    """Upsert a single-row guide refresh state document with the current UTC timestamp."""
    await db.guide_refresh_state.update_one(
        {"key": "last_updated"},
        {
            "$set": {
                "key": "last_updated",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )
