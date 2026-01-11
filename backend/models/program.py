from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

class ProgramBase(BaseModel):
    channel_id: str
    title: str
    description: Optional[str] = ""
    start_time: str  # HH:MM format
    duration_minutes: int  # 30, 60, 90, etc.
    date: str  # YYYY-MM-DD format

class ProgramCreate(ProgramBase):
    pass

class ProgramUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[str] = None
    duration_minutes: Optional[int] = None

class Program(ProgramBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True