from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid

class Recording(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    device_id: Optional[str] = None
    channel_id: Optional[str] = None
    channel_name: Optional[str] = None
    program_title: str
    program_description: Optional[str] = None
    start_time: str  # ISO datetime or HH:MM
    end_time: Optional[str] = None
    date: Optional[str] = None  # YYYY-MM-DD
    duration_minutes: Optional[int] = None
    status: str = "scheduled"  # scheduled, recording, completed, failed, cancelled
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    thumbnail_path: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        from_attributes = True

class RecordingCreate(BaseModel):
    user_id: Optional[str] = None
    device_id: Optional[str] = None
    channel_id: Optional[str] = None
    channel_name: Optional[str] = None
    program_title: str
    program_description: Optional[str] = None
    start_time: str
    end_time: Optional[str] = None
    date: Optional[str] = None
    duration_minutes: Optional[int] = None

class RecordingUpdate(BaseModel):
    status: Optional[str] = None
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    duration_minutes: Optional[int] = None
    end_time: Optional[str] = None
