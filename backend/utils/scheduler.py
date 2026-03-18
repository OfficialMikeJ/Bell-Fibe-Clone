"""
Scheduled Auto-Backup
Runs a nightly database backup and stores it locally under /app/backend/uploads/backups/
Keeps the last 7 daily backups automatically.
"""
import io
import json
import tarfile
import logging
from datetime import datetime, timezone
from pathlib import Path
from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)

BACKUPS_DIR = Path("/app/backend/uploads/backups")
MAX_BACKUPS = 7

BACKUP_COLLECTIONS = [
    "admins", "users", "customer_accounts", "channels", "epg_programs",
    "devices", "media_items", "vod_items", "notifications", "recordings",
    "tickets", "faqs", "portal_sessions", "home_posts", "media_catalog",
    "app_version", "apk_versions", "service_configs", "guide_state",
    "pin_attempt_log",
]

UPLOADS_DIR = Path("/app/backend/uploads")


async def run_scheduled_backup(db):
    """Create a backup archive and save it to the backups directory."""
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    archive_name = f"auto_backup_{timestamp}.tar.gz"
    dest_path = BACKUPS_DIR / archive_name

    try:
        db_export = {}
        for col_name in BACKUP_COLLECTIONS:
            try:
                docs = await db[col_name].find({}, {"_id": 0}).to_list(100000)
                db_export[col_name] = docs
            except Exception:
                db_export[col_name] = []

        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w:gz") as tar:
            db_json = json.dumps(db_export, default=str, indent=2).encode("utf-8")
            db_info = tarfile.TarInfo(name="database/collections.json")
            db_info.size = len(db_json)
            tar.addfile(db_info, io.BytesIO(db_json))

            manifest = {
                "version": "1.0",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "type": "scheduled_auto_backup",
                "collections": {k: len(v) for k, v in db_export.items()},
            }
            manifest_json = json.dumps(manifest, indent=2).encode("utf-8")
            mf_info = tarfile.TarInfo(name="manifest.json")
            mf_info.size = len(manifest_json)
            tar.addfile(mf_info, io.BytesIO(manifest_json))

        buf.seek(0)
        dest_path.write_bytes(buf.read())
        logger.info(f"Auto-backup saved: {archive_name} ({dest_path.stat().st_size / 1024:.1f} KB)")

        # Prune old backups — keep only the last MAX_BACKUPS
        all_backups = sorted(BACKUPS_DIR.glob("auto_backup_*.tar.gz"))
        for old in all_backups[:-MAX_BACKUPS]:
            old.unlink()
            logger.info(f"Pruned old backup: {old.name}")

    except Exception as e:
        logger.error(f"Scheduled backup failed: {e}")


def start_scheduler(db):
    """Create and start the APScheduler with the nightly backup job."""
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        run_scheduled_backup,
        trigger="cron",
        hour=3,
        minute=0,
        args=[db],
        id="nightly_backup",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()
    logger.info("Scheduler started — nightly backup job at 03:00 UTC")
    return scheduler
