from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid

TICKET_TYPES = [
    "General Support",
    "Streaming/VOD Support",
    "Android App Support",
    "Previous Recordings Not Displaying",
    "Saved Programs Not Showing",
    "Network Errors/Service Status",
]

TICKET_PRIORITIES = ["critical", "high", "medium", "info", "resolved"]
TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"]


class TicketMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: str
    is_admin: bool = False
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TicketCreate(BaseModel):
    title: str
    description: str
    ticket_type: str
    user_id: str


class Ticket(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    device_id: Optional[str] = None
    device_name: Optional[str] = None
    public_ip: Optional[str] = None
    title: str
    description: str
    ticket_type: str
    status: str = "open"
    priority: str = "medium"
    messages: List[TicketMessage] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


class TicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None


class TicketReply(BaseModel):
    message: str
    sender_id: str
    is_admin: bool = False
