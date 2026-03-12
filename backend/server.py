from fastapi import FastAPI, APIRouter
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone

# Import routes
from routes.channels import router as channels_router
from routes.programs import router as programs_router
from routes.devices import router as devices_router
from routes.auth import router as auth_router
from routes.setup import router as setup_router
from routes.users import router as users_router

# Import security middleware
from utils.https_middleware import HTTPSRedirectMiddleware, SecureHeadersMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'iptv_service')]

# Create the main app without a prefix
app = FastAPI(title="IPTV Service API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "IPTV Service API - Running", "version": "1.0.0"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# Include the router in the main app
app.include_router(api_router)

# Include feature routers
app.include_router(setup_router)
app.include_router(channels_router)
app.include_router(programs_router)
app.include_router(devices_router)
app.include_router(auth_router)
app.include_router(users_router)

# Mount uploads directory for serving files
uploads_dir = Path("/app/backend/uploads")
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# Add security middleware (HTTPS enforcement and security headers)
app.add_middleware(SecureHeadersMiddleware)
app.add_middleware(HTTPSRedirectMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    logger.info("🚀 TV Service API Started")
    logger.info(f"📊 Database: {db.name}")
    logger.info(f"📁 Upload Directory: {uploads_dir}")
    
    # Check if setup is needed
    setup_check = await db.service_config.find_one({})
    if not setup_check or not setup_check.get('setup_completed', False):
        logger.warning("⚠️  Setup not completed - access /setup to configure")
    
    # Create default admin only if no admins exist and setup not completed
    admin_exists = await db.admins.find_one({})
    if not admin_exists:
        if not setup_check or not setup_check.get('setup_completed'):
            from utils.security import get_password_hash
            from models.admin import Admin
            default_admin = Admin(
                username="admin",
                password_hash=get_password_hash("admin123")
            )
            await db.admins.insert_one(default_admin.dict())
            logger.info("✅ Default admin created (username: admin, password: admin123)")
            logger.warning("⚠️  Please change default credentials through setup wizard")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    logger.info("🛑 TV Service API Stopped")