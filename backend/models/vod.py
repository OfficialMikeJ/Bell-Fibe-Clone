from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid

class VODItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = ""
    media_id: Optional[str] = None  # Reference to MediaItem
    catalog_id: Optional[str] = None  # Reference to Media Catalog entry
    poster_path: Optional[str] = None
    media_file_path: Optional[str] = None  # Resolved from media_id at query time
    category: str = "movie"  # movie, tv_show, mini_series, limited_series
    genre: Optional[str] = None
    year: Optional[int] = None
    rating: Optional[str] = None
    duration_formatted: Optional[str] = None
    is_featured: bool = False
    view_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        from_attributes = True

class VODCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    media_id: Optional[str] = None
    catalog_id: Optional[str] = None
    category: str = "movie"
    genre: Optional[str] = None
    year: Optional[int] = None
    rating: Optional[str] = None
    is_featured: bool = False

class VODUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    media_id: Optional[str] = None
    catalog_id: Optional[str] = None
    category: Optional[str] = None
    genre: Optional[str] = None
    year: Optional[int] = None
    rating: Optional[str] = None
    poster_path: Optional[str] = None
    is_featured: Optional[bool] = None
