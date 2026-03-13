"""
Roku link-code endpoints.

Flow:
  1. Roku app calls POST /api/roku/request-link  → gets a short link code + expiry
  2. User visits your website, logs in with email + Google Authenticator TOTP
     and calls POST /api/roku/confirm-link with their code
  3. Roku app polls GET /api/roku/check-link?code=XXX until linked=true
     then receives session_token to use for all subsequent API calls
"""

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorClient
from pydantic import BaseModel
from datetime import datetime, timedelta
import secrets
import string
import pyotp
import os

router = APIRouter(prefix="/api/roku", tags=["roku"])

LINK_CODE_CHARS = string.ascii_uppercase + string.digits
LINK_CODE_LENGTH = 6
LINK_EXPIRY_MINUTES = 10


def _gen_code() -> str:
    return ''.join(secrets.choice(LINK_CODE_CHARS) for _ in range(LINK_CODE_LENGTH))


_client: AsyncIOMotorClient = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    return _client


async def get_db() -> AsyncIOMotorDatabase:
    return get_client()[os.environ.get('DB_NAME', 'iptv_service')]


# ─── Models ──────────────────────────────────────────────────────────────────

class ConfirmLinkRequest(BaseModel):
    link_code: str
    email: str
    totp_code: str


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/request-link")
async def request_link(db: AsyncIOMotorDatabase = Depends(get_db)):
    """
    Step 1 (Roku calls this): Generate a 6-character link code.
    The Roku app displays the code + URL for the user to visit in a browser.
    """
    code = _gen_code()
    expires_at = datetime.utcnow() + timedelta(minutes=LINK_EXPIRY_MINUTES)

    # Upsert so Roku can refresh without creating duplicates
    await db.roku_links.delete_many({"expires_at": {"$lt": datetime.utcnow()}})
    await db.roku_links.insert_one({
        "code": code,
        "linked": False,
        "user_id": None,
        "session_token": None,
        "expires_at": expires_at,
        "created_at": datetime.utcnow(),
    })

    return {
        "link_code": code,
        "expires_in": LINK_EXPIRY_MINUTES * 60,  # seconds
        "message": f"Visit your account page and enter code: {code}",
    }


@router.post("/confirm-link")
async def confirm_link(
    data: ConfirmLinkRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Step 2 (browser side): Customer logs in with email + Google Authenticator
    TOTP and links their account to the Roku device.
    """
    # Validate link code exists and has not expired
    link = await db.roku_links.find_one({
        "code": data.link_code.upper().strip(),
        "linked": False,
        "expires_at": {"$gt": datetime.utcnow()},
    })
    if not link:
        raise HTTPException(status_code=404, detail="Link code not found or expired.")

    # Validate customer + TOTP
    customer = await db.customer_accounts.find_one({"email": data.email.lower().strip()})
    if not customer:
        raise HTTPException(status_code=401, detail="Invalid email or code.")

    totp_secret = customer.get("totp_secret")
    if not totp_secret:
        raise HTTPException(status_code=400, detail="Google Authenticator is not set up for this account.")

    if not pyotp.TOTP(totp_secret).verify(data.totp_code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid authentication code.")

    # Generate session token and mark link as confirmed
    session_token = secrets.token_urlsafe(32)
    now = datetime.utcnow()

    await db.roku_links.update_one(
        {"code": data.link_code.upper().strip()},
        {"$set": {
            "linked": True,
            "user_id": customer["id"],
            "session_token": session_token,
            "linked_at": now,
        }}
    )

    # Update customer last active
    await db.customer_accounts.update_one(
        {"id": customer["id"]},
        {"$set": {"last_active_at": now}}
    )

    return {
        "message": "Roku device linked successfully!",
        "customer_name": f"{customer['first_name']} {customer['last_name']}",
    }


@router.get("/check-link")
async def check_link(
    code: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Step 3 (Roku polls this): Check whether the link code has been confirmed.
    Returns {linked: true, session_token} once the customer has logged in.
    """
    link = await db.roku_links.find_one({"code": code.upper().strip()})
    if not link:
        raise HTTPException(status_code=404, detail="Link code not found.")

    if link["expires_at"] < datetime.utcnow() and not link["linked"]:
        raise HTTPException(status_code=410, detail="Link code expired.")

    if link["linked"]:
        return {
            "linked": True,
            "session_token": link["session_token"],
            "user_id": link["user_id"],
        }

    return {"linked": False}
