from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

class ChannelBase(BaseModel):
    name: str
    number: str
    description: Optional[str] = ""
    logo_path: Optional[str] = ""
    quality_label: Optional[str] = "1080p"  # 720p, 720p60, 1080p, 1080p60, 1440p, 1440p60, 4K, 4K60
    channel_type: str = "live"  # live, vod
    stream_url: Optional[str] = None  # HLS/RTSP stream URL

class ChannelCreate(ChannelBase):
    pass

class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    number: Optional[str] = None
    description: Optional[str] = None
    logo_path: Optional[str] = None
    quality_label: Optional[str] = None
    channel_type: Optional[str] = None
    stream_url: Optional[str] = None

class Channel(ChannelBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True
