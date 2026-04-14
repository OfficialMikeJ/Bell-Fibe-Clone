from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid

class ChannelBase(BaseModel):
    name: str
    number: str
    description: Optional[str] = ""
    logo_path: Optional[str] = ""
    quality_label: Optional[str] = "1080p"
    channel_type: str = "live"
    stream_url: Optional[str] = None      # Reserved for future HLS/RTSP use
    media_id: Optional[str] = None        # Direct uploaded media file for this channel
    coming_soon: Optional[bool] = False
    hidden: Optional[bool] = False         # Hidden channels are invisible in the guide
    category: Optional[str] = "entertainment"
    genre_rotation: Optional[str] = None   # For music channels: current playlist theme

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
    media_id: Optional[str] = None
    coming_soon: Optional[bool] = None
    category: Optional[str] = None

class Channel(ChannelBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    media_file_path: Optional[str] = None  # Resolved from media_id at query time
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        from_attributes = True
