from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid

class MediaItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = ""
    file_path: Optional[str] = None
    poster_path: Optional[str] = None
    duration_seconds: Optional[float] = None
    duration_formatted: Optional[str] = None  # "1:40:30"
    duration_minutes: Optional[int] = None
    resolution: Optional[str] = None  # "1920x1080"
    fps: Optional[float] = None
    quality_label: Optional[str] = "1080p"  # 720p, 1080p, 1440p, 4K, 720p60, etc.
    file_size: Optional[int] = None  # bytes
    channel_folder: Optional[str] = None  # e.g. "everybodylovesraymond_ch100"
    media_type: str = "movie"  # movie, tv_show, episode, mini_series, limited_series
    genre: Optional[str] = None
    year: Optional[int] = None
    rating: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        from_attributes = True

class MediaCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    media_type: str = "movie"
    genre: Optional[str] = None
    year: Optional[int] = None
    rating: Optional[str] = None
    quality_label: Optional[str] = "1080p"

class MediaUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    media_type: Optional[str] = None
    genre: Optional[str] = None
    year: Optional[int] = None
    rating: Optional[str] = None
    quality_label: Optional[str] = None
    poster_path: Optional[str] = None
