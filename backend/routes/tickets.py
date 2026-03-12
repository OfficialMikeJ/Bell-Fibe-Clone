from fastapi import APIRouter, HTTPException, Depends, Request, Header
from models.ticket import Ticket, TicketCreate, TicketUpdate, TicketReply, TicketMessage
from models.admin import Admin
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from utils.security import verify_token
from utils.geo_location import get_client_ip
from datetime import datetime

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


async def get_db():
    from server import db
    return db


async def get_current_admin(
    authorization: Optional[str] = Header(None),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    admin = await db.admins.find_one({"username": payload.get("sub")})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    return Admin(**admin)


@router.post("", response_model=Ticket)
async def create_ticket(
    ticket_data: TicketCreate,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Public endpoint - customers submit support tickets via the portal"""
    # Verify user_id belongs to an active device
    device = await db.devices.find_one({"user_id": ticket_data.user_id, "status": "active"})
    if not device:
        raise HTTPException(status_code=403, detail="Invalid or inactive user ID")

    client_ip = get_client_ip(request)

    # Verify IP matches device's known IP (optional, just for logging)
    ticket = Ticket(
        user_id=ticket_data.user_id,
        device_id=device.get("id"),
        device_name=device.get("device_name"),
        public_ip=client_ip,
        title=ticket_data.title,
        description=ticket_data.description,
        ticket_type=ticket_data.ticket_type,
        messages=[
            TicketMessage(
                sender_id=ticket_data.user_id,
                is_admin=False,
                message=ticket_data.description,
            )
        ],
    )

    await db.tickets.insert_one(ticket.dict())
    return ticket


@router.get("", response_model=List[Ticket])
async def get_all_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    ticket_type: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Admin: get all tickets with optional filters"""
    query = {}
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if ticket_type:
        query["ticket_type"] = ticket_type

    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Ticket(**t) for t in tickets]


@router.get("/by-user/{user_id}", response_model=List[Ticket])
async def get_user_tickets(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Public: get tickets for a specific user_id (portal use)"""
    tickets = await db.tickets.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [Ticket(**t) for t in tickets]


@router.get("/{ticket_id}", response_model=Ticket)
async def get_ticket(
    ticket_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get a single ticket by ID (public - used by portal & admin)"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return Ticket(**ticket)


@router.put("/{ticket_id}", response_model=Ticket)
async def update_ticket(
    ticket_id: str,
    update: TicketUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Admin: update ticket priority and/or status"""
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    update_fields = {"updated_at": datetime.utcnow()}
    if update.status:
        update_fields["status"] = update.status
    if update.priority:
        update_fields["priority"] = update.priority

    await db.tickets.update_one({"id": ticket_id}, {"$set": update_fields})
    updated = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    return Ticket(**updated)


@router.post("/{ticket_id}/reply", response_model=Ticket)
async def reply_to_ticket(
    ticket_id: str,
    reply: TicketReply,
    request: Request,
    authorization: Optional[str] = Header(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Add a reply to a ticket. Admin auth required for admin replies, user_id for user replies."""
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if reply.is_admin:
        # Validate admin token
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Admin authentication required")
        token = authorization.replace("Bearer ", "")
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid admin token")

    message = TicketMessage(
        sender_id=reply.sender_id,
        is_admin=reply.is_admin,
        message=reply.message,
    )

    # Auto-update status when admin replies
    status_update = {}
    if reply.is_admin and ticket.get("status") == "open":
        status_update["status"] = "in_progress"

    await db.tickets.update_one(
        {"id": ticket_id},
        {
            "$push": {"messages": message.dict()},
            "$set": {"updated_at": datetime.utcnow(), **status_update},
        },
    )

    updated = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    return Ticket(**updated)


@router.delete("/{ticket_id}")
async def delete_ticket(
    ticket_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Admin: delete a ticket"""
    result = await db.tickets.delete_one({"id": ticket_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"message": "Ticket deleted"}
