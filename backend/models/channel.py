from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

class ChannelBase(BaseModel):
    name: str
    number: str
    description: Optional[str] = ""
    logo_path: Optional[str] = ""
    quality_label: Optional[str] = "1080p"
    channel_type: str = "live"
    stream_url: Optional[str] = None
    coming_soon: Optional[bool] = False

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
    coming_soon: Optional[bool] = None

class Channel(ChannelBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True
