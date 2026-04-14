#!/usr/bin/env python3
"""
StreamVault Admin Password Reset CLI

Run from your server terminal (Termius/SSH):
  python3 reset_password.py admin@streamvault.ca

This generates a new 10-character random password and updates the database directly.
No web access required — local MongoDB connection only.
"""
import sys
import os

# Load environment
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from pymongo import MongoClient
from utils.security import get_password_hash, generate_random_password


def reset_admin_password(email: str):
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "iptv_service")

    client = MongoClient(mongo_url)
    db = client[db_name]

    admin = db.admins.find_one({"email": email.lower().strip()})
    if not admin:
        print(f"\n  Error: No admin account found for '{email}'")
        print(f"  Available accounts:")
        for a in db.admins.find({}, {"email": 1, "_id": 0}):
            print(f"    - {a['email']}")
        client.close()
        sys.exit(1)

    new_password = generate_random_password(10)
    new_hash = get_password_hash(new_password)

    db.admins.update_one(
        {"email": email.lower().strip()},
        {"$set": {"password_hash": new_hash}}
    )

    client.close()

    print(f"\n  Password reset successful!")
    print(f"  Email:        {email}")
    print(f"  New Password: {new_password}")
    print(f"\n  Save this password — it will not be shown again.\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("\nUsage: python3 reset_password.py <admin-email>")
        print("Example: python3 reset_password.py admin@streamvault.ca\n")
        sys.exit(1)

    reset_admin_password(sys.argv[1])
