from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid

class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    message: str
    type: str = "system"  # movie, tv_show, mini_series, limited_series, system
    channel_id: Optional[str] = None
    channel_name: Optional[str] = None
    image_path: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        from_attributes = True

class NotificationCreate(BaseModel):
    title: str
    message: str
    type: str = "system"
    channel_id: Optional[str] = None
    channel_name: Optional[str] = None

class NotificationUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    type: Optional[str] = None
    is_active: Optional[bool] = None
    image_path: Optional[str] = None
