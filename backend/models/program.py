from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

class ProgramBase(BaseModel):
    channel_id: str
    title: str
    description: Optional[str] = ""
    start_time: str  # HH:MM format
    duration_minutes: int  # auto-set from media file or manual
    date: str  # YYYY-MM-DD format
    media_id: Optional[str] = None  # Reference to MediaItem
    catalog_id: Optional[str] = None  # Reference to Media Catalog entry
    poster_path: Optional[str] = None
    program_type: str = "live"  # live, recorded, movie, episode

class ProgramCreate(ProgramBase):
    pass

class ProgramUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    media_id: Optional[str] = None
    catalog_id: Optional[str] = None
    poster_path: Optional[str] = None
    program_type: Optional[str] = None

class Program(ProgramBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True
