# User Account Management - No Payment Processing

## Overview
The TV Service system includes user account management for organizational purposes only. **This is NOT a payment/billing system.**

## Account Status Types

### Status Options
1. **Active** - User account is fully functional
2. **Trial** - User is in trial period (for tracking purposes only)
3. **Suspended** - User access temporarily disabled (manual admin action)
4. **Cancelled** - User account terminated

### What Account Status Does
- ✅ **Organization**: Categorize users for your records
- ✅ **Access Control**: Manually enable/disable user accounts
- ✅ **Trial Tracking**: Mark users in trial period
- ✅ **Device Limits**: Control max devices per user

### What Account Status Does NOT Do
- ❌ **NO Payment Processing**: No credit card, billing, or charges
- ❌ **NO Automatic Renewals**: No subscription automation
- ❌ **NO Payment Gateway**: No Stripe, PayPal, or payment integrations
- ❌ **NO Invoicing**: No invoice generation
- ❌ **NO Auto-Suspension**: Status changes are manual only

## How to Use

### Creating Users
1. Admin dashboard → Users tab
2. Click "Add User"
3. Enter: username, email, password, full name
4. Set max devices (1-10)
5. Account status defaults to "active"

### Changing Account Status
1. Admin dashboard → Users tab
2. Click edit (pencil icon) on user
3. Change "Account Status" dropdown
4. Options: Active, Trial, Suspended, Cancelled
5. Save changes

### Managing Device Limits
- Set max_devices when creating user (default: 3)
- Edit user to change device limit
- System prevents activation beyond limit
- View user's devices: Click eye icon

## Use Cases

### Trial Users
- Create user with status "trial"
- Manually monitor trial period
- Change to "active" or "cancelled" as needed
- **Note**: No automatic expiration

### Suspended Accounts
- Set status to "suspended"
- User cannot activate new devices
- Existing devices remain functional (manual deactivation required)
- Reactivate by changing status back to "active"

### Cancelled Accounts
- Set status to "cancelled"
- Keep account for records
- Can be reactivated if needed

## Device Association

### Linking Devices to Users
- Create device from admin dashboard
- Optionally assign user_id when creating device
- View user's devices from Users tab
- Track device count vs max_devices limit

### Future: User Self-Service (Planned)
- Customer registration website (separate service)
- Users activate their own devices via QR codes
- Device automatically linked to user account
- See `/app/FUTURE_DEVELOPMENT.md`

## Admin Dashboard Features

### User Management Tab
- **List View**: All users with status badges
  - Green: Active
  - Blue: Trial
  - Orange: Suspended
  - Red: Cancelled
  
- **Actions**:
  - 👁️ View user devices
  - ✏️ Edit user details
  - 🗑️ Delete user

- **Information Displayed**:
  - Username
  - Email
  - Full name
  - Account status
  - Max devices allowed
  - Active/Inactive flag

### User Device View
- Click eye icon on any user
- Shows all devices assigned to user
- Device name, MAC address, status
- Current device count vs limit
- Quick access to device management

## Backend API

### User Endpoints
```
GET  /api/users          - List all users
POST /api/users          - Create user
GET  /api/users/{id}     - Get user details
PUT  /api/users/{id}     - Update user
DELETE /api/users/{id}   - Delete user
GET  /api/users/{id}/devices - Get user's devices
```

### User Model Fields
```json
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "full_name": "string",
  "password_hash": "string",
  "is_active": true,
  "account_status": "active",  // active|trial|suspended|cancelled
  "max_devices": 3,
  "created_at": "datetime",
  "last_login": "datetime"
}
```

## Important Notes

1. **Manual Management**: All account status changes are manual
2. **No Automation**: System does not auto-suspend or auto-renew
3. **No Billing**: This is purely organizational
4. **Admin Only**: Only admins can change account status
5. **No Customer Portal**: Users cannot change their own status (yet)

## Future Enhancements (Planned)

See `/app/FUTURE_DEVELOPMENT.md` for:
- Customer registration website
- Self-service device activation
- Email notifications for status changes
- Optional payment integration (if needed)
- Auto-expiration for trial accounts
- Account usage analytics

---

**Current Implementation**: Account status management for organizational purposes only, no payment processing integrated.
