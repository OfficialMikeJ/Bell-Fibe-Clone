from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

class VODItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = ""
    media_id: Optional[str] = None  # Reference to MediaItem
    poster_path: Optional[str] = None
    category: str = "movie"  # movie, tv_show, mini_series, limited_series
    genre: Optional[str] = None
    year: Optional[int] = None
    rating: Optional[str] = None
    duration_formatted: Optional[str] = None
    is_featured: bool = False
    view_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True

class VODCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    media_id: Optional[str] = None
    category: str = "movie"
    genre: Optional[str] = None
    year: Optional[int] = None
    rating: Optional[str] = None
    is_featured: bool = False

class VODUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    media_id: Optional[str] = None
    category: Optional[str] = None
    genre: Optional[str] = None
    year: Optional[int] = None
    rating: Optional[str] = None
    poster_path: Optional[str] = None
    is_featured: Optional[bool] = None
